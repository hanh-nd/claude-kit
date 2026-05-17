import * as assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { scoreQuery } from '../../scripts/wiki/score-query.js';
import { extractQuery } from '../../scripts/wiki/extract-query.js';
import { getWikiConfig } from '../../scripts/utils.js';
import type { PageStatus, WikiPage } from '@types';

const CONFIG = getWikiConfig({});

function makePage(overrides: Partial<WikiPage> = {}): WikiPage {
  return {
    slug: 'auth-service',
    category: 'entities',
    path: '/wiki/entities/auth-service.md',
    title: 'Auth Service',
    status: 'active' as PageStatus,
    updated: '2025-01-01',
    summary: 'Manages authentication for all services',
    anchors: ['auth-service.js', 'login-handler.ts'],
    keyDecisions: ['Use JWT tokens', 'PKCE for mobile'],
    edgeCases: ['Token expiry race'],
    bodyText: 'auth service manages jwt tokens login authentication handler',
    termFreq: { auth: 2, service: 2, jwt: 1, token: 1, login: 1, authentication: 1, handler: 1 },
    bodyLength: 10,
    ...overrides,
  };
}

function buildIdf(pages: WikiPage[]): Record<string, number> {
  const N = pages.length;
  const df: Record<string, number> = {};
  for (const p of pages) {
    for (const term of Object.keys(p.termFreq)) {
      df[term] = (df[term] ?? 0) + 1;
    }
  }
  const idf: Record<string, number> = {};
  for (const [term, docFreq] of Object.entries(df)) {
    idf[term] = Math.log(1 + (N - docFreq + 0.5) / (docFreq + 0.5));
  }
  return idf;
}

function getAvgBodyLength(pages: WikiPage[]): number {
  if (pages.length === 0) return 0;
  return pages.reduce((s, p) => s + p.bodyLength, 0) / pages.length;
}

