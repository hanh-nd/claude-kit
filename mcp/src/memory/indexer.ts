import * as fs from 'fs';
import * as path from 'path';
import { chunkMarkdown } from './chunker.js';
import type { Embedder } from './embedder.js';
import type { MemoryStore } from './store.js';
import type { IndexStats, MemoryConfig, SearchResult } from './types.js';

const LOCK_RETRY_MS = 50;
const LOCK_TIMEOUT_MS = 500;

async function acquireLock(lockPath: string): Promise<boolean> {
  const deadline = Date.now() + LOCK_TIMEOUT_MS;
  while (Date.now() < deadline) {
    try {
      fs.writeFileSync(lockPath, String(process.pid), { flag: 'wx' });
      return true;
    } catch {
      await new Promise((r) => setTimeout(r, LOCK_RETRY_MS));
    }
  }
  return false;
}

function releaseLock(lockPath: string): void {
  try {
    fs.unlinkSync(lockPath);
  } catch {
    // ignore
  }
}

export class MemoryIndexer {
  private _ready = false;

  constructor(
    private readonly store: MemoryStore,
    private readonly embedder: Embedder,
    private readonly config: MemoryConfig,
  ) {}

  async indexFile(absolutePath: string): Promise<IndexStats> {
    return this.indexFileRelativeTo(absolutePath, this.config.wikiDir);
  }

  private async indexFileRelativeTo(absolutePath: string, sourceRoot: string): Promise<IndexStats> {
    const source = path.relative(sourceRoot, absolutePath);
    const existingHashes = this.store.hashesBySource(source);

    let text: string;
    try {
      text = fs.readFileSync(absolutePath, 'utf8');
    } catch (err) {
      console.warn(`[memory-indexer] Cannot read file ${absolutePath}:`, err);
      return { indexed: 0, deleted: 0, skipped: existingHashes.size };
    }

    const allChunks = chunkMarkdown(text, source, this.config);
    const newHashes = new Set(allChunks.map((c) => c.id));

    const toIndex = allChunks.filter((c) => !existingHashes.has(c.id));
    const toDelete = [...existingHashes].filter((h) => !newHashes.has(h));

    let embeddings: Float32Array[] = [];
    if (toIndex.length > 0) {
      try {
        embeddings = await this.embedder.embed(toIndex.map((c) => c.content));
      } catch (err) {
        console.warn(`[memory-indexer] Embedding failed for ${absolutePath}:`, err);
        return { indexed: 0, deleted: 0, skipped: existingHashes.size };
      }
    }

    if (toIndex.length > 0) {
      this.store.upsert(toIndex, embeddings);
    }
    if (toDelete.length > 0) {
      this.store.deleteByIds(toDelete);
    }

    return {
      indexed: toIndex.length,
      deleted: toDelete.length,
      skipped: allChunks.length - toIndex.length,
    };
  }

  async indexDirectory(
    rootDir: string,
    opts: { relativeBase?: string; excludeFiles?: string[] } = {},
  ): Promise<IndexStats> {
    const totals: IndexStats = { indexed: 0, deleted: 0, skipped: 0 };

    if (!fs.existsSync(rootDir)) return totals;

    const relativeBase = opts.relativeBase ?? this.config.wikiDir;
    const excludeFiles = new Set(opts.excludeFiles ?? []);
    const files: string[] = [];

    const walk = (dirPath: string): void => {
      let entries: fs.Dirent[];
      try {
        entries = fs.readdirSync(dirPath, { withFileTypes: true });
      } catch (err) {
        console.warn(`[memory-indexer] Cannot scan directory ${dirPath}:`, err);
        return;
      }

      for (const entry of entries) {
        const entryPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
          walk(entryPath);
          continue;
        }
        if (entry.isFile() && /\.md$/i.test(entry.name) && !excludeFiles.has(entry.name)) {
          files.push(entryPath);
        }
      }
    };

    walk(rootDir);

    const currentSources = new Set(
      files.map((file) => path.relative(relativeBase, file)),
    );

    // Remove stale sources (deleted files or pre-migration daily-file sources)
    for (const stale of this.store.indexedSources()) {
      if (!currentSources.has(stale)) {
        this.store.deleteBySource(stale);
        totals.deleted += 1;
      }
    }

