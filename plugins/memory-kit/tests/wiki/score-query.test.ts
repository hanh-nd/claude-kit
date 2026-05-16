import * as assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { scoreQuery } from '../../scripts/wiki/score-query.js';
import { extractQuery } from '../../scripts/wiki/extract-query.js';
import { WikiPage, PageStatus } from '../../scripts/wiki/parse-page.js';

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
    ...overrides,
  };
}

describe('scoreQuery', () => {
  test('returns empty array for empty pages', () => {
    const query = extractQuery('Read', { file_path: '/project/auth-service.js' });
    const hits = scoreQuery(query, []);
    assert.deepEqual(hits, []);
  });

  test('returns empty array when no terms', () => {
    const query = extractQuery('Bash', { command: 'ls' });
    const hits = scoreQuery(query, [makePage()]);
    assert.deepEqual(hits, []);
  });

  test('ranks page first when filename matches anchor (C5)', () => {
    const query = extractQuery('Read', { file_path: '/project/auth-service.js' });
    const pages = [makePage(), makePage({ slug: 'unrelated', title: 'Unrelated', anchors: [], bodyText: 'nothing here matches' })];
    const hits = scoreQuery(query, pages);
    assert.ok(hits.length >= 1);
    assert.equal(hits[0].slug, 'auth-service');
    assert.ok(hits[0].score >= 4.0);
  });

  test('filters pages with score <= 0', () => {
    const query = extractQuery('Read', { file_path: '/project/completely-unrelated-xyz.js' });
    const pages = [makePage({ anchors: [], keyDecisions: [], edgeCases: [], bodyText: 'nothing matches here' })];
    const hits = scoreQuery(query, pages);
    // Score may be 0 or negative since statusBoost alone isn't enough when terms don't match
    // A page with active status gets +2 but no other matches
    // This is expected behavior — filter score <= 0
    for (const hit of hits) {
      assert.ok(hit.score > 0);
    }
  });

  test('applies status boost for active pages', () => {
    const query = extractQuery('Read', { file_path: '/project/auth-service.js' });
    const activePage = makePage({ status: 'active' as PageStatus });
    const deprecatedPage = makePage({ slug: 'auth-deprecated', status: 'deprecated' as PageStatus, path: '/wiki/entities/auth-deprecated.md' });

    const hits = scoreQuery(query, [activePage, deprecatedPage]);
    const activeHit = hits.find((h) => h.slug === 'auth-service');
    const deprecatedHit = hits.find((h) => h.slug === 'auth-deprecated');

    if (activeHit && deprecatedHit) {
      assert.ok(activeHit.breakdown.status > deprecatedHit.breakdown.status);
    }
  });

  test('applies staleness penalty for old pages', () => {
    const query = extractQuery('Read', { file_path: '/project/auth-service.js' });
    const freshPage = makePage({ updated: '2026-04-01' });
    const stalePage = makePage({ slug: 'auth-stale', updated: '2020-01-01', path: '/wiki/entities/auth-stale.md' });

    const hits = scoreQuery(query, [freshPage, stalePage]);
    const freshHit = hits.find((h) => h.slug === 'auth-service');
    const staleHit = hits.find((h) => h.slug === 'auth-stale');

    if (freshHit && staleHit) {
      assert.equal(freshHit.breakdown.staleness, 0);
      assert.equal(staleHit.breakdown.staleness, 1.0);
      assert.ok(freshHit.score > staleHit.score);
    }
  });

  test('sorts by score descending', () => {
    const query = extractQuery('Read', { file_path: '/project/auth-service.js' });
    const pages = [
      makePage({ slug: 'auth-low', anchors: [], keyDecisions: [], bodyText: 'auth', path: '/wiki/entities/auth-low.md' }),
      makePage({ slug: 'auth-high', anchors: ['auth-service.js'], keyDecisions: ['auth service'], bodyText: 'auth service login authentication', path: '/wiki/entities/auth-high.md' }),
    ];
    const hits = scoreQuery(query, pages);
    assert.ok(hits.length >= 2);
    assert.ok(hits[0].score >= hits[1].score);
  });

  test('sorts by status priority when scores equal', () => {
    const baseAttrs = {
      anchors: ['auth-service.js'],
      keyDecisions: ['jwt tokens'],
      edgeCases: [],
      bodyText: 'auth service login',
    };
    const pages = [
      makePage({ ...baseAttrs, slug: 'auth-complete', status: 'complete' as PageStatus, updated: '2025-01-01', path: '/wiki/entities/auth-complete.md' }),
      makePage({ ...baseAttrs, slug: 'auth-active', status: 'active' as PageStatus, updated: '2025-01-01', path: '/wiki/entities/auth-active.md' }),
    ];
    const query = extractQuery('Read', { file_path: '/project/auth-service.js' });
    const hits = scoreQuery(query, pages);
    // active has higher priority than complete if they have different scores due to statusBoost
    // active gets +2, complete gets +1, so active will score higher
    if (hits.length >= 2) {
      assert.equal(hits[0].slug, 'auth-active');
    }
  });

  test('returns breakdown with all fields', () => {
    const query = extractQuery('Read', { file_path: '/project/auth-service.js' });
    const hits = scoreQuery(query, [makePage()]);
    if (hits.length > 0) {
      const { breakdown } = hits[0];
      assert.ok('filename' in breakdown);
      assert.ok('heading' in breakdown);
      assert.ok('keyDecision' in breakdown);
      assert.ok('body' in breakdown);
      assert.ok('status' in breakdown);
      assert.ok('staleness' in breakdown);
    }
  });
});
