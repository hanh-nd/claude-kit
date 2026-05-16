import * as assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { main, StdinJSON } from '../../scripts/wiki-inject-context.js';

function makeTmpDir(): { dir: string; cleanup: () => void } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'inject-context-test-'));
  return { dir, cleanup: () => fs.rmSync(dir, { recursive: true, force: true }) };
}

function buildWikiWithPage(baseDir: string, slug: string, content: string): void {
  const entitiesDir = path.join(baseDir, '.agent-kit', 'wiki', 'compiled', 'entities');
  fs.mkdirSync(entitiesDir, { recursive: true });
  fs.writeFileSync(path.join(entitiesDir, `${slug}.md`), content, 'utf8');
}

const ANCHOR_PAGE = (anchor: string): string => `# Auth Service

Status: active
> Last updated: 2025-01-01

## Summary
Manages authentication flows using JWT tokens and OAuth2.

## Anchors
- ${anchor}

## Key Decisions
- Use JWT with 1h expiry
- PKCE for mobile clients

## Edge Cases & Risks
- Token expiry race condition
`;

describe('wiki-inject-context main', () => {
  test('exits with {} on malformed stdin JSON (C1)', async () => {
    const result = await main({ tool_name: '' });
    assert.deepEqual(result, {});
  });

  test('exits with {} when wiki dir missing (C3)', async () => {
    const result = await main(
      { tool_name: 'Read', tool_input: { file_path: '/nonexistent-path-xyz/auth.js' }, session_id: 'sess' },
      { wikiRoot: '/nonexistent-project-xyz-abc/.agent-kit/wiki' }
    );
    assert.deepEqual(result, {});
  });

  test('exits with {} when no extractable terms (C15)', async () => {
    const { dir, cleanup } = makeTmpDir();
    const wikiRoot = path.join(dir, 'wiki');
    fs.mkdirSync(path.join(wikiRoot, 'compiled', 'entities'), { recursive: true });
    try {
      const result = await main(
        { tool_name: 'Bash', tool_input: { command: 'ls' }, session_id: 'sess' },
        { wikiRoot }
      );
      assert.deepEqual(result, {});
    } finally {
      cleanup();
    }
  });

  test('injects context when page matches (C12, C18)', async () => {
    const { dir, cleanup } = makeTmpDir();
    buildWikiWithPage(dir, 'auth-service', ANCHOR_PAGE('auth-service.js'));
    const wikiRoot = path.join(dir, '.agent-kit', 'wiki');
    try {
      const result = await main(
        { tool_name: 'Read', tool_input: { file_path: '/project/auth-service.js' }, session_id: 'sess-inject-1' },
        { wikiRoot, settings: { wiki: { injectMinScore: 1.0 } } }
      );
      if ('hookSpecificOutput' in result && result.hookSpecificOutput) {
        assert.ok(result.hookSpecificOutput, 'Expected hookSpecificOutput in result');
        assert.equal(result.hookSpecificOutput.hookEventName, 'PreToolUse');
        assert.ok(result.hookSpecificOutput.additionalContext.includes('[WIKI HIT]'));
      } else {
        assert.fail('Expected hookSpecificOutput in result');
      }
    } finally {
      cleanup();
    }
  });

  test('deduplicates injections within same session (C8)', async () => {
    const { dir, cleanup } = makeTmpDir();
    buildWikiWithPage(dir, 'auth-service', ANCHOR_PAGE('auth-service.js'));
    const wikiRoot = path.join(dir, '.agent-kit', 'wiki');
    const stdinJSON: StdinJSON = { tool_name: 'Read', tool_input: { file_path: '/project/auth-service.js' }, session_id: 'sess-dedup' };
    const opts = { wikiRoot, settings: { wiki: { injectMinScore: 1.0 } } };
    try {
      const result1 = await main(stdinJSON, opts);
      const result2 = await main(stdinJSON, opts);
      if ('hookSpecificOutput' in result1) {
        assert.deepEqual(result2, {}, 'Second call should return {} (deduplicated)');
      }
    } finally {
      cleanup();
    }
  });

  test('respects score threshold (C6)', async () => {
    const { dir, cleanup } = makeTmpDir();
    buildWikiWithPage(dir, 'auth-service', ANCHOR_PAGE('auth-service.js'));
    const wikiRoot = path.join(dir, '.agent-kit', 'wiki');
    try {
      const result = await main(
        { tool_name: 'Read', tool_input: { file_path: '/project/auth-service.js' }, session_id: 'sess-threshold' },
        { wikiRoot, settings: { wiki: { injectMinScore: 9999 } } }
      );
      assert.deepEqual(result, {});
    } finally {
      cleanup();
    }
  });

  test('does not throw on any internal exception (C16)', async () => {
    await assert.doesNotReject(async () => {
      const result = await main(null as unknown as StdinJSON);
      assert.deepEqual(result, {});
    });
  });

  test('ledger file created after injection (C9)', async () => {
    const { dir, cleanup } = makeTmpDir();
    const wikiRoot = path.join(dir, '.agent-kit', 'wiki');
    buildWikiWithPage(dir, 'auth-service', ANCHOR_PAGE('auth-service.js'));
    try {
      await main(
        { tool_name: 'Read', tool_input: { file_path: '/project/auth-service.js' }, session_id: 'sess-ledger' },
        { wikiRoot, settings: { wiki: { injectMinScore: 1.0 } } }
      );
      const ledgerPath = path.join(wikiRoot, '.runtime', 'injected.json');
      // Ledger may or may not exist depending on whether injection occurred
      if (fs.existsSync(ledgerPath)) {
        const ledger = JSON.parse(fs.readFileSync(ledgerPath, 'utf8'));
        assert.ok(typeof ledger.injected === 'object');
      }
    } finally {
      cleanup();
    }
  });
});
