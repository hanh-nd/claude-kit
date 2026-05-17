import * as fs from 'node:fs';
import * as path from 'node:path';
import { atomicWriteJSON } from './atomic-write.js';
import { parsePage } from './parse-page.js';
import { tokenize } from './tokenize.js';
import type { CorpusIndex, ParsedPageCacheEntry, WikiConfig } from '@types';

export const INDEX_FILE = '.runtime/index.json';

const COMPILED_CATEGORIES = ['entities', 'concepts', 'glossary', 'preferences'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function loadCachedIndex(indexPath: string): CorpusIndex | null {
  try {
    const raw = fs.readFileSync(indexPath, 'utf8');
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || parsed.schemaVersion !== 1) return null;
    return parsed as unknown as CorpusIndex;
  } catch {
    return null;
  }
}

function scanPageFiles(wikiRoot: string): Array<{ absPath: string; mtimeMs: number }> {
  const files: Array<{ absPath: string; mtimeMs: number }> = [];
  for (const category of COMPILED_CATEGORIES) {
    const dir = path.join(wikiRoot, 'compiled', category);
    let entries: string[];
    try {
      entries = fs.readdirSync(dir);
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry.endsWith('.md')) continue;
      const absPath = path.join(dir, entry);
      try {
        const stat = fs.statSync(absPath);
        files.push({ absPath, mtimeMs: stat.mtimeMs });
      } catch {
        continue;
      }
    }
  }
  return files;
}

function buildIdf(pages: ParsedPageCacheEntry[]): Record<string, number> {
  const N = pages.length;
  if (N === 0) return {};
  const df: Record<string, number> = {};
  for (const entry of pages) {
    for (const term of Object.keys(entry.page.termFreq)) {
      df[term] = (df[term] ?? 0) + 1;
    }
  }
  const idf: Record<string, number> = {};
  for (const [term, docFreq] of Object.entries(df)) {
    idf[term] = Math.log(1 + (N - docFreq + 0.5) / (docFreq + 0.5));
  }
  return idf;
}

function computeAvgBodyLength(pages: ParsedPageCacheEntry[]): number {
  if (pages.length === 0) return 0;
  const total = pages.reduce((sum, e) => sum + e.page.bodyLength, 0);
  return total / pages.length;
}

const NO_STOPWORDS = new Set<string>();

function computeAvgSlugLen(pages: ParsedPageCacheEntry[]): number {
  if (pages.length === 0) return 0;
  const total = pages.reduce(
    (sum, e) => sum + tokenize(e.page.slug.replace(/[-_]/g, ' '), NO_STOPWORDS).length,
    0,
  );
  return total / pages.length;
}

function computeAvgHeadingLen(pages: ParsedPageCacheEntry[]): number {
  if (pages.length === 0) return 0;
  const total = pages.reduce(
    (sum, e) => sum + tokenize([e.page.title, ...e.page.anchors].join(' '), NO_STOPWORDS).length,
    0,
  );
  return total / pages.length;
}

function computeAvgKdLen(pages: ParsedPageCacheEntry[]): number {
  if (pages.length === 0) return 0;
  const total = pages.reduce(
    (sum, e) => sum + tokenize(e.page.keyDecisions.join(' '), NO_STOPWORDS).length,
    0,
  );
  return total / pages.length;
}

function hashStopwords(stopwords: string[]): string {
  return [...stopwords].sort().join(',');
}

export function loadOrBuildIndex(wikiRoot: string, config: WikiConfig): CorpusIndex {
  const stopwordsSet = new Set(config.stopwords);
  const swHash = hashStopwords(config.stopwords);
  const indexPath = path.join(wikiRoot, INDEX_FILE);

  function buildFresh(diskFiles: Array<{ absPath: string; mtimeMs: number }>): CorpusIndex {
    const pages: ParsedPageCacheEntry[] = [];
    for (const { absPath, mtimeMs } of diskFiles) {
      const page = parsePage(absPath, stopwordsSet);
      if (!page) continue;
      pages.push({ slug: page.slug, path: absPath, mtimeMs, page });
    }
    return {
      schemaVersion: 1,
      stopwordsHash: swHash,
      pages,
      idf: buildIdf(pages),
      avgBodyLength: computeAvgBodyLength(pages),
      avgSlugLen: computeAvgSlugLen(pages),
      avgHeadingLen: computeAvgHeadingLen(pages),
      avgKdLen: computeAvgKdLen(pages),
      builtAt: new Date().toISOString(),
    };
  }

  // No cache: fully rebuild in memory without read/write
  if (!config.cacheEnabled) {
    return buildFresh(scanPageFiles(wikiRoot));
  }

  const cached = loadCachedIndex(indexPath);
  const diskFiles = scanPageFiles(wikiRoot);

  // Invalidate cache if stopwords config changed
  const stopwordsChanged = cached !== null && cached.stopwordsHash !== swHash;

  // Build lookup maps for cache entries
  const cacheByPath: Map<string, ParsedPageCacheEntry> = new Map(
    (!stopwordsChanged ? cached?.pages ?? [] : []).map((e) => [e.path, e]),
  );

  let anyChanged = cached === null || stopwordsChanged;
  const newPages: ParsedPageCacheEntry[] = [];
  const diskPathSet = new Set(diskFiles.map((f) => f.absPath));

  // Check if any cached entries were deleted
  if (cached && !stopwordsChanged) {
    for (const entry of cached.pages) {
      if (!diskPathSet.has(entry.path)) {
        anyChanged = true;
      }
    }
  }

  for (const { absPath, mtimeMs } of diskFiles) {
    const cached_entry = cacheByPath.get(absPath);
    if (cached_entry && cached_entry.mtimeMs === mtimeMs) {
      newPages.push(cached_entry);
    } else {
      anyChanged = true;
      const page = parsePage(absPath, stopwordsSet);
      if (!page) continue;
      newPages.push({ slug: page.slug, path: absPath, mtimeMs, page });
    }
  }

  const useCache = !anyChanged && cached !== null;
  const index: CorpusIndex = {
    schemaVersion: 1,
    stopwordsHash: swHash,
    pages: newPages,
    idf: useCache ? cached.idf : buildIdf(newPages),
    avgBodyLength: useCache ? cached.avgBodyLength : computeAvgBodyLength(newPages),
    avgSlugLen: useCache ? (cached.avgSlugLen ?? computeAvgSlugLen(newPages)) : computeAvgSlugLen(newPages),
    avgHeadingLen: useCache ? (cached.avgHeadingLen ?? computeAvgHeadingLen(newPages)) : computeAvgHeadingLen(newPages),
    avgKdLen: useCache ? (cached.avgKdLen ?? computeAvgKdLen(newPages)) : computeAvgKdLen(newPages),
    builtAt: new Date().toISOString(),
  };

  if (anyChanged) {
    try {
      atomicWriteJSON(indexPath, index);
    } catch {
      // Swallow write failure; return in-memory index
    }
  }

  return index;
}