    for (const file of files) {
      const stats = await this.indexFileRelativeTo(file, relativeBase);
      totals.indexed += stats.indexed;
      totals.deleted += stats.deleted;
      totals.skipped += stats.skipped;
    }

    return totals;
  }

  async search(query: string, topK: number): Promise<SearchResult[]> {
    const fetchLimit = topK * 2;

    let denseResults: Array<{ id: string; score: number }> = [];
    if (this.store.vecAvailable) {
      try {
        const queryEmbedding = await this.embedder.embed([query]);
        denseResults = this.store.searchDense(queryEmbedding[0], fetchLimit);
      } catch (err) {
        console.warn('[memory-indexer] Dense search embedding failed:', err);
      }
    }

    const bm25Results = this.store.searchBm25(query, fetchLimit);

    // RRF fusion (k=60)
    const k = 60;
    const scoreMap = new Map<string, { dense: number; bm25: number }>();

    denseResults.forEach((r, rank) => {
      scoreMap.set(r.id, { dense: 1 / (k + rank + 1), bm25: 0 });
    });

    bm25Results.forEach((r, rank) => {
      const existing = scoreMap.get(r.id);
      if (existing) {
        existing.bm25 = 1 / (k + rank + 1);
      } else {
        scoreMap.set(r.id, { dense: 0, bm25: 1 / (k + rank + 1) });
      }
    });

    const hasDense = this.store.vecAvailable && denseResults.length > 0;
    const numRetrievers = hasDense ? 2 : 1;
    const maxScore = numRetrievers / 61;

    const ranked = [...scoreMap.entries()]
      .map(([id, scores]) => ({
        id,
        totalScore: scores.dense + scores.bm25,
        hasDense: scores.dense > 0,
        hasBm25: scores.bm25 > 0,
      }))
      .sort((a, b) => b.totalScore - a.totalScore);

    const chunks = this.store.getChunksByIds(ranked.map((r) => r.id));
    const chunkMap = new Map(chunks.map((c) => [c.id, c]));

    const results: SearchResult[] = [];
    const seenSources = new Set<string>();
    for (const r of ranked) {
      if (results.length >= topK) break;
      const chunk = chunkMap.get(r.id);
      if (!chunk) continue;
      if (seenSources.has(chunk.source)) continue;
      seenSources.add(chunk.source);

      const normalizedScore = maxScore > 0 ? r.totalScore / maxScore : 0;
      const retriever: 'dense' | 'bm25' | 'both' =
        r.hasDense && r.hasBm25 ? 'both' : r.hasDense ? 'dense' : 'bm25';

      let contentSource: 'file' | 'fallback' = 'file';
      try {
        chunk.content = fs.readFileSync(path.join(this.config.wikiDir, chunk.source), 'utf8');
      } catch {
        contentSource = 'fallback';
      }

      results.push({ chunk, score: normalizedScore, retriever, contentSource });
    }

    return results;
  }

  async save(content: string): Promise<IndexStats> {
    const datePart = new Date().toISOString().slice(0, 10);
    const rawDir = path.join(this.config.wikiDir, 'raw');
    const savePath = path.join(rawDir, `conv_save_${datePart}.md`);
    const lockPath = `${savePath}.lock`;

    fs.mkdirSync(rawDir, { recursive: true });

    const acquired = await acquireLock(lockPath);
    if (!acquired) {
      console.warn('[memory-indexer] Could not acquire write lock, writing anyway (fail-open)');
    }

    try {
      fs.appendFileSync(savePath, `\n${content}\n`, 'utf8');
    } finally {
      if (acquired) releaseLock(lockPath);
    }

    return { indexed: 0, deleted: 0, skipped: 0 };
  }

  async startupIndex(): Promise<void> {
    try {
      await this.indexDirectory(path.join(this.config.wikiDir, 'compiled'), {
        relativeBase: this.config.wikiDir,
        excludeFiles: ['index.md', 'log.md'],
      });
    } catch (err) {
      console.warn('[memory-indexer] Startup indexing failed:', err);
    } finally {
      this._ready = true;
    }
  }

  get ready(): boolean {
    return this._ready;
  }
}
