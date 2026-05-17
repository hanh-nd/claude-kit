/*
 * Scoring formula:
 *
 * anchorExactPath   = 5.0 × |{p ∈ Q.paths : ∃ a ∈ P.anchors where isPathAnchor(a) ∧ matchesPrefix(p, a)}|
 * anchorExactSymbol = 3.0 × |{s ∈ Q.symbols : ∃ a ∈ P.anchors where !isPathAnchor(a) ∧ a == s}|
 * filenameBM25      = bm25(Q.terms, slugTokenFreq(P.slug), |slugTokens|, avgSlugLen, idf, 1.5, 0.75) × 4.0
 * headingBM25       = bm25(Q.terms, headingTokenFreq(P.title+anchorText), |headingTokens|, avgHeadingLen, idf, 1.5, 0.75) × 3.0
 * keyDecisionBM25   = bm25(Q.terms, kdTokenFreq, |kdTokens|, avgKdLen, idf, 1.5, 0.75) × 1.5
 * bodyBM25          = bm25(Q.terms, P.termFreq, P.bodyLength, corpus.avgBodyLength, idf, 1.5, 0.75) × 1.0
 * statusBoost       = { active:2, complete:1, parked:0.5, deprecated:0 }
 * stalenessPenalty  = (now - updated) > 180d ? 1.0 : 0
 * strongSignal      = (anchorExactPath > 0) ∨ (anchorExactSymbol > 0) ∨ (filenameBM25 > 0) ∨ (headingBM25 > 0)
 * score             = anchorExactPath + anchorExactSymbol + filenameBM25 + headingBM25
 *                   + keyDecisionBM25 + bodyBM25 + statusBoost - stalenessPenalty
 *
 * IDF formula:
 *   idf[t] = log(1 + (N - df[t] + 0.5) / (df[t] + 0.5))
 *   where N = page count, df[t] = pages whose termFreq[t] > 0
 */
import { bm25Score } from './bm25.js';
import { tokenize } from './tokenize.js';
import { countPathPrefixMatches, countSymbolMatches } from './anchor-match.js';
const STATUS_BOOST = {
    active: 2,
    complete: 1,
    parked: 0.5,
    deprecated: 0,
};
const STATUS_SORT_PRIORITY = {
    active: 3,
    complete: 2,
    parked: 1,
    deprecated: 0,
};
const STALENESS_THRESHOLD_DAYS = 180;
const NO_STOPWORDS = new Set();
function isStalePage(updated) {
    if (!updated)
        return false;
    const updatedMs = Date.parse(updated);
    if (isNaN(updatedMs))
        return false;
    return (Date.now() - updatedMs) / (1000 * 60 * 60 * 24) > STALENESS_THRESHOLD_DAYS;
}
function buildTermFreq(tokens) {
    const freq = {};
    for (const t of tokens) {
        freq[t] = (freq[t] ?? 0) + 1;
    }
    return freq;
}
function computeAvgLength(lengths) {
    if (lengths.length === 0)
        return 0;
    return lengths.reduce((sum, l) => sum + l, 0) / lengths.length;
}
function scorePageImpl(query, page, idf, avgBodyLength, avgSlugLen, avgHeadingLen, avgKdLen) {
    const { terms, paths, symbols } = query;
    if (terms.length === 0)
        return null;
    // Anchor scores
    const anchorPathCount = countPathPrefixMatches(paths, page.anchors);
    const anchorExactPath = 5.0 * anchorPathCount;
    const anchorSymbolCount = countSymbolMatches(symbols, page.anchors);
    const anchorExactSymbol = 3.0 * anchorSymbolCount;
    // Filename BM25
    const slugTokens = tokenize(page.slug.replace(/[-_]/g, ' '), NO_STOPWORDS);
    const slugFreq = buildTermFreq(slugTokens);
    const filenameBM25 = bm25Score(terms, slugFreq, slugTokens.length, avgSlugLen, idf) * 4.0;
    // Heading BM25
    const headingText = [page.title, ...page.anchors].join(' ');
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
    const statusBoost = STATUS_BOOST[page.status ?? ''] ?? 0.5;
    const stalenessPenalty = isStalePage(page.updated) ? 1.0 : 0;
    const strongSignal = anchorExactPath > 0 || anchorExactSymbol > 0 || filenameBM25 > 0 || headingBM25 > 0;
    const score = anchorExactPath + anchorExactSymbol + filenameBM25 + headingBM25 +
        keyDecisionBM25 + bodyBM25 + statusBoost - stalenessPenalty;
    if (score <= 0)
        return null;
    const breakdown = {
        anchorExactPath,
        anchorExactSymbol,
        filenameBM25,
        headingBM25,
        keyDecisionBM25,
        bodyBM25,
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
function compareHits(a, b) {
    if (b.score !== a.score)
        return b.score - a.score;
    const aPriority = STATUS_SORT_PRIORITY[a.page.status ?? ''] ?? 1;
    const bPriority = STATUS_SORT_PRIORITY[b.page.status ?? ''] ?? 1;
    if (bPriority !== aPriority)
        return bPriority - aPriority;
    if (a.page.updated && b.page.updated)
        return b.page.updated.localeCompare(a.page.updated);
    if (a.page.updated)
        return -1;
    if (b.page.updated)
        return 1;
    return a.slug.localeCompare(b.slug);
}
export function scoreQuery(query, pages, idf, avgBodyLength, avgSlugLen, avgHeadingLen, avgKdLen) {
    if (pages.length === 0)
        return [];
    // Use precomputed averages from CorpusIndex when available; otherwise derive from pages.
    const resolvedSlugLen = avgSlugLen ?? computeAvgLength(pages.map((p) => tokenize(p.slug.replace(/[-_]/g, ' '), NO_STOPWORDS).length));
    const resolvedHeadingLen = avgHeadingLen ?? computeAvgLength(pages.map((p) => tokenize([p.title, ...p.anchors].join(' '), NO_STOPWORDS).length));
    const resolvedKdLen = avgKdLen ?? computeAvgLength(pages.map((p) => tokenize(p.keyDecisions.join(' '), NO_STOPWORDS).length));
    const hits = [];
    for (const page of pages) {
        const hit = scorePageImpl(query, page, idf, avgBodyLength, resolvedSlugLen, resolvedHeadingLen, resolvedKdLen);
        if (hit)
            hits.push(hit);
    }
    return hits.sort(compareHits);
}
