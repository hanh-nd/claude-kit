import { test } from 'node:test';
import assert from 'node:assert';
import path from 'node:path';
import { validatePath, sanitizeOutput } from '../dist/tools/security.js';

const workspaceRoot = process.cwd();

test('validatePath: should throw on path traversal', () => {
  assert.throws(() => validatePath('../../../etc/passwd', workspaceRoot), /Path traversal detected/);
});

test('validatePath: should throw on .env (exact match)', () => {
  assert.throws(() => validatePath('.env', workspaceRoot), /Access to sensitive file is FORBIDDEN/);
});

test('validatePath: should throw on .Env (case-insensitive)', () => {
  assert.throws(() => validatePath('.Env', workspaceRoot), /Access to sensitive file is FORBIDDEN/);
});

test('validatePath: should throw on .env_bak (pattern)', () => {
  assert.throws(() => validatePath('.env_bak', workspaceRoot), /Access to sensitive file is FORBIDDEN/);
});

test('validatePath: should throw on .env-prod (pattern)', () => {
  assert.throws(() => validatePath('.env-prod', workspaceRoot), /Access to sensitive file is FORBIDDEN/);
});

test('validatePath: should throw on id_rsa (pattern)', () => {
  assert.throws(() => validatePath('id_rsa', workspaceRoot), /Access to sensitive file is FORBIDDEN/);
});

test('validatePath: should throw on .git/config (dir segment)', () => {
  assert.throws(() => validatePath('.git/config', workspaceRoot), /Access to sensitive directory is FORBIDDEN/);
});

test('validatePath: should throw on .ssh/id_rsa (dir segment)', () => {
  assert.throws(() => validatePath('.ssh/id_rsa', workspaceRoot), /Access to sensitive directory is FORBIDDEN/);
});

test('validatePath: should resolve src/kit-server.ts cleanly', () => {
  const resolved = validatePath('src/kit-server.ts', workspaceRoot);
  assert.strictEqual(resolved, path.resolve(workspaceRoot, 'src/kit-server.ts'));
});

test('sanitizeOutput: should redact GitHub token', () => {
  const output = 'My token is ghp_AbCdEfG123456789012345678901234567890';
  const sanitized = sanitizeOutput(output);
  assert.strictEqual(sanitized, 'My token is [REDACTED]');
});

test('sanitizeOutput: should redact AWS access key', () => {
  const output = 'AWS key: AKIA1234567890ABCDEF';
  const sanitized = sanitizeOutput(output);
  assert.strictEqual(sanitized, 'AWS key: [REDACTED]');
});

test('sanitizeOutput: should leave plain text unchanged', () => {
  const output = 'hello world';
  const sanitized = sanitizeOutput(output);
  assert.strictEqual(sanitized, 'hello world');
});
