/*
 * Scoring formula:
 *
 * anchorExactPath   = 5.0 × |{p ∈ Q.paths : ∃ a ∈ P.anchors where isPathAnchor(a) ∧ matchesPrefix(p, a)}|
 * anchorExactSymbol = 3.0 × |{s ∈ Q.symbols : ∃ a ∈ P.anchors where !isPathAnchor(a) ∧ a == s}|
 * aliasMatch        = 2.5 × |{t ∈ Q.terms : t ∈ tokenize(P.aliases)}|
 * filenameBM25      = bm25(Q.terms, slugTokenFreq(P.slug), |slugTokens|, avgSlugLen, idf, 1.5, 0.75) × 4.0
 * headingBM25       = bm25(Q.terms, headingTokenFreq(P.title+anchorText+aliasText), |headingTokens|, avgHeadingLen, idf, 1.5, 0.75) × 3.0
 * keyDecisionBM25   = bm25(Q.terms, kdTokenFreq, |kdTokens|, avgKdLen, idf, 1.5, 0.75) × 1.5
 * bodyBM25          = bm25(Q.terms, P.termFreq, P.bodyLength, corpus.avgBodyLength, idf, 1.5, 0.75) × 1.0
 * conceptIntent     = bounded boost for concept pages explicitly named by edit/write text
 * statusBoost       = { active:2, complete:1, parked:0.5, deprecated:0 }
 * stalenessPenalty  = (now - updated) > 180d ? 1.0 : 0
 * strongSignal      = (anchorExactPath > 0) ∨ (anchorExactSymbol > 0) ∨ (aliasMatch > 0)
 *                   ∨ (filenameBM25 > 0) ∨ (headingBM25 > 0)
 * score             = anchorExactPath + anchorExactSymbol + aliasMatch + filenameBM25 + headingBM25
 *                   + keyDecisionBM25 + bodyBM25 + conceptIntent + statusBoost - stalenessPenalty
 *
 * IDF formula:
 *   idf[t] = log(1 + (N - df[t] + 0.5) / (df[t] + 0.5))
 *   where N = page count, df[t] = pages whose termFreq[t] > 0
 */

import { bm25Score } from './bm25.js';
import { tokenize } from './tokenize.js';
import { countPathPrefixMatches, countSymbolMatches } from './anchor-match.js';
import type { ScoredWikiQuery, WikiHit, WikiPage, WikiScoreBreakdown } from '@types';

const STATUS_BOOST: Record<string, number> = {
  active: 2,
  complete: 1,
  parked: 0.5,
  deprecated: 0,
};

const STATUS_SORT_PRIORITY: Record<string, number> = {
  active: 3,
  complete: 2,
  parked: 1,
  deprecated: 0,
};

const STALENESS_THRESHOLD_DAYS = 180;
const ALIAS_EXACT_WEIGHT = 2.5;
const CONCEPT_INTENT_MATCH_WEIGHT = 13.0;
const CONCEPT_INTENT_MAX = 72.0;
const CONCEPT_PATH_BODY_STRONG_THRESHOLD = 8.0;
const NO_STOPWORDS = new Set<string>();
const GENERIC_ALIAS_TOKENS = new Set([
  'agent',
  'code',
  'doc',
  'file',
  'kit',
  'plugin',
  'project',
  'repo',
  'script',
  'src',
  'tool',
]);

function isStalePage(updated: string | null): boolean {
  if (!updated) return false;
  const updatedMs = Date.parse(updated);
  if (isNaN(updatedMs)) return false;
  return (Date.now() - updatedMs) / (1000 * 60 * 60 * 24) > STALENESS_THRESHOLD_DAYS;
}

function buildTermFreq(tokens: string[]): Record<string, number> {
  const freq: Record<string, number> = {};
  for (const t of tokens) {
    freq[t] = (freq[t] ?? 0) + 1;
  }
  return freq;
}

function computeAvgLength(lengths: number[]): number {
  if (lengths.length === 0) return 0;
  return lengths.reduce((sum, l) => sum + l, 0) / lengths.length;
}

