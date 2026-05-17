import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { after, before, describe, test } from 'node:test';
import type { Embedder } from '../embedder.js';
import { MemoryIndexer } from '../indexer.js';
import { MemoryStore } from '../store.js';
import type { MemoryConfig } from '../types.js';

// Stub embedder — returns deterministic non-zero vectors without loading any model
class StubEmbedder implements Pick<Embedder, 'embed' | 'dimension' | 'isReady'> {
  async embed(texts: string[]): Promise<Float32Array[]> {
    return texts.map(() => new Float32Array(384).fill(0.05));
  }
  get dimension() {
    return 384 as number | undefined;
  }
  isReady() {
    return true;
  }
}

function makeConfig(memoryDir: string): MemoryConfig {
  return {
    enabled: true,
    memoryDir,
    topK: 5,
    chunkSize: 1500,
    overlapLines: 2,
    embeddingModel: 'Xenova/bge-small-en-v1.5',
    vectorDimension: 384,
  };
}

describe('MemoryIndexer', () => {
  let tmpDir: string;
  let store: MemoryStore;
  let indexer: MemoryIndexer;
  let config: MemoryConfig;

  before(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'memory-indexer-test-'));
    config = makeConfig(tmpDir);
    store = new MemoryStore(path.join(tmpDir, 'index.db'), config);
    indexer = new MemoryIndexer(store, new StubEmbedder() as unknown as Embedder, config);
  });

  after(() => {
    store.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('indexFile on new file — indexed > 0, skipped === 0', async () => {
    const filePath = path.join(tmpDir, 'new-file.md');
    fs.writeFileSync(filePath, '# New File\nThis file has some content for indexing.', 'utf8');

    const stats = await indexer.indexFile(filePath);
    assert.ok(stats.indexed > 0, `Expected indexed > 0, got ${stats.indexed}`);
    assert.equal(stats.skipped, 0);
  });

  test('indexFile on unchanged file — indexed === 0, skipped > 0', async () => {
    const filePath = path.join(tmpDir, 'stable-file.md');
    fs.writeFileSync(filePath, '# Stable\nThis content does not change between runs.', 'utf8');

    // First run indexes it
    await indexer.indexFile(filePath);

    // Second run — same content
    const stats = await indexer.indexFile(filePath);
    assert.equal(stats.indexed, 0, `Expected indexed === 0, got ${stats.indexed}`);
    assert.ok(stats.skipped > 0, `Expected skipped > 0, got ${stats.skipped}`);
  });

  test('indexFile after modification — only changed chunks re-indexed', async () => {
    const filePath = path.join(tmpDir, 'modified-file.md');
    fs.writeFileSync(filePath, '# Modified\nOriginal content.', 'utf8');
    await indexer.indexFile(filePath);

    fs.writeFileSync(filePath, '# Modified\nUpdated content that changed completely.', 'utf8');
    const stats = await indexer.indexFile(filePath);
    assert.ok(stats.indexed > 0, `Expected re-indexed chunks after modification`);
  });

  test('indexDirectory removes stale source when file is deleted', async () => {
    const staleFile = path.join(tmpDir, 'stale-file.md');
    fs.writeFileSync(staleFile, '# Stale\nThis file will be deleted.', 'utf8');
    await indexer.indexFile(staleFile);

    const staleSource = path.relative(tmpDir, staleFile);
    const before = store.hashesBySource(staleSource);
    assert.ok(before.size > 0, 'Stale file must be indexed first');

    // Delete the file and re-index the directory
    fs.unlinkSync(staleFile);
    await indexer.indexDirectory(tmpDir);

    const afterDeletion = store.hashesBySource(staleSource);
    assert.equal(afterDeletion.size, 0, 'Stale source must be removed from store after directory scan');
  });

  test('search returns result with correct source for indexed content', async () => {
    const filePath = path.join(tmpDir, 'searchable.md');
    fs.writeFileSync(filePath, '# Searchable\nspecialUniqueTermForSearch is in this document.', 'utf8');
    await indexer.indexFile(filePath);

    const results = await indexer.search('specialUniqueTermForSearch', 5);
    assert.ok(results.length > 0, 'Expected at least one search result');
    const expectedSource = path.relative(tmpDir, filePath);
    const hasCorrectSource = results.some((r) => r.chunk.source === expectedSource);
    assert.ok(hasCorrectSource, `Expected result with source=${expectedSource}, got: ${results.map((r) => r.chunk.source).join(', ')}`);
  });

  test('search on empty store returns []', async () => {
    const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'empty-store-'));
    const emptyCfg = makeConfig(emptyDir);
    const emptyStore = new MemoryStore(path.join(emptyDir, 'index.db'), emptyCfg);
    const emptyIndexer = new MemoryIndexer(emptyStore, new StubEmbedder() as unknown as Embedder, emptyCfg);

    try {
      const results = await emptyIndexer.search('anything', 5);
      assert.deepEqual(results, []);
    } finally {
      emptyStore.close();
      fs.rmSync(emptyDir, { recursive: true, force: true });
    }
  });
});
