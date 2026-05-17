import * as assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { isPathAnchor, countPathPrefixMatches, countSymbolMatches } from '../../scripts/wiki/anchor-match.js';

describe('isPathAnchor', () => {
  test('returns true when anchor contains slash', () => {
    assert.equal(isPathAnchor('scripts/wiki/score-query.ts'), true);
  });

  test('returns true when anchor starts with slash', () => {
    assert.equal(isPathAnchor('/abs/path/file.ts'), true);
  });

  test('returns false for symbol-shaped anchor (no slash)', () => {
    assert.equal(isPathAnchor('scorePage'), false);
    assert.equal(isPathAnchor('auth-service.js'), false);
  });
});

describe('countPathPrefixMatches', () => {
  test('matches when queryPath ends with anchor', () => {
    const count = countPathPrefixMatches(
      ['/abs/scripts/wiki/score-query.ts'],
      ['scripts/wiki/score-query.ts'],
    );
    assert.equal(count, 1);
  });

  test('matches when anchor ends with basename of queryPath', () => {
    const count = countPathPrefixMatches(
      ['/project/score-query.ts'],
      ['scripts/wiki/score-query.ts'],
    );
    assert.equal(count, 1);
  });

  test('returns 0 when no match', () => {
    const count = countPathPrefixMatches(['/project/other.ts'], ['scripts/wiki/score-query.ts']);
    assert.equal(count, 0);
  });

  test('returns 0 for empty arrays', () => {
    assert.equal(countPathPrefixMatches([], ['scripts/wiki/score-query.ts']), 0);
    assert.equal(countPathPrefixMatches(['/project/auth.ts'], []), 0);
  });

  test('only increments once per queryPath even with multiple anchors matching', () => {
    const count = countPathPrefixMatches(
      ['/abs/scripts/auth.ts'],
      ['scripts/auth.ts', 'other/scripts/auth.ts'],
    );
    assert.equal(count, 1);
  });

  test('does not match symbol-shaped anchors', () => {
    const count = countPathPrefixMatches(['/project/auth.ts'], ['auth-service', 'scorePage']);
    assert.equal(count, 0);
  });
});

describe('countSymbolMatches', () => {
  test('matches case-insensitively', () => {
    const count = countSymbolMatches(['scorepage'], ['scorePage']);
    assert.equal(count, 1);
  });

  test('returns 0 when no match', () => {
    const count = countSymbolMatches(['login'], ['scorePage']);
    assert.equal(count, 0);
  });

  test('ignores path-shaped anchors', () => {
    const count = countSymbolMatches(['auth'], ['scripts/auth.ts', 'auth']);
    assert.equal(count, 1);
  });

  test('returns 0 for empty arrays', () => {
    assert.equal(countSymbolMatches([], ['scorePage']), 0);
    assert.equal(countSymbolMatches(['score'], []), 0);
  });
});