function countTokenOverlap(queryTerms: string[], docTokens: string[]): number {
  const docTokenSet = new Set(docTokens);
  let count = 0;
  for (const term of new Set(queryTerms)) {
    if (docTokenSet.has(term)) count++;
  }
  return count;
}

function countUsefulAliasOverlap(queryTerms: string[], aliasTokens: string[]): number {
  const aliasTokenSet = new Set(aliasTokens);
  const matched = [...new Set(queryTerms)].filter((term) => aliasTokenSet.has(term));
  const usefulMatches = matched.filter((term) => !GENERIC_ALIAS_TOKENS.has(term));
  if (usefulMatches.length > 0) return usefulMatches.length;
  return matched.length >= 2 ? matched.length : 0;
}

function computeConceptIntentBoost(query: ScoredWikiQuery, page: WikiPage): number {
  if (page.category !== 'concepts' || query.freeTextTokens.length === 0) return 0;
  const conceptTokens = tokenize(
    [page.title, page.slug, ...page.aliases, ...page.keyDecisions, page.bodyText].join(' '),
    NO_STOPWORDS,
  );
  const matches = countTokenOverlap(query.freeTextTokens, conceptTokens);
  return Math.min(CONCEPT_INTENT_MAX, matches * CONCEPT_INTENT_MATCH_WEIGHT);
}

function hasConceptPathBodySignal(query: ScoredWikiQuery, page: WikiPage, bodyBM25: number): boolean {
  if (page.category !== 'concepts' || query.freeTextTokens.length > 0 || bodyBM25 < CONCEPT_PATH_BODY_STRONG_THRESHOLD) {
    return false;
  }
  const bodyTokens = tokenize(page.bodyText, NO_STOPWORDS);
  const bodyTokenSet = new Set(bodyTokens);
  return query.pathTokens.some((token) => !GENERIC_ALIAS_TOKENS.has(token) && bodyTokenSet.has(token));
}

function scorePageImpl(
  query: ScoredWikiQuery,
  page: WikiPage,
  idf: Readonly<Record<string, number>>,
  avgBodyLength: number,
  avgSlugLen: number,
  avgHeadingLen: number,
  avgAliasLen: number,
  avgKdLen: number,
): WikiHit | null {
  const { terms, paths, symbols } = query;
  if (terms.length === 0) return null;

  // Anchor scores
  const anchorPathCount = countPathPrefixMatches(paths, page.anchors);
  const anchorExactPath = 5.0 * anchorPathCount;

  const anchorSymbolCount = countSymbolMatches(symbols, page.anchors);
  const anchorExactSymbol = 3.0 * anchorSymbolCount;

  // Alias exact-token score
  const aliasTokens = tokenize(page.aliases.join(' '), NO_STOPWORDS);
  const aliasMatch = ALIAS_EXACT_WEIGHT * countUsefulAliasOverlap(terms, aliasTokens);
  const aliasFreq = buildTermFreq(aliasTokens);
  const aliasBM25 = bm25Score(terms, aliasFreq, aliasTokens.length, avgAliasLen, idf) * 2.0;

  // Filename BM25
  const slugTokens = tokenize(page.slug.replace(/[-_]/g, ' '), NO_STOPWORDS);
  const slugFreq = buildTermFreq(slugTokens);
  const filenameBM25 = bm25Score(terms, slugFreq, slugTokens.length, avgSlugLen, idf) * 4.0;

  // Heading BM25
  const headingText = [page.title, ...page.anchors, ...page.aliases].join(' ');
  const headingTokens = tokenize(headingText, NO_STOPWORDS);
  const headingFreq = buildTermFreq(headingTokens);
  const headingBM25 = bm25Score(terms, headingFreq, headingTokens.length, avgHeadingLen, idf) * 3.0;

  // Key decision BM25
  const kdText = page.keyDecisions.join(' ');
  const kdTokens = tokenize(kdText, NO_STOPWORDS);
  const kdFreq = buildTermFreq(kdTokens);
  const keyDecisionBM25 = bm25Score(terms, kdFreq, kdTokens.length, avgKdLen, idf) * 1.5;

  // Body BM25
  const bodyBM25 = bm25Score(terms, page.termFreq, page.bodyLength, avgBodyLength, idf) * 1.0;
  const conceptIntentBoost = computeConceptIntentBoost(query, page);
  const conceptContentSignal = conceptIntentBoost > 0 && (keyDecisionBM25 > 0 || bodyBM25 > 0);
  const conceptPathBodySignal = hasConceptPathBodySignal(query, page, bodyBM25);

  const statusBoost = STATUS_BOOST[page.status ?? ''] ?? 0.5;
  const stalenessPenalty = isStalePage(page.updated) ? 1.0 : 0;

  const strongSignal =
    anchorExactPath > 0 || anchorExactSymbol > 0 || aliasMatch > 0 || aliasBM25 > 0 ||
    filenameBM25 > 0 || headingBM25 > 0 || conceptContentSignal || conceptPathBodySignal;

  const score =
    anchorExactPath + anchorExactSymbol + aliasMatch + aliasBM25 + filenameBM25 + headingBM25 +
    keyDecisionBM25 + bodyBM25 + conceptIntentBoost + statusBoost - stalenessPenalty;

  if (score <= 0) return null;

  const breakdown: WikiScoreBreakdown = {
    anchorExactPath,
    anchorExactSymbol,
    aliasMatch: aliasMatch + aliasBM25,
    filenameBM25,
    headingBM25,
    keyDecisionBM25,
    bodyBM25,
    conceptIntentBoost,
    statusBoost,
    stalenessPenalty,
    strongSignal,
  };

  return {
    slug: page.slug,
    category: page.category,
    path: page.path,
    score,
    breakdown,
    page,
  };
}

