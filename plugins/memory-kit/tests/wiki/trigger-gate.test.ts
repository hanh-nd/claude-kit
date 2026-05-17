import * as assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { shouldRun } from '../../scripts/wiki/trigger-gate.js';
import type { WikiConfig } from '@types';

function makeConfig(overrides: Partial<WikiConfig> = {}): WikiConfig {
  return {
    injectMinScore: 5.0,
    debug: false,
    injectMarginRatio: 1.5,
    injectMaxResults: 1,
    minQueryTokens: 2,
    cooldownHours: 24,
    cacheEnabled: true,
    bashAllowlist: {
      mode: 'denylist',
      patterns: [
        '^ls(\\s|$)',
        '^pwd(\\s|$)',
        '^echo(\\s|$)',
        '^cd(\\s|$)',
        '^cat(\\s|$)',
        '^git\\s+(status|log|diff|branch|show)(\\s|$)',
      ],
    },
    stopwords: ['the', 'and'],
    ...overrides,
  };
}

const EMPTY_PREFIXES = new Set<string>();

describe('shouldRun — file-write detection (path + content field)', () => {
  test('file_path + new_string → file-write', () => {
    const result = shouldRun('AnyTool', { file_path: '/project/auth.ts', new_string: 'code' }, EMPTY_PREFIXES, makeConfig());
    assert.equal(result.allow, true);
    assert.equal(result.reason, 'file-write');
  });

  test('path + content → file-write', () => {
    const result = shouldRun('write_file', { path: '/project/auth.ts', content: 'code' }, EMPTY_PREFIXES, makeConfig());
    assert.equal(result.allow, true);
    assert.equal(result.reason, 'file-write');
  });

  test('notebook_path + new_source → file-write', () => {
    const result = shouldRun('NotebookEdit', { notebook_path: '/project/nb.ipynb', new_source: 'code' }, EMPTY_PREFIXES, makeConfig());
    assert.equal(result.allow, true);
    assert.equal(result.reason, 'file-write');
  });

  test('file_path + content → file-write', () => {
    const result = shouldRun('Edit', { file_path: '/project/any.ts', content: 'x' }, EMPTY_PREFIXES, makeConfig());
    assert.equal(result.allow, true);
    assert.equal(result.reason, 'file-write');
  });

  test('tool name is irrelevant for file-write', () => {
    for (const tool of ['Edit', 'Write', 'write_file', 'replace', 'SomeFutureTool']) {
      const result = shouldRun(tool, { file_path: '/a.ts', new_string: 'x' }, EMPTY_PREFIXES, makeConfig());
      assert.equal(result.allow, true, `expected allow for tool=${tool}`);
      assert.equal(result.reason, 'file-write');
    }
  });
});

describe('shouldRun — patch-command detection', () => {
  test('*** Update File: marker → patch-command', () => {
    const command = '*** Update File: src/app.ts\n--- a\n+++ b';
    const result = shouldRun('apply_patch', { command }, EMPTY_PREFIXES, makeConfig());
    assert.equal(result.allow, true);
    assert.equal(result.reason, 'patch-command');
  });

  test('*** Create File: marker → patch-command', () => {
    const command = '*** Create File: src/new.ts\ncontent here';
    const result = shouldRun('apply_patch', { command }, EMPTY_PREFIXES, makeConfig());
    assert.equal(result.allow, true);
    assert.equal(result.reason, 'patch-command');
  });

  test('*** Delete File: marker → patch-command', () => {
    const command = '*** Delete File: src/old.ts';
    const result = shouldRun('apply_patch', { command }, EMPTY_PREFIXES, makeConfig());
    assert.equal(result.allow, true);
    assert.equal(result.reason, 'patch-command');
  });
});

describe('shouldRun — file-read detection (path only, no content)', () => {
  test('file_path with .ts extension → code-extension → allow', () => {
    const result = shouldRun('Read', { file_path: '/project/auth.ts' }, EMPTY_PREFIXES, makeConfig());
    assert.equal(result.allow, true);
    assert.equal(result.reason, 'code-extension');
  });

  test('file_path with .md extension → code-extension → allow', () => {
    const result = shouldRun('Read', { file_path: '/project/README.md' }, EMPTY_PREFIXES, makeConfig());
    assert.equal(result.allow, true);
    assert.equal(result.reason, 'code-extension');
  });

  test('path field (Gemini read_file) with .py → code-extension → allow', () => {
    const result = shouldRun('read_file', { path: '/project/main.py' }, EMPTY_PREFIXES, makeConfig());
    assert.equal(result.allow, true);
    assert.equal(result.reason, 'code-extension');
  });

  test('.bin extension with no anchor prefix → deny', () => {
    const result = shouldRun('Read', { file_path: '/project/data.bin' }, EMPTY_PREFIXES, makeConfig());
    assert.equal(result.allow, false);
    assert.equal(result.reason, 'read-no-code-ext-or-anchor-prefix');
  });

  test('.bin extension with matching anchor prefix → anchor-path-prefix → allow', () => {
    const prefixes = new Set(['/project/wiki']);
    const result = shouldRun('Read', { file_path: '/project/wiki/data.bin' }, prefixes, makeConfig());
    assert.equal(result.allow, true);
    assert.equal(result.reason, 'anchor-path-prefix');
  });

  test('paths[0] array field is used as file path', () => {
    const result = shouldRun('read_many_files', { paths: ['/project/auth.ts'] }, EMPTY_PREFIXES, makeConfig());
    assert.equal(result.allow, true);
    assert.equal(result.reason, 'code-extension');
  });
});

