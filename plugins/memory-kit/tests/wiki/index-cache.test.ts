import * as assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { loadOrBuildIndex, INDEX_FILE } from '../../scripts/wiki/index-cache.js';
import type { WikiConfig } from '@types';

function makeTmpDir(): { dir: string; cleanup: () => void } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'index-cache-test-'));
  return { dir, cleanup: () => fs.rmSync(dir, { recursive: true, force: true }) };
}

function makeConfig(overrides: Partial<WikiConfig> = {}): WikiConfig {
  return {
    injectMinScore: 5.0,
    debug: false,
    injectMarginRatio: 1.5,
    injectMaxResults: 1,
    minQueryTokens: 2,
    cooldownHours: 24,
    cacheEnabled: true,
    bashAllowlist: { mode: 'denylist', patterns: [] },
    stopwords: ['the', 'and', 'for'],
    ...overrides,
  };
}

function writeTestPage(dir: string, category: string, slug: string, content: string): string {
  const catDir = path.join(dir, 'compiled', category);
  fs.mkdirSync(catDir, { recursive: true });
  const filePath = path.join(catDir, `${slug}.md`);
  fs.writeFileSync(filePath, content, 'utf8');
  return filePath;
}

const SAMPLE_PAGE = `# Auth Service

Status: active
> Last updated: 2025-01-01

## Summary
Handles authentication flows using JWT tokens.

## Anchors
- auth-service.js

## Key Decisions
- Use JWT with 1h expiry
`;

