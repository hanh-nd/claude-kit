import * as assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { queryHash } from '../../scripts/wiki/query-hash.js';
import type { ScoredWikiQuery } from '@types';

function makeQuery(overrides: Partial<ScoredWikiQuery> = {}): ScoredWikiQuery {
  return {
    toolName: 'Read',
    paths: ['/project/auth.ts'],
    pathPrefixes: ['/project'],
    pathTokens: ['project', 'auth'],
    symbols: ['auth'],
    freeTextTokens: [],
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

  test('same query with pathTokens in different order produces same hash', () => {
    const q1 = makeQuery({ pathTokens: ['auth', 'project'] });
    const q2 = makeQuery({ pathTokens: ['project', 'auth'] });
    assert.equal(queryHash(q1), queryHash(q2));
  });

  test('same query with freeTextTokens in different order produces same hash', () => {
    const q1 = makeQuery({ freeTextTokens: ['parallel', 'subagent'] });
    const q2 = makeQuery({ freeTextTokens: ['subagent', 'parallel'] });
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

  test('different pathTokens produce different hash', () => {
    const q1 = makeQuery({ pathTokens: ['auth'] });
    const q2 = makeQuery({ pathTokens: ['ledger'] });
    assert.notEqual(queryHash(q1), queryHash(q2));
  });

  test('different freeTextTokens produce different hash', () => {
    const q1 = makeQuery({ freeTextTokens: ['parallel'] });
    const q2 = makeQuery({ freeTextTokens: ['subagent'] });
    assert.notEqual(queryHash(q1), queryHash(q2));
  });
});
