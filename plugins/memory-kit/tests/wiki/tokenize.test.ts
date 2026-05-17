import * as assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { tokenize, splitCamelSnake, lightStem } from '../../scripts/wiki/tokenize.js';

const NO_STOPWORDS = new Set<string>();
const DEFAULT_STOPWORDS = new Set(['the', 'and', 'for', 'with', 'from', 'this', 'that', 'into', 'onto']);

describe('splitCamelSnake', () => {
  test('splits camelCase', () => {
    assert.deepEqual(splitCamelSnake('getUserProfile'), ['get', 'user', 'profile']);
  });

  test('splits PascalCase', () => {
    assert.deepEqual(splitCamelSnake('AuthService'), ['auth', 'service']);
  });

  test('splits snake_case', () => {
    assert.deepEqual(splitCamelSnake('extract_query'), ['extract', 'query']);
  });

  test('handles plain lowercase word', () => {
    assert.deepEqual(splitCamelSnake('hello'), ['hello']);
  });
});

describe('lightStem', () => {
  test('strips trailing s when length >= 4', () => {
    assert.equal(lightStem('services'), 'service');
    assert.equal(lightStem('pages'), 'page');
  });

  test('does not strip s when length < 4', () => {
    assert.equal(lightStem('is'), 'is');
    assert.equal(lightStem('has'), 'has');
  });

  test('does not strip when no trailing s', () => {
    assert.equal(lightStem('auth'), 'auth');
  });

  test('does not strip double-s endings (class, pass, process, access)', () => {
    assert.equal(lightStem('class'), 'class');
    assert.equal(lightStem('pass'), 'pass');
    assert.equal(lightStem('process'), 'process');
    assert.equal(lightStem('access'), 'access');
  });
});

describe('tokenize', () => {
  test('splits camelCase and returns ordered tokens', () => {
    const tokens = tokenize('getUserProfile extract_query', NO_STOPWORDS);
    assert.ok(tokens.includes('get'));
    assert.ok(tokens.includes('user'));
    assert.ok(tokens.includes('profile'));
    assert.ok(tokens.includes('extract'));
    assert.ok(tokens.includes('query'));
  });

  test('filters tokens shorter than 3 chars', () => {
    const tokens = tokenize('a ab abc abcd', NO_STOPWORDS);
    assert.ok(!tokens.includes('a'));
    assert.ok(!tokens.includes('ab'));
    assert.ok(tokens.includes('abc'));
    assert.ok(tokens.includes('abcd'));
  });

  test('filters pure digit tokens', () => {
    const tokens = tokenize('abc 123 xyz 456', NO_STOPWORDS);
    assert.ok(!tokens.includes('123'));
    assert.ok(!tokens.includes('456'));
    assert.ok(tokens.includes('abc'));
    assert.ok(tokens.includes('xyz'));
  });

  test('filters stopwords', () => {
    const tokens = tokenize('the and for with from', DEFAULT_STOPWORDS);
    assert.deepEqual(tokens, []);
  });

  test('applies plural stemming', () => {
    const tokens = tokenize('services pages', NO_STOPWORDS);
    assert.ok(tokens.includes('service'));
    assert.ok(tokens.includes('page'));
  });

  test('handles kebab-case by splitting on hyphen', () => {
    const tokens = tokenize('load-pages extract-query', NO_STOPWORDS);
    assert.ok(tokens.includes('load'));
    assert.ok(tokens.includes('extract'));
    assert.ok(tokens.includes('query'));
  });

  test('handles null/undefined input without throwing', () => {
    assert.doesNotThrow(() => {
      const t1 = tokenize(null as unknown as string, NO_STOPWORDS);
      assert.deepEqual(t1, []);
    });
    assert.doesNotThrow(() => {
      const t2 = tokenize(undefined as unknown as string, NO_STOPWORDS);
      assert.deepEqual(t2, []);
    });
  });

  test('returns empty array for empty string', () => {
    assert.deepEqual(tokenize('', NO_STOPWORDS), []);
  });

  test('does not dedupe by default', () => {
    const tokens = tokenize('auth auth auth', NO_STOPWORDS);
    assert.equal(tokens.filter((t) => t === 'auth').length, 3);
  });
});
