import * as assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { extractQuery } from '../../scripts/wiki/extract-query.js';

describe('extractQuery', () => {
  describe('Read tool', () => {
    test('extracts terms from file_path', () => {
      const q = extractQuery('Read', { file_path: '/project/auth-service.js' });
      assert.ok(q.terms.length > 0);
      assert.ok(q.terms.some((t) => t.includes('auth') || t.includes('service')));
    });

    test('captures path', () => {
      const q = extractQuery('Read', { file_path: '/project/auth-service.js' });
      assert.deepEqual(q.paths, ['/project/auth-service.js']);
    });
  });

  describe('Edit tool', () => {
    test('extracts from file_path and new_string', () => {
      const q = extractQuery('Edit', {
        file_path: '/project/ledger.js',
        new_string: 'function markInjected(session) {}',
      });
      assert.ok(q.terms.some((t) => t.includes('ledger') || t.includes('mark') || t.includes('injected') || t.includes('session')));
    });

    test('limits new_string to 200 chars', () => {
      const longStr = 'x'.repeat(1000);
      const q = extractQuery('Edit', { file_path: '/a.js', new_string: longStr });
      assert.ok(q.freeText.length <= 200);
    });
  });

  describe('Write tool', () => {
    test('extracts from file_path and content', () => {
      const q = extractQuery('Write', {
        file_path: '/project/wiki/compile-state.js',
        content: 'export function evaluateTrigger() {}',
      });
      assert.ok(q.terms.length > 0);
    });
  });

  describe('Grep tool', () => {
    test('extracts from pattern and path', () => {
      const q = extractQuery('Grep', { pattern: 'acquireLock', path: '/project/scripts' });
      assert.ok(q.terms.some((t) => t.includes('acquirelock') || t.includes('acquire')));
    });
  });

  describe('Bash tool', () => {
    test('returns empty terms for "ls" command (C7)', () => {
      const q = extractQuery('Bash', { command: 'ls' });
      assert.equal(q.terms.length, 0);
    });

    test('extracts meaningful terms from complex command', () => {
      const q = extractQuery('Bash', { command: 'node scripts/wiki-inbox-append.js --debug' });
      assert.ok(q.terms.some((t) => t.includes('wiki') || t.includes('inbox') || t.includes('append')));
    });
  });

  describe('Gemini CLI tools', () => {
    test('read_file extracts path field', () => {
      const q = extractQuery('read_file', { path: '/project/auth-service.js' });
      assert.deepEqual(q.paths, ['/project/auth-service.js']);
      assert.ok(q.terms.some((t) => t.includes('auth') || t.includes('service')));
    });

    test('read_many_files extracts paths array', () => {
      const q = extractQuery('read_many_files', { paths: ['/project/auth.js', '/project/ledger.js'] });
      assert.deepEqual(q.paths, ['/project/auth.js', '/project/ledger.js']);
    });

    test('write_file extracts file_path and content', () => {
      const q = extractQuery('write_file', {
        file_path: '/project/wiki/compile-state.js',
        content: 'export function evaluateTrigger() {}',
      });
      assert.ok(q.terms.length > 0);
    });

    test('replace extracts file_path and new_string', () => {
      const q = extractQuery('replace', {
        file_path: '/project/ledger.js',
        old_string: 'old',
        new_string: 'function markInjected(session) {}',
      });
      assert.ok(q.terms.some((t) => t.includes('ledger') || t.includes('mark')));
    });

    test('search_file_content extracts pattern and path', () => {
      const q = extractQuery('search_file_content', { pattern: 'acquireLock', path: '/project/scripts' });
      assert.ok(q.terms.some((t) => t.includes('acquire')));
    });

    test('run_shell_command extracts command field', () => {
      const q = extractQuery('run_shell_command', { command: 'node scripts/wiki-inbox-append.js' });
      assert.ok(q.terms.some((t) => t.includes('wiki') || t.includes('inbox')));
    });
  });

  describe('Codex CLI tools', () => {
    test('apply_patch extracts file path from patch text', () => {
      const patch = '*** Begin Patch\n*** Update File: src/auth-service.js\n@@ function login() {}';
      const q = extractQuery('apply_patch', { command: patch });
      assert.ok(q.paths.includes('src/auth-service.js'));
      assert.ok(q.terms.some((t) => t.includes('auth') || t.includes('service')));
    });

    test('apply_patch handles Create and Delete file markers', () => {
      const patch = '*** Create File: src/new-module.js\n*** Delete File: src/old-module.js';
      const q = extractQuery('apply_patch', { command: patch });
      assert.ok(q.paths.includes('src/new-module.js'));
      assert.ok(q.paths.includes('src/old-module.js'));
    });

    test('apply_patch returns empty paths for patch with no file markers', () => {
      const q = extractQuery('apply_patch', { command: '*** Begin Patch\n@@ some change' });
      assert.deepEqual(q.paths, []);
    });
  });

  describe('unknown tools work via field-based extraction', () => {
    test('unknown tool with file_path extracts path and terms', () => {
      const q = extractQuery('SomeNewTool', { file_path: '/project/auth.js' });
      assert.ok(q.paths.includes('/project/auth.js'));
      assert.ok(q.terms.length > 0);
    });

    test('unknown tool with command extracts terms', () => {
      const q = extractQuery('SomeNewTool', { command: 'node scripts/build.js' });
      assert.ok(q.terms.some((t) => t.includes('scripts') || t.includes('build')));
    });

    test('unknown tool with no recognizable fields returns empty terms', () => {
      const q = extractQuery('UnknownTool', { foo: 'bar' });
      assert.equal(q.terms.length, 0);
    });
  });

  describe('error handling', () => {
    test('never throws on null toolInput (C15)', () => {
      assert.doesNotThrow(() => {
        const q = extractQuery('Read', null as unknown as Record<string, unknown>);
        assert.equal(q.terms.length, 0);
      });
    });

    test('never throws on undefined toolInput', () => {
      assert.doesNotThrow(() => {
        const q = extractQuery('Read', undefined as unknown as Record<string, unknown>);
        assert.equal(q.terms.length, 0);
      });
    });

    test('returns empty terms when no useful fields present (C15)', () => {
      const q = extractQuery('Read', {});
      assert.equal(q.terms.length, 0);
    });

    test('deduplicates terms', () => {
      const q = extractQuery('Edit', {
        file_path: '/project/auth-service.js',
        new_string: 'auth service authentication',
      });
      const termSet = new Set(q.terms);
      assert.equal(q.terms.length, termSet.size);
    });
  });
});