describe('loadOrBuildIndex', () => {
  test('cold build creates index.json', () => {
    const { dir, cleanup } = makeTmpDir();
    try {
      writeTestPage(dir, 'entities', 'auth-service', SAMPLE_PAGE);
      const config = makeConfig();
      const index = loadOrBuildIndex(dir, config);

      assert.equal(index.schemaVersion, 1);
      assert.ok(index.pages.length > 0);
      assert.ok(typeof index.idf === 'object');
      assert.ok(index.avgBodyLength > 0);

      const indexPath = path.join(dir, INDEX_FILE);
      assert.ok(fs.existsSync(indexPath));
    } finally {
      cleanup();
    }
  });

  test('warm load reuses unchanged entries without re-parsing', () => {
    const { dir, cleanup } = makeTmpDir();
    try {
      const filePath = writeTestPage(dir, 'entities', 'auth-service', SAMPLE_PAGE);
      const config = makeConfig();

      // Cold build
      const index1 = loadOrBuildIndex(dir, config);
      const mtime1 = fs.statSync(filePath).mtimeMs;

      // Warm load - mtime unchanged
      const index2 = loadOrBuildIndex(dir, config);

      assert.equal(index1.pages.length, index2.pages.length);
      assert.equal(index2.pages[0].mtimeMs, mtime1);
    } finally {
      cleanup();
    }
  });

  test('mtime-bumped page triggers single-page re-parse', () => {
    const { dir, cleanup } = makeTmpDir();
    try {
      const filePath = writeTestPage(dir, 'entities', 'auth-service', SAMPLE_PAGE);
      const config = makeConfig();
      writeTestPage(dir, 'entities', 'other-page', '# Other\n\nStatus: active\n\n## Summary\nOther page.');

      // Cold build
      loadOrBuildIndex(dir, config);

      // Bump mtime on one page
      const futureTime = new Date(Date.now() + 10000);
      fs.utimesSync(filePath, futureTime, futureTime);
      fs.writeFileSync(filePath, SAMPLE_PAGE + '\nExtra content here for update.', 'utf8');

      // Warm load should re-parse the bumped page
      const index2 = loadOrBuildIndex(dir, config);
      assert.equal(index2.pages.length, 2);
    } finally {
      cleanup();
    }
  });

  test('corrupt cache triggers cold rebuild', () => {
    const { dir, cleanup } = makeTmpDir();
    try {
      writeTestPage(dir, 'entities', 'auth-service', SAMPLE_PAGE);
      const config = makeConfig();
      const indexPath = path.join(dir, INDEX_FILE);

      fs.mkdirSync(path.dirname(indexPath), { recursive: true });
      fs.writeFileSync(indexPath, 'not valid json{{{{', 'utf8');

      const index = loadOrBuildIndex(dir, config);
      assert.equal(index.schemaVersion, 1);
      assert.ok(index.pages.length > 0);
    } finally {
      cleanup();
    }
  });

  test('schemaVersion !== 1 triggers cold rebuild', () => {
    const { dir, cleanup } = makeTmpDir();
    try {
      writeTestPage(dir, 'entities', 'auth-service', SAMPLE_PAGE);
      const config = makeConfig();
      const indexPath = path.join(dir, INDEX_FILE);

      fs.mkdirSync(path.dirname(indexPath), { recursive: true });
      fs.writeFileSync(indexPath, JSON.stringify({ schemaVersion: 2, pages: [], idf: {}, avgBodyLength: 0, builtAt: '' }), 'utf8');

      const index = loadOrBuildIndex(dir, config);
      assert.equal(index.schemaVersion, 1);
      assert.ok(index.pages.length > 0);
    } finally {
      cleanup();
    }
  });

  test('cacheEnabled=false bypasses I/O', () => {
    const { dir, cleanup } = makeTmpDir();
    try {
      writeTestPage(dir, 'entities', 'auth-service', SAMPLE_PAGE);
      const config = makeConfig({ cacheEnabled: false });

      loadOrBuildIndex(dir, config);

      const indexPath = path.join(dir, INDEX_FILE);
      assert.ok(!fs.existsSync(indexPath));
    } finally {
      cleanup();
    }
  });

  test('deleted page drops from cache', () => {
    const { dir, cleanup } = makeTmpDir();
    try {
      const filePath = writeTestPage(dir, 'entities', 'auth-service', SAMPLE_PAGE);
      writeTestPage(dir, 'entities', 'other-page', '# Other\n\nStatus: active\n\n## Summary\nOther.');
      const config = makeConfig();

      loadOrBuildIndex(dir, config);

      // Delete one page
      fs.unlinkSync(filePath);

      const index2 = loadOrBuildIndex(dir, config);
      assert.ok(index2.pages.every((p) => p.slug !== 'auth-service'));
    } finally {
      cleanup();
    }
  });

  test('stopwords config change invalidates cache and triggers cold rebuild', () => {
    const { dir, cleanup } = makeTmpDir();
    try {
      writeTestPage(dir, 'entities', 'auth-service', SAMPLE_PAGE);
      const config1 = makeConfig({ stopwords: ['the', 'and'] });
      const index1 = loadOrBuildIndex(dir, config1);
      assert.equal(index1.stopwordsHash, 'and,the');

      // Change stopwords — cache must be invalidated
      const config2 = makeConfig({ stopwords: ['the', 'and', 'for', 'with'] });
      const index2 = loadOrBuildIndex(dir, config2);
      assert.equal(index2.stopwordsHash, 'and,for,the,with');
      assert.ok(index2.pages.length > 0);
    } finally {
      cleanup();
    }
  });

  test('cold build includes avgSlugLen, avgHeadingLen, avgKdLen', () => {
    const { dir, cleanup } = makeTmpDir();
    try {
      writeTestPage(dir, 'entities', 'auth-service', SAMPLE_PAGE);
      const config = makeConfig();
      const index = loadOrBuildIndex(dir, config);
      assert.ok(typeof index.avgSlugLen === 'number');
      assert.ok(typeof index.avgHeadingLen === 'number');
      assert.ok(typeof index.avgKdLen === 'number');
    } finally {
      cleanup();
    }
  });

  test('write failure does not crash (returns in-memory index)', () => {
    const { dir, cleanup } = makeTmpDir();
    try {
      writeTestPage(dir, 'entities', 'auth-service', SAMPLE_PAGE);
      const config = makeConfig();

      // Make the .runtime dir a file to force write failure
      const runtimeDir = path.join(dir, '.runtime');
      fs.writeFileSync(runtimeDir, 'block', 'utf8');

      assert.doesNotThrow(() => {
        const index = loadOrBuildIndex(dir, config);
        assert.ok(index.pages.length > 0);
      });
    } finally {
      cleanup();
    }
  });
});
