import * as assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { bm25Score } from '../../scripts/wiki/bm25.js';

const IDF = { rare: 3.0, common: 0.1, unique: 5.0 };

describe('bm25Score', () => {
  test('returns 0 for empty query terms', () => {
    assert.equal(bm25Score([], { rare: 1 }, 10, 10, IDF), 0);
  });

  test('returns 0 when avgDocLength is 0', () => {
    assert.equal(bm25Score(['rare'], { rare: 1 }, 10, 0, IDF), 0);
  });

  test('missing IDF term contributes 0', () => {
    const score = bm25Score(['unknownterm'], { unknownterm: 5 }, 10, 10, IDF);
    assert.equal(score, 0);
  });

  test('longer doc scores lower than shorter for same TF', () => {
    const shortScore = bm25Score(['rare'], { rare: 1 }, 5, 10, IDF);
    const longScore = bm25Score(['rare'], { rare: 1 }, 20, 10, IDF);
    assert.ok(shortScore > longScore, `Expected ${shortScore} > ${longScore}`);
  });

  test('TF saturation: TF=10 vs TF=100 differ by less than 2x (k1=1.5)', () => {
    const score10 = bm25Score(['rare'], { rare: 10 }, 10, 10, IDF, 1.5, 0.75);
    const score100 = bm25Score(['rare'], { rare: 100 }, 10, 10, IDF, 1.5, 0.75);
    assert.ok(score100 / score10 < 2, `TF saturation violated: ratio = ${score100 / score10}`);
  });

  test('positive score for single rare term in matching doc', () => {
    const score = bm25Score(['rare'], { rare: 1 }, 10, 10, IDF);
    assert.ok(score > 0);
  });

  test('multiple matching terms sum correctly', () => {
    const singleScore = bm25Score(['rare'], { rare: 1, unique: 0 }, 10, 10, IDF);
    const doubleScore = bm25Score(['rare', 'unique'], { rare: 1, unique: 1 }, 10, 10, IDF);
    assert.ok(doubleScore > singleScore);
  });
});
