import { test } from 'node:test';
import assert from 'node:assert';
import { FORBIDDEN_FILES as HOOK_FILES, FORBIDDEN_DIRS as HOOK_DIRS } from '../hooks/constants.js';
import { FORBIDDEN_FILES as SRC_FILES, FORBIDDEN_DIRS as SRC_DIRS } from '../dist/tools/config.js';

test('Security Parity: FORBIDDEN_FILES should match between hook and src', () => {
  const sortedHook = [...HOOK_FILES].sort();
  const sortedSrc = [...SRC_FILES].sort();
  assert.deepStrictEqual(sortedHook, sortedSrc, 'FORBIDDEN_FILES mismatch between hooks/constants.js and src/tools/config.ts');
});

test('Security Parity: FORBIDDEN_DIRS should match between hook and src', () => {
  const sortedHook = [...HOOK_DIRS].sort();
  const sortedSrc = [...SRC_DIRS].sort();
  assert.deepStrictEqual(sortedHook, sortedSrc, 'FORBIDDEN_DIRS mismatch between hooks/constants.js and src/tools/config.ts');
});
