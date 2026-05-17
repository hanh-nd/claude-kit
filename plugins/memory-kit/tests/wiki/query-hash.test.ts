import * as assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { queryHash } from '../../scripts/wiki/query-hash.js';
import type { ScoredWikiQuery } from '@types';

function makeQuery(overrides: Partial<ScoredWikiQuery> = {}): ScoredWikiQuery {
  return {
    toolName: 'Read',
    paths: ['/project/auth.ts'],
    pathPrefixes: ['/project'],
    symbols: ['auth'],
    terms: ['auth', 'service'],
    ...overrides,
  };
}

describe('queryHash', () => {
  test('returns 8-char lowercase hex string', () => {
    const hash = queryHash(makeQuery());
    assert.equal(hash.length, 8);
    assert.ok(/^[0-9a-f]{8}$/.test(hash), `Not hex: ${hash}`);
  });

  test('is deterministic', () => {
    const q = makeQuery();
    assert.equal(queryHash(q), queryHash(q));
  });

  test('same query with paths in different order produces same hash', () => {
    const q1 = makeQuery({ paths: ['/a', '/b'] });
    const q2 = makeQuery({ paths: ['/b', '/a'] });
    assert.equal(queryHash(q1), queryHash(q2));
  });

  test('same query with symbols in different order produces same hash', () => {
    const q1 = makeQuery({ symbols: ['auth', 'service'] });
    const q2 = makeQuery({ symbols: ['service', 'auth'] });
    assert.equal(queryHash(q1), queryHash(q2));
  });

  test('same query with terms in different order produces same hash', () => {
    const q1 = makeQuery({ terms: ['auth', 'login'] });
    const q2 = makeQuery({ terms: ['login', 'auth'] });
    assert.equal(queryHash(q1), queryHash(q2));
  });

  test('different toolName produces different hash', () => {
    const q1 = makeQuery({ toolName: 'Read' });
    const q2 = makeQuery({ toolName: 'Edit' });
    assert.notEqual(queryHash(q1), queryHash(q2));
  });

  test('different paths produce different hash', () => {
    const q1 = makeQuery({ paths: ['/project/auth.ts'] });
    const q2 = makeQuery({ paths: ['/project/other.ts'] });
    assert.notEqual(queryHash(q1), queryHash(q2));
  });
});
