import * as assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { loadAllPages } from '../../scripts/wiki/load-pages.js';

function buildWikiDir(baseDir, opts = {}) {
  const { compiledPages = {}, inboxContent = null } = opts;

  const categories = ['entities', 'concepts', 'glossary', 'preferences'];
  for (const cat of categories) {
    fs.mkdirSync(path.join(baseDir, 'wiki', 'compiled', cat), { recursive: true });
  }
  fs.mkdirSync(path.join(baseDir, 'wiki', 'raw'), { recursive: true });

  for (const [relPath, content] of Object.entries(compiledPages)) {
    const absPath = path.join(baseDir, 'wiki', 'compiled', relPath);
    fs.mkdirSync(path.dirname(absPath), { recursive: true });
    fs.writeFileSync(absPath, content, 'utf8');
  }

  if (inboxContent !== null) {
    fs.writeFileSync(path.join(baseDir, 'wiki', 'raw', 'inbox.md'), inboxContent, 'utf8');
  }

  return path.join(baseDir, 'wiki');
}

function makeTmpDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'load-pages-test-'));
  return { dir, cleanup: () => fs.rmSync(dir, { recursive: true, force: true }) };
}

describe('loadAllPages', () => {
  test('returns empty array for missing wiki root (C3)', () => {
    const pages = loadAllPages('/nonexistent/wiki');
    assert.deepEqual(pages, []);
  });

  test('loads pages from compiled categories', () => {
    const { dir, cleanup } = makeTmpDir();
    try {
      const wikiRoot = buildWikiDir(dir, {
        compiledPages: {
          'entities/auth-service.md': '# Auth Service\n\nStatus: active\n',
          'concepts/jwt-tokens.md': '# JWT Tokens\n\nStatus: complete\n',
        },
      });
      const pages = loadAllPages(wikiRoot);
      assert.equal(pages.length, 2);
      const slugs = pages.map((p) => p.slug);
      assert.ok(slugs.includes('auth-service'));
      assert.ok(slugs.includes('jwt-tokens'));
    } finally {
      cleanup();
    }
  });

  test('falls back to inbox.md when compiled dirs empty (C4)', () => {
    const { dir, cleanup } = makeTmpDir();
    try {
      const inboxContent = '## [2025-01-01T00:00:00] handoff | plan-feature\n- type: plan\n- slug: feature\n- summary: A handoff summary\n';
      const wikiRoot = buildWikiDir(dir, { inboxContent });
      const pages = loadAllPages(wikiRoot);
      assert.equal(pages.length, 1);
      assert.equal(pages[0].category, 'inbox');
    } finally {
      cleanup();
    }
  });

  test('skips non-.md files', () => {
    const { dir, cleanup } = makeTmpDir();
    try {
      const wikiRoot = buildWikiDir(dir, {
        compiledPages: {
          'entities/auth-service.md': '# Auth Service\n',
          'entities/README.txt': 'not a page',
        },
      });
      const pages = loadAllPages(wikiRoot);
      assert.equal(pages.length, 1);
    } finally {
      cleanup();
    }
  });

  test('tolerates missing category directories', () => {
    const { dir, cleanup } = makeTmpDir();
    try {
      fs.mkdirSync(path.join(dir, 'wiki', 'compiled', 'entities'), { recursive: true });
      fs.mkdirSync(path.join(dir, 'wiki', 'raw'), { recursive: true });
      fs.writeFileSync(path.join(dir, 'wiki', 'compiled', 'entities', 'page.md'), '# Page\n', 'utf8');
      const wikiRoot = path.join(dir, 'wiki');
      const pages = loadAllPages(wikiRoot);
      assert.equal(pages.length, 1);
    } finally {
      cleanup();
    }
  });

  test('returns parseable pages', () => {
    const { dir, cleanup } = makeTmpDir();
    try {
      const wikiRoot = buildWikiDir(dir, {
        compiledPages: {
          'entities/user-model.md': `# User Model\n\nStatus: active\n> Last updated: 2025-01-01\n\n## Summary\nRepresents a user.\n`,
        },
      });
      const pages = loadAllPages(wikiRoot);
      assert.equal(pages.length, 1);
      assert.equal(pages[0].title, 'User Model');
      assert.equal(pages[0].status, 'active');
    } finally {
      cleanup();
    }
  });
});
