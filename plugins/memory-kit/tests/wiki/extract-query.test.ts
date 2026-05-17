import * as assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { extractQuery } from '../../scripts/wiki/extract-query.js';
import { getWikiConfig } from '../../scripts/utils.js';

const CONFIG = getWikiConfig({});

describe('extractQuery', () => {
  describe('Read tool', () => {
    test('extracts terms from file_path', () => {
      const q = extractQuery('Read', { file_path: '/project/auth-service.js' }, CONFIG);
      assert.ok(q.terms.length > 0);
      assert.ok(q.terms.some((t) => t.includes('auth') || t.includes('service')));
    });

    test('captures path', () => {
      const q = extractQuery('Read', { file_path: '/project/auth-service.js' }, CONFIG);
      assert.deepEqual(q.paths, ['/project/auth-service.js']);
    });

    test('camelCase split: /x/getUserProfile.ts terms include get, user, profile', () => {
      const q = extractQuery('Read', { file_path: '/x/getUserProfile.ts' }, CONFIG);
      assert.ok(q.terms.includes('get'), 'missing "get"');
      assert.ok(q.terms.includes('user'), 'missing "user"');
      assert.ok(q.terms.includes('profile'), 'missing "profile"');
    });

    test('pathPrefixes are populated', () => {
      const q = extractQuery('Read', { file_path: '/project/src/auth.ts' }, CONFIG);
      assert.ok(q.pathPrefixes.includes('/project'));
      assert.ok(q.pathPrefixes.includes('/project/src'));
    });
  });

  describe('Edit tool', () => {
    test('extracts from file_path and new_string', () => {
      const q = extractQuery('Edit', {
        file_path: '/project/ledger.js',
        new_string: 'function markInjected(session) {}',
      }, CONFIG);
      assert.ok(q.terms.some((t) => t.includes('ledger') || t.includes('mark') || t.includes('inject') || t.includes('session')));
    });

    test('limits new_string to 200 chars', () => {
      const longStr = 'x'.repeat(1000);
      const q = extractQuery('Edit', { file_path: '/a.js', new_string: longStr }, CONFIG);
      assert.ok(q.freeText.length <= 200);
    });
  });

  describe('Write tool', () => {
    test('extracts from file_path and content', () => {
      const q = extractQuery('Write', {
        file_path: '/project/wiki/compile-state.js',
        content: 'export function evaluateTrigger() {}',
      }, CONFIG);
      assert.ok(q.terms.length > 0);
    });
  });

  describe('Grep tool', () => {
    test('extracts from pattern and path', () => {
      const q = extractQuery('Grep', { pattern: 'acquireLock', path: '/project/scripts' }, CONFIG);
      assert.ok(q.terms.some((t) => t.includes('acquirelock') || t.includes('acquire') || t.includes('lock')));
    });
  });

  describe('Bash tool', () => {
    test('returns empty terms for "ls" command (C7)', () => {
      const q = extractQuery('Bash', { command: 'ls' }, CONFIG);
      assert.equal(q.terms.length, 0);
    });

    test('extracts meaningful terms from complex command', () => {
      const q = extractQuery('Bash', { command: 'node scripts/wiki-inbox-append.js --debug' }, CONFIG);
      assert.ok(q.terms.some((t) => t.includes('wiki') || t.includes('inbox') || t.includes('append')));
    });

    test('Bash does not derive symbols from file paths', () => {
      const q = extractQuery('Bash', { command: 'cat /project/auth-service.ts' }, CONFIG);
      // symbols should be empty for Bash (only freeTextTokens)
      assert.deepEqual(q.symbols, []);
    });
  });

  describe('stopword filtering', () => {
    test('stopwords filtered from freeTextTokens', () => {
      const q = extractQuery('Edit', { file_path: '/a.ts', new_string: 'the and for with' }, CONFIG);
      assert.deepEqual(q.freeTextTokens, []);
    });
  });

  describe('free-text token cap', () => {
    test('freeTextTokens capped at 20 unique tokens', () => {
      // Generate 30 unique tokens
      const words = Array.from({ length: 30 }, (_, i) => `word${String(i).padStart(3, '0')}`).join(' ');
      const q = extractQuery('Edit', { file_path: '/a.ts', new_string: words }, CONFIG);
      assert.equal(q.freeTextTokens.length, 20);
    });
  });

  describe('Gemini CLI tools', () => {
    test('read_file extracts path field', () => {
      const q = extractQuery('read_file', { path: '/project/auth-service.js' }, CONFIG);
      assert.deepEqual(q.paths, ['/project/auth-service.js']);
      assert.ok(q.terms.some((t) => t.includes('auth') || t.includes('service')));
    });

    test('read_many_files extracts paths array', () => {
      const q = extractQuery('read_many_files', { paths: ['/project/auth.js', '/project/ledger.js'] }, CONFIG);
      assert.deepEqual(q.paths, ['/project/auth.js', '/project/ledger.js']);
    });

    test('write_file extracts file_path and content', () => {
      const q = extractQuery('write_file', {
        file_path: '/project/wiki/compile-state.js',
        content: 'export function evaluateTrigger() {}',
      }, CONFIG);
      assert.ok(q.terms.length > 0);
    });

    test('replace extracts file_path and new_string', () => {
      const q = extractQuery('replace', {
        file_path: '/project/ledger.js',
        old_string: 'old',
        new_string: 'function markInjected(session) {}',
      }, CONFIG);
      assert.ok(q.terms.some((t) => t.includes('ledger') || t.includes('mark')));
    });

    test('search_file_content extracts pattern and path', () => {
      const q = extractQuery('search_file_content', { pattern: 'acquireLock', path: '/project/scripts' }, CONFIG);
      assert.ok(q.terms.some((t) => t.includes('acquire') || t.includes('lock')));
    });

    test('run_shell_command extracts command field', () => {
      const q = extractQuery('run_shell_command', { command: 'node scripts/wiki-inbox-append.js' }, CONFIG);
      assert.ok(q.terms.some((t) => t.includes('wiki') || t.includes('inbox')));
    });
  });

  describe('Codex CLI tools', () => {
    test('apply_patch extracts file path from patch text', () => {
      const patch = '*** Begin Patch\n*** Update File: src/auth-service.js\n@@ function login() {}';
      const q = extractQuery('apply_patch', { command: patch }, CONFIG);
      assert.ok(q.paths.includes('src/auth-service.js'));
      assert.ok(q.terms.some((t) => t.includes('auth') || t.includes('service')));
    });

    test('apply_patch handles Create and Delete file markers', () => {
      const patch = '*** Create File: src/new-module.js\n*** Delete File: src/old-module.js';
      const q = extractQuery('apply_patch', { command: patch }, CONFIG);
      assert.ok(q.paths.includes('src/new-module.js'));
      assert.ok(q.paths.includes('src/old-module.js'));
    });

    test('apply_patch returns empty paths for patch with no file markers', () => {
      const q = extractQuery('apply_patch', { command: '*** Begin Patch\n@@ some change' }, CONFIG);
      assert.deepEqual(q.paths, []);
    });
  });

  describe('unknown tools work via field-based extraction', () => {
    test('unknown tool with file_path extracts path and terms', () => {
      const q = extractQuery('SomeNewTool', { file_path: '/project/auth.js' }, CONFIG);
      assert.ok(q.paths.includes('/project/auth.js'));
      assert.ok(q.terms.length > 0);
    });

    test('unknown tool with command extracts terms', () => {
      const q = extractQuery('SomeNewTool', { command: 'node scripts/build.js' }, CONFIG);
      assert.ok(q.terms.some((t) => t.includes('scripts') || t.includes('build')));
    });

    test('unknown tool with no recognizable fields returns empty terms', () => {
      const q = extractQuery('UnknownTool', { foo: 'bar' }, CONFIG);
      assert.equal(q.terms.length, 0);
    });
  });

  describe('error handling', () => {
    test('never throws on null toolInput (C15)', () => {
      assert.doesNotThrow(() => {
        const q = extractQuery('Read', null as unknown as Record<string, unknown>, CONFIG);
        assert.equal(q.terms.length, 0);
      });
    });

    test('never throws on undefined toolInput', () => {
      assert.doesNotThrow(() => {
        const q = extractQuery('Read', undefined as unknown as Record<string, unknown>, CONFIG);
        assert.equal(q.terms.length, 0);
      });
    });

    test('returns empty terms when no useful fields present (C15)', () => {
      const q = extractQuery('Read', {}, CONFIG);
      assert.equal(q.terms.length, 0);
    });

    test('deduplicates terms', () => {
      const q = extractQuery('Edit', {
        file_path: '/project/auth-service.js',
        new_string: 'auth service authentication',
      }, CONFIG);
      const termSet = new Set(q.terms);
      assert.equal(q.terms.length, termSet.size);
    });
  });
});
