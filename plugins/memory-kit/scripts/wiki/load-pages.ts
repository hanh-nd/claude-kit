import * as fs from 'fs';
import * as path from 'path';
import { loadOrBuildIndex } from './index-cache.js';
import { parsePage } from './parse-page.js';
import type { WikiConfig, WikiPage } from '@types';

export function loadAllPages(wikiRoot: string, config?: WikiConfig): WikiPage[] {
  if (config) {
    const index = loadOrBuildIndex(wikiRoot, config);
    const pages = index.pages.map((e) => e.page);

    if (pages.length === 0) {
      const inboxPath = path.join(wikiRoot, 'raw', 'inbox.md');
      const inboxPage = parsePage(inboxPath, new Set(config.stopwords));
      if (inboxPage) return [inboxPage];
    }

    return pages;
  }

  // Fallback path when called without config (for backward compat with existing tests)
  const COMPILED_CATEGORIES = ['entities', 'concepts', 'glossary', 'preferences'];
  const pages: WikiPage[] = [];

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
      const page = parsePage(absPath);
      if (page) pages.push(page);
    }
  }

  if (pages.length === 0) {
    const inboxPath = path.join(wikiRoot, 'raw', 'inbox.md');
    const inboxPage = parsePage(inboxPath);
    if (inboxPage) pages.push(inboxPage);
  }

  return pages;
}
