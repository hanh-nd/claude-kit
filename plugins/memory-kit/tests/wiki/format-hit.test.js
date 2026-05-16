import * as assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { formatHit } from '../../scripts/wiki/format-hit.js';

function makeHit(overrides = {}) {
  const { page: pageOverrides = {}, ...hitOverrides } = overrides;
  const page = {
    slug: 'auth-service',
    category: 'entities',
    path: '/wiki/entities/auth-service.md',
    title: 'Auth Service',
    status: 'active',
    updated: '2026-04-01',
    summary: 'Manages authentication across all services using JWT tokens.',
    anchors: ['auth-service.js', 'login-handler.ts'],
    keyDecisions: ['Use JWT with 1h expiry', 'PKCE for mobile clients', 'Refresh via httpOnly cookie'],
    edgeCases: ['Token expiry during long ops', 'Concurrent refresh race'],
    bodyText: 'auth service manages jwt tokens',
    ...pageOverrides,
  };
  return {
    slug: page.slug,
    category: page.category,
    path: page.path,
    score: 10,
    breakdown: { filename: 2, heading: 1, keyDecision: 1, body: 1, status: 2, staleness: 0 },
    page,
    ...hitOverrides,
  };
}

const FOOTER_RE = /\(If this contradicts the code you can see, trust the code\. Cite as \[\[[\w-]+\]\]\.\)$/;

describe('formatHit', () => {
  test('output is at most 1500 chars (C12)', () => {
    const snippet = formatHit(makeHit());
    assert.ok(snippet.length <= 1500, `Expected <= 1500 chars, got ${snippet.length}`);
  });

  test('output contains [WIKI HIT] <slug> (C12)', () => {
    const snippet = formatHit(makeHit());
    assert.ok(snippet.includes('[WIKI HIT] auth-service'));
  });

  test('always ends with conflict-rule footer (C29)', () => {
    const snippet = formatHit(makeHit());
    assert.ok(FOOTER_RE.test(snippet), `Footer not found in:\n${snippet}`);
  });

  test('footer is never truncated even when content is long (C29)', () => {
    const longSummary = 'A'.repeat(600);
    const longDecisions = ['Decision: ' + 'x'.repeat(200), 'Another: ' + 'y'.repeat(200), 'Third: ' + 'z'.repeat(200)];
    const hit = makeHit({ page: { summary: longSummary, keyDecisions: longDecisions, edgeCases: ['Risk: ' + 'r'.repeat(200), 'Risk2: ' + 's'.repeat(200)] } });
    const snippet = formatHit(hit);
    assert.ok(snippet.length <= 1500, `Expected <= 1500 chars, got ${snippet.length}`);
    assert.ok(FOOTER_RE.test(snippet), `Footer not found in snippet of length ${snippet.length}`);
  });

  test('omits Annotates line when no anchors', () => {
    const hit = makeHit({ page: { anchors: [] } });
    const snippet = formatHit(hit);
    assert.ok(!snippet.includes('Annotates:'));
  });

  test('includes first anchor in Annotates line', () => {
    const snippet = formatHit(makeHit());
    assert.ok(snippet.includes('Annotates: auth-service.js'));
  });

  test('includes summary', () => {
    const snippet = formatHit(makeHit());
    assert.ok(snippet.includes('Summary:'));
    assert.ok(snippet.includes('Manages authentication'));
  });

  test('gracefully omits summary when missing', () => {
    const hit = makeHit({ page: { summary: '' } });
    const snippet = formatHit(hit);
    assert.ok(!snippet.includes('Summary:'));
    assert.ok(FOOTER_RE.test(snippet));
  });

  test('includes key decisions (max 3)', () => {
    const snippet = formatHit(makeHit());
    assert.ok(snippet.includes('Key Decisions:'));
    assert.ok(snippet.includes('JWT'));
  });

  test('includes edge cases (max 2)', () => {
    const snippet = formatHit(makeHit());
    assert.ok(snippet.includes('Edge Cases:'));
  });

  test('includes Read for full context line', () => {
    const snippet = formatHit(makeHit());
    assert.ok(snippet.includes('Read for full context:'));
  });

  test('uses relative path when projectRoot provided', () => {
    const snippet = formatHit(makeHit(), { projectRoot: '/wiki' });
    assert.ok(snippet.includes('entities/auth-service.md'));
    assert.ok(!snippet.includes('Read for full context: /wiki/entities'));
  });

  test('inbox category emits short form', () => {
    const hit = makeHit({ page: { category: 'inbox', summary: 'A handoff summary', anchors: [] } });
    hit.category = 'inbox';
    const snippet = formatHit(hit);
    assert.ok(snippet.includes('[WIKI HIT-INBOX]'));
    assert.ok(!snippet.includes('[WIKI HIT]'));
    assert.ok(FOOTER_RE.test(snippet));
  });

  test('inbox short form includes summary', () => {
    const hit = makeHit({ page: { category: 'inbox', summary: 'A handoff summary', anchors: [] } });
    hit.category = 'inbox';
    const snippet = formatHit(hit);
    assert.ok(snippet.includes('A handoff summary'));
  });

  test('bullets are never split mid-text', () => {
    const snippet = formatHit(makeHit());
    const lines = snippet.split('\n');
    for (const line of lines) {
      if (line.startsWith('- ')) {
        assert.ok(line.length < 500, 'Bullet line unexpectedly long');
      }
    }
  });
});
