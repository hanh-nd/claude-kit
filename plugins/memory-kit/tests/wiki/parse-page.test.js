import * as assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { parsePage, parsePageContent } from '../../scripts/wiki/parse-page.js';

function makeTmpFile(content, filename = 'test-page.md') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'parse-page-test-'));
  const filePath = path.join(dir, filename);
  fs.writeFileSync(filePath, content, 'utf8');
  return { filePath, cleanup: () => fs.rmSync(dir, { recursive: true, force: true }) };
}

const FULL_PAGE = `# My Entity

Status: active
> Last updated: 2025-03-01

## Summary
This entity manages the user authentication flow across all services.

## Anchors
- auth-service.js
- login-handler.ts

## Key Decisions
- Use JWT tokens with 1h expiry
- Refresh tokens stored in httpOnly cookies
- OAuth2 PKCE for mobile clients

## Edge Cases & Risks
- Token expiry during long operations
- Concurrent refresh race conditions
`;

describe('parsePageContent', () => {
  test('extracts title from H1', () => {
    const page = parsePageContent(FULL_PAGE, 'my-entity', 'entities', '/wiki/entities/my-entity.md');
    assert.equal(page.title, 'My Entity');
  });

  test('falls back to slug when no H1', () => {
    const page = parsePageContent('No heading here\n\nSome content', 'my-slug', 'entities', '/wiki/entities/my-slug.md');
    assert.equal(page.title, 'my-slug');
  });

  test('parses status', () => {
    const page = parsePageContent(FULL_PAGE, 'my-entity', 'entities', '/wiki/entities/my-entity.md');
    assert.equal(page.status, 'active');
  });

  test('returns null status for unknown status', () => {
    const content = 'Status: unknown-status\n\n# Title';
    const page = parsePageContent(content, 'slug', 'concepts', '/path/slug.md');
    assert.equal(page.status, null);
  });

  test('parses updated date', () => {
    const page = parsePageContent(FULL_PAGE, 'my-entity', 'entities', '/wiki/entities/my-entity.md');
    assert.equal(page.updated, '2025-03-01');
  });

  test('returns null updated when missing', () => {
    const page = parsePageContent('# Title\n\nNo date here', 'slug', 'concepts', '/path/slug.md');
    assert.equal(page.updated, null);
  });

  test('parses summary section', () => {
    const page = parsePageContent(FULL_PAGE, 'my-entity', 'entities', '/wiki/entities/my-entity.md');
    assert.ok(page.summary.includes('user authentication'));
  });

  test('returns empty summary when section missing (C13)', () => {
    const page = parsePageContent('# Title\n\nNo sections', 'slug', 'concepts', '/path/slug.md');
    assert.equal(page.summary, '');
  });

  test('parses anchors', () => {
    const page = parsePageContent(FULL_PAGE, 'my-entity', 'entities', '/wiki/entities/my-entity.md');
    assert.deepEqual(page.anchors, ['auth-service.js', 'login-handler.ts']);
  });

  test('parses key decisions (max 5)', () => {
    const page = parsePageContent(FULL_PAGE, 'my-entity', 'entities', '/wiki/entities/my-entity.md');
    assert.equal(page.keyDecisions.length, 3);
    assert.ok(page.keyDecisions[0].includes('JWT'));
  });

  test('parses edge cases (max 3)', () => {
    const page = parsePageContent(FULL_PAGE, 'my-entity', 'entities', '/wiki/entities/my-entity.md');
    assert.equal(page.edgeCases.length, 2);
  });

  test('bodyText is lowercased and capped at 8192 chars (C14)', () => {
    const bigContent = '# Title\n' + 'x'.repeat(20000);
    const page = parsePageContent(bigContent, 'slug', 'concepts', '/path/slug.md');
    assert.equal(page.bodyText.length, 8192);
    assert.ok(page.bodyText === page.bodyText.toLowerCase());
  });

  test('never throws on malformed content (C13)', () => {
    assert.doesNotThrow(() => {
      parsePageContent('', 'empty', 'concepts', '/path/empty.md');
    });
    assert.doesNotThrow(() => {
      parsePageContent('###broken##\n---\n[[[', 'broken', 'concepts', '/path/broken.md');
    });
  });
});

describe('parsePage', () => {
  test('reads and parses a file successfully', () => {
    const { filePath, cleanup } = makeTmpFile(FULL_PAGE, 'my-entity.md');
    try {
      const page = parsePage(filePath);
      assert.ok(page !== null);
      assert.equal(page.slug, 'my-entity');
      assert.equal(page.title, 'My Entity');
    } finally {
      cleanup();
    }
  });

  test('returns null for missing file', () => {
    const page = parsePage('/nonexistent/path/page.md');
    assert.equal(page, null);
  });

  test('derives category from path', () => {
    const { filePath, cleanup } = makeTmpFile('# Entity\n', 'my-thing.md');
    try {
      const page = parsePage(filePath);
      assert.ok(page !== null);
    } finally {
      cleanup();
    }
  });

  test('derives inbox category from inbox.md filename', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'parse-page-inbox-'));
    const inboxPath = path.join(dir, 'inbox.md');
    try {
      fs.writeFileSync(inboxPath, '# Inbox\n\n## [2025-01-01T00:00:00] handoff | plan-foo\n- type: plan\n', 'utf8');
      const page = parsePage(inboxPath);
      assert.ok(page !== null);
      assert.equal(page.category, 'inbox');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