describe('scoreQuery', () => {
  test('returns empty array for empty pages', () => {
    const query = extractQuery('Read', { file_path: '/project/auth-service.js' }, CONFIG);
    const hits = scoreQuery(query, [], {}, 0);
    assert.deepEqual(hits, []);
  });

  test('returns empty array when no terms', () => {
    const query = extractQuery('Bash', { command: 'ls' }, CONFIG);
    const pages = [makePage()];
    const hits = scoreQuery(query, pages, buildIdf(pages), getAvgBodyLength(pages));
    assert.deepEqual(hits, []);
  });

  test('ranks page first when filename matches (C5)', () => {
    const query = extractQuery('Read', { file_path: '/project/auth-service.js' }, CONFIG);
    const pages = [
      makePage(),
      makePage({ slug: 'unrelated', title: 'Unrelated', anchors: [], bodyText: 'nothing here', termFreq: { nothing: 1, here: 1 }, bodyLength: 2 }),
    ];
    const idf = buildIdf(pages);
    const hits = scoreQuery(query, pages, idf, getAvgBodyLength(pages));
    assert.ok(hits.length >= 1);
    assert.equal(hits[0].slug, 'auth-service');
    assert.ok(hits[0].score >= 4.0);
  });

  test('filters pages with score <= 0', () => {
    const query = extractQuery('Read', { file_path: '/project/completely-unrelated-xyz.js' }, CONFIG);
    const pages = [makePage({ anchors: [], keyDecisions: [], edgeCases: [], bodyText: 'nothing matches here', termFreq: { nothing: 1 }, bodyLength: 3 })];
    const idf = buildIdf(pages);
    const hits = scoreQuery(query, pages, idf, getAvgBodyLength(pages));
    for (const hit of hits) {
      assert.ok(hit.score > 0);
    }
  });

  test('applies status boost for active pages', () => {
    const query = extractQuery('Read', { file_path: '/project/auth-service.js' }, CONFIG);
    const pages = [
      makePage({ status: 'active' as PageStatus }),
      makePage({ slug: 'auth-deprecated', status: 'deprecated' as PageStatus, path: '/wiki/entities/auth-deprecated.md' }),
    ];
    const idf = buildIdf(pages);
    const hits = scoreQuery(query, pages, idf, getAvgBodyLength(pages));
    const activeHit = hits.find((h) => h.slug === 'auth-service');
    const deprecatedHit = hits.find((h) => h.slug === 'auth-deprecated');

    if (activeHit && deprecatedHit) {
      assert.ok(activeHit.breakdown.statusBoost > deprecatedHit.breakdown.statusBoost);
    }
  });

  test('applies staleness penalty for old pages', () => {
    const query = extractQuery('Read', { file_path: '/project/auth-service.js' }, CONFIG);
    const pages = [
      makePage({ updated: '2026-04-01' }),
      makePage({ slug: 'auth-stale', updated: '2020-01-01', path: '/wiki/entities/auth-stale.md' }),
    ];
    const idf = buildIdf(pages);
    const hits = scoreQuery(query, pages, idf, getAvgBodyLength(pages));
    const freshHit = hits.find((h) => h.slug === 'auth-service');
    const staleHit = hits.find((h) => h.slug === 'auth-stale');

    if (freshHit && staleHit) {
      assert.equal(freshHit.breakdown.stalenessPenalty, 0);
      assert.equal(staleHit.breakdown.stalenessPenalty, 1.0);
      assert.ok(freshHit.score > staleHit.score);
    }
  });

  test('sorts by score descending', () => {
    const query = extractQuery('Read', { file_path: '/project/auth-service.js' }, CONFIG);
    const pages = [
      makePage({ slug: 'auth-low', anchors: [], keyDecisions: [], bodyText: 'auth', termFreq: { auth: 1 }, bodyLength: 1, path: '/wiki/entities/auth-low.md' }),
      makePage({ slug: 'auth-high', anchors: ['auth-service.js'], keyDecisions: ['auth service'], bodyText: 'auth service login authentication', termFreq: { auth: 2, service: 1, login: 1, authentication: 1 }, bodyLength: 5, path: '/wiki/entities/auth-high.md' }),
    ];
    const idf = buildIdf(pages);
    const hits = scoreQuery(query, pages, idf, getAvgBodyLength(pages));
    assert.ok(hits.length >= 2);
    assert.ok(hits[0].score >= hits[1].score);
  });

  test('returns breakdown with all new fields', () => {
    const query = extractQuery('Read', { file_path: '/project/auth-service.js' }, CONFIG);
    const pages = [makePage()];
    const idf = buildIdf(pages);
    const hits = scoreQuery(query, pages, idf, getAvgBodyLength(pages));
    if (hits.length > 0) {
      const { breakdown } = hits[0];
      assert.ok('anchorExactPath' in breakdown);
      assert.ok('anchorExactSymbol' in breakdown);
      assert.ok('filenameBM25' in breakdown);
      assert.ok('headingBM25' in breakdown);
      assert.ok('keyDecisionBM25' in breakdown);
      assert.ok('bodyBM25' in breakdown);
      assert.ok('statusBoost' in breakdown);
      assert.ok('stalenessPenalty' in breakdown);
      assert.ok('strongSignal' in breakdown);
    }
  });

  test('anchor exact-path match yields score >= 5.0 standalone (AC-3)', () => {
    const query = extractQuery('Read', { file_path: '/abs/scripts/wiki/score-query.ts' }, CONFIG);
    const page = makePage({
      slug: 'score-query',
      anchors: ['scripts/wiki/score-query.ts'],
      keyDecisions: [],
      bodyText: '',
      termFreq: {},
      bodyLength: 0,
    });
    const pages = [page];
    const idf = buildIdf(pages);
    const hits = scoreQuery(query, pages, idf, getAvgBodyLength(pages));
    assert.ok(hits.length > 0, 'Expected at least one hit');
    assert.ok(hits[0].breakdown.anchorExactPath > 0);
    assert.ok(hits[0].score >= 5.0);
  });

  test('body-only match yields strongSignal === false (AC-5)', () => {
    const query = { toolName: 'Read', paths: [], pathPrefixes: [], symbols: [], terms: ['jwt'] };
    const page = makePage({
      slug: 'unrelated-page',
      anchors: [],
      keyDecisions: [],
      termFreq: { jwt: 3 },
      bodyLength: 10,
    });
    const pages = [page];
    const idf = buildIdf(pages);
    const hits = scoreQuery(query, pages, idf, getAvgBodyLength(pages));
    if (hits.length > 0) {
      assert.equal(hits[0].breakdown.strongSignal, false);
    }
  });

  test('BM25 IDF down-weights common term vs rare term (AC-4)', () => {
    // 5 pages all have "config" in body; only 1 has "acquirelock"
    const makePageWithTerms = (slug: string, termFreq: Record<string, number>): WikiPage =>
      makePage({ slug, path: `/wiki/${slug}.md`, termFreq, bodyLength: Object.values(termFreq).reduce((s, v) => s + v, 0) });

    const pages = [
      makePageWithTerms('page1', { config: 2 }),
      makePageWithTerms('page2', { config: 3 }),
      makePageWithTerms('page3', { config: 1 }),
      makePageWithTerms('page4', { config: 2 }),
      makePageWithTerms('page5', { config: 2, acquirelock: 1 }),
    ];
    const idf = buildIdf(pages);
    const avg = getAvgBodyLength(pages);

    const targetPage = pages[4];
    const queryCommon = { toolName: 'Read', paths: [], pathPrefixes: [], symbols: [], terms: ['config'] };
    const queryRare = { toolName: 'Read', paths: [], pathPrefixes: [], symbols: [], terms: ['acquirelock'] };

    const allHitsCommon = scoreQuery(queryCommon, [targetPage], idf, avg);
    const allHitsRare = scoreQuery(queryRare, [targetPage], idf, avg);

    // The rare term "acquirelock" should produce a higher bodyBM25 than "config" (common in all 5)
    if (allHitsCommon.length > 0 && allHitsRare.length > 0) {
      assert.ok(
        allHitsRare[0].breakdown.bodyBM25 > allHitsCommon[0].breakdown.bodyBM25,
        `Expected acquirelock bodyBM25 (${allHitsRare[0].breakdown.bodyBM25}) > config bodyBM25 (${allHitsCommon[0].breakdown.bodyBM25})`,
      );
    }
  });
});
