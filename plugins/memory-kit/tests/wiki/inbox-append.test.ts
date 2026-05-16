import * as assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { buildInboxEntry, InboxToolInput } from '../../scripts/wiki-inbox-append.js';

function makeTmpDir(): { dir: string; cleanup: () => void } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'inbox-append-test-'));
  return { dir, cleanup: () => fs.rmSync(dir, { recursive: true, force: true }) };
}

describe('buildInboxEntry', () => {
  test('returns null when type missing', () => {
    assert.equal(buildInboxEntry({ slug: 'test' }), null);
  });

  test('returns null when slug missing', () => {
    assert.equal(buildInboxEntry({ type: 'plan' }), null);
  });

  test('returns null when input null', () => {
    assert.equal(buildInboxEntry(null as unknown as InboxToolInput), null);
  });

  test('builds entry with required fields', () => {
    const entry = buildInboxEntry({ type: 'plan', slug: 'my-feature', content: '## Summary\nThis is a feature plan.' });
    assert.ok(entry !== null);
    assert.ok(entry.includes('handoff | plan-my-feature'));
    assert.ok(entry.includes('- type: plan'));
    assert.ok(entry.includes('- slug: my-feature'));
  });

  test('includes summary from first ## heading', () => {
    const entry = buildInboxEntry({ type: 'plan', slug: 'feature', content: '## My Feature Summary\nDetails here.' });
    assert.ok(entry !== null);
    assert.ok(entry.includes('My Feature Summary'));
  });

  test('falls back to first 100 chars when no ## heading', () => {
    const longContent = 'A'.repeat(200);
    const entry = buildInboxEntry({ type: 'plan', slug: 'feature', content: longContent });
    assert.ok(entry !== null);
    assert.ok(entry.includes('- summary:'));
  });
});