describe('shouldRun — bash/command detection', () => {
  const BASH_DENIES = ['ls', 'pwd', 'git status', 'git log --oneline', 'cat foo.ts', 'cd ..', 'echo hi'];
  for (const cmd of BASH_DENIES) {
    test(`denies denylist command: "${cmd}"`, () => {
      const result = shouldRun('Bash', { command: cmd }, EMPTY_PREFIXES, makeConfig());
      assert.equal(result.allow, false);
    });
  }

  test('allows: node scripts/x.js', () => {
    const result = shouldRun('Bash', { command: 'node scripts/x.js' }, EMPTY_PREFIXES, makeConfig());
    assert.equal(result.allow, true);
    assert.equal(result.reason, 'bash-denylist-pass');
  });

  test('cmd field works same as command (Gemini run_shell_command)', () => {
    const result = shouldRun('run_shell_command', { cmd: 'npm test' }, EMPTY_PREFIXES, makeConfig());
    assert.equal(result.allow, true);
    assert.equal(result.reason, 'bash-denylist-pass');
  });

  test('denies command of length 3 (too short)', () => {
    const result = shouldRun('Bash', { command: 'abc' }, EMPTY_PREFIXES, makeConfig());
    assert.equal(result.allow, false);
    assert.equal(result.reason, 'bash-too-short');
  });

  test('skips malformed regex pattern — valid patterns in list still apply', () => {
    const config = makeConfig({
      bashAllowlist: { mode: 'denylist', patterns: ['[invalid(regex', '^ls(\\s|$)'] },
    });
    // Invalid pattern is skipped; '^ls(\s|$)' still denies 'ls'
    const denied = shouldRun('Bash', { command: 'ls' }, EMPTY_PREFIXES, config);
    assert.equal(denied.allow, false);
    // 'node ...' passes the remaining valid denylist
    const allowed = shouldRun('Bash', { command: 'node scripts/build.js' }, EMPTY_PREFIXES, config);
    assert.equal(allowed.allow, true);
    assert.equal(allowed.reason, 'bash-denylist-pass');
  });

  test('all-invalid pattern list allows all commands (denylist with no valid patterns)', () => {
    const config = makeConfig({
      bashAllowlist: { mode: 'denylist', patterns: ['[invalid(regex'] },
    });
    const result = shouldRun('Bash', { command: 'node scripts/build.js' }, EMPTY_PREFIXES, config);
    assert.equal(result.allow, true);
    assert.equal(result.reason, 'bash-denylist-pass');
  });

  test('allowlist mode: allows matching command', () => {
    const config = makeConfig({
      bashAllowlist: { mode: 'allowlist', patterns: ['^npm\\s'] },
    });
    const result = shouldRun('Bash', { command: 'npm test' }, EMPTY_PREFIXES, config);
    assert.equal(result.allow, true);
    assert.equal(result.reason, 'bash-allowlist-match');
  });

  test('allowlist mode: denies non-matching command', () => {
    const config = makeConfig({
      bashAllowlist: { mode: 'allowlist', patterns: ['^npm\\s'] },
    });
    const result = shouldRun('Bash', { command: 'node scripts/build.js' }, EMPTY_PREFIXES, config);
    assert.equal(result.allow, false);
    assert.equal(result.reason, 'bash-allowlist-no-match');
  });
});

describe('shouldRun — no recognizable fields', () => {
  test('empty input → no-recognizable-fields', () => {
    const result = shouldRun('Grep', {}, EMPTY_PREFIXES, makeConfig());
    assert.equal(result.allow, false);
    assert.equal(result.reason, 'no-recognizable-fields');
  });

  test('unknown fields only → no-recognizable-fields', () => {
    const result = shouldRun('WebSearch', { query: 'something', limit: 10 }, EMPTY_PREFIXES, makeConfig());
    assert.equal(result.allow, false);
    assert.equal(result.reason, 'no-recognizable-fields');
  });

  test('tool name does not matter when no fields match', () => {
    for (const tool of ['Glob', 'Grep', 'LS', 'WebFetch', 'WebSearch', 'TodoWrite', 'AgentTool', 'ExitPlanMode']) {
      const result = shouldRun(tool, {}, EMPTY_PREFIXES, makeConfig());
      assert.equal(result.allow, false, `expected deny for tool=${tool}`);
      assert.equal(result.reason, 'no-recognizable-fields');
    }
  });
});

describe('shouldRun — provider-agnostic (Gemini & Codex field shapes)', () => {
  test('Gemini write_file (path + content) → file-write', () => {
    const result = shouldRun('write_file', { path: '/src/app.ts', content: 'code' }, EMPTY_PREFIXES, makeConfig());
    assert.equal(result.allow, true);
    assert.equal(result.reason, 'file-write');
  });

  test('Gemini read_file (path only) with code ext → code-extension', () => {
    const result = shouldRun('read_file', { path: '/src/app.ts' }, EMPTY_PREFIXES, makeConfig());
    assert.equal(result.allow, true);
    assert.equal(result.reason, 'code-extension');
  });

  test('Gemini run_shell_command (cmd) passes denylist → allow', () => {
    const result = shouldRun('run_shell_command', { cmd: 'npx tsc --noEmit' }, EMPTY_PREFIXES, makeConfig());
    assert.equal(result.allow, true);
    assert.equal(result.reason, 'bash-denylist-pass');
  });

  test('Codex apply_patch with patch marker → patch-command', () => {
    const result = shouldRun('apply_patch', { command: '*** Update File: foo.ts\nfix' }, EMPTY_PREFIXES, makeConfig());
    assert.equal(result.allow, true);
    assert.equal(result.reason, 'patch-command');
  });
});