function compareHits(a: WikiHit, b: WikiHit): number {
  if (b.score !== a.score) return b.score - a.score;

  const aPriority = STATUS_SORT_PRIORITY[a.page.status ?? ''] ?? 1;
  const bPriority = STATUS_SORT_PRIORITY[b.page.status ?? ''] ?? 1;
  if (bPriority !== aPriority) return bPriority - aPriority;

  if (a.page.updated && b.page.updated) {
    const updatedOrder = b.page.updated.localeCompare(a.page.updated);
    if (updatedOrder !== 0) return updatedOrder;
  }
  if (a.page.updated) return -1;
  if (b.page.updated) return 1;

  return a.slug.localeCompare(b.slug);
}

export function scoreQuery(
  query: ScoredWikiQuery,
  pages: WikiPage[],
  idf: Readonly<Record<string, number>>,
  avgBodyLength: number,
  avgSlugLen?: number,
  avgHeadingLen?: number,
  avgKdLen?: number,
  avgAliasLen?: number,
): WikiHit[] {
  if (pages.length === 0) return [];

  // Use precomputed averages from CorpusIndex when available; otherwise derive from pages.
  const resolvedSlugLen = avgSlugLen ?? computeAvgLength(
    pages.map((p) => tokenize(p.slug.replace(/[-_]/g, ' '), NO_STOPWORDS).length),
  );
  const resolvedHeadingLen = avgHeadingLen ?? computeAvgLength(
    pages.map((p) => tokenize([p.title, ...p.anchors, ...p.aliases].join(' '), NO_STOPWORDS).length),
  );
  const resolvedAliasLen = avgAliasLen ?? computeAvgLength(
    pages.map((p) => tokenize(p.aliases.join(' '), NO_STOPWORDS).length),
  );
  const resolvedKdLen = avgKdLen ?? computeAvgLength(
    pages.map((p) => tokenize(p.keyDecisions.join(' '), NO_STOPWORDS).length),
  );

  const hits: WikiHit[] = [];
  for (const page of pages) {
    const hit = scorePageImpl(query, page, idf, avgBodyLength, resolvedSlugLen, resolvedHeadingLen, resolvedAliasLen, resolvedKdLen);
    if (hit) hits.push(hit);
  }
  return hits.sort(compareHits);
}
