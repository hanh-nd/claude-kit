import * as assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { applyStrongSignalGate, applyThresholdGate, applyMarginGate } from '../../scripts/wiki/gates.js';
import type { WikiHit, WikiPage, WikiScoreBreakdown } from '@types';

function makeBreakdown(overrides: Partial<WikiScoreBreakdown> = {}): WikiScoreBreakdown {
  return {
    anchorExactPath: 0,
    anchorExactSymbol: 0,
    filenameBM25: 0,
    headingBM25: 0,
    keyDecisionBM25: 0,
    bodyBM25: 0,
    statusBoost: 2,
    stalenessPenalty: 0,
    strongSignal: true,
    ...overrides,
  };
}

function makeHit(score: number, breakdown: WikiScoreBreakdown, slug = 'slug-a'): WikiHit {
  const page: WikiPage = {
    slug,
    category: 'entities',
    path: `/wiki/${slug}.md`,
    title: 'Title',
    status: 'active',
    updated: '2025-01-01',
    summary: '',
    anchors: [],
    keyDecisions: [],
    edgeCases: [],
    bodyText: '',
    termFreq: {},
    bodyLength: 0,
  };
  return { slug, category: 'entities', path: `/wiki/${slug}.md`, score, breakdown, page };
}

describe('applyStrongSignalGate', () => {
  test('keeps hits with strongSignal === true', () => {
    const hit = makeHit(10, makeBreakdown({ strongSignal: true }));
    assert.equal(applyStrongSignalGate([hit]).length, 1);
  });

  test('removes hits with strongSignal === false', () => {
    const hit = makeHit(10, makeBreakdown({ strongSignal: false, bodyBM25: 3 }));
    assert.deepEqual(applyStrongSignalGate([hit]), []);
  });

  test('body-only hit (AC-5 contract) is rejected', () => {
    const bd = makeBreakdown({
      anchorExactPath: 0,
      anchorExactSymbol: 0,
      filenameBM25: 0,
      headingBM25: 0,
      bodyBM25: 5,
      strongSignal: false,
    });
    assert.deepEqual(applyStrongSignalGate([makeHit(7, bd)]), []);
  });
});

describe('applyThresholdGate', () => {
  test('keeps hits at or above minScore', () => {
    const hit = makeHit(5.0, makeBreakdown());
    assert.equal(applyThresholdGate([hit], 5.0).length, 1);
  });

  test('removes hits below minScore', () => {
    const hit = makeHit(4.9, makeBreakdown());
    assert.deepEqual(applyThresholdGate([hit], 5.0), []);
  });
});

describe('applyMarginGate', () => {
  test('returns input unchanged when fewer than 2 hits (FM-10)', () => {
    const hit = makeHit(10, makeBreakdown());
    assert.equal(applyMarginGate([hit], 1.5).length, 1);
    assert.deepEqual(applyMarginGate([], 1.5), []);
  });

  test('rejects all when ratio < marginRatio (Seam two-slot reject)', () => {
    const hit1 = makeHit(10, makeBreakdown(), 'slug-a');
    const hit2 = makeHit(8, makeBreakdown(), 'slug-b');
    // 10/8 = 1.25 < 1.5
    assert.deepEqual(applyMarginGate([hit1, hit2], 1.5), []);
  });

  test('passes all when ratio >= marginRatio', () => {
    const hit1 = makeHit(10, makeBreakdown(), 'slug-a');
    const hit2 = makeHit(5, makeBreakdown(), 'slug-b');
    // 10/5 = 2.0 >= 1.5
    assert.equal(applyMarginGate([hit1, hit2], 1.5).length, 2);
  });

  test('passes when ratio exactly meets marginRatio', () => {
    const hit1 = makeHit(15, makeBreakdown(), 'slug-a');
    const hit2 = makeHit(10, makeBreakdown(), 'slug-b');
    // 15/10 = 1.5, not < 1.5
    assert.equal(applyMarginGate([hit1, hit2], 1.5).length, 2);
  });
});
