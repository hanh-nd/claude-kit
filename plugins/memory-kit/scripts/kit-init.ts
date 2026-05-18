#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';
import { KIT_PATH, WIKI_ARCHIVE_CONVERSATIONS_DIR, WIKI_COMPILED_DIR, WIKI_RAW_DIR } from './constants.js';
import { runWhenInvoked } from './utils.js';

function ensureWikiDirs(): void {
  try {
    fs.mkdirSync(WIKI_RAW_DIR, { recursive: true });
    fs.mkdirSync(WIKI_COMPILED_DIR, { recursive: true });
    fs.mkdirSync(WIKI_ARCHIVE_CONVERSATIONS_DIR, { recursive: true });
  } catch {
    // Silently fail to not block session startup
  }
}

function ensureMemoryEnabled(): void {
  const settingsPath = path.join(KIT_PATH, 'settings.json');
  try {
    fs.mkdirSync(KIT_PATH, { recursive: true });
    let settings: Record<string, unknown> = {};
    if (fs.existsSync(settingsPath)) {
      settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8')) as Record<string, unknown>;
    }
    const memory = (settings.memory ?? {}) as Record<string, unknown>;
    if (memory.enabled !== true) {
      settings.memory = { ...memory, enabled: true };
      fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n', 'utf8');
    }
  } catch {
    // Silently fail to not block session startup
  }
}

runWhenInvoked(import.meta.url, async () => {
  await new Promise<void>((resolve) => {
    let data = '';
    process.stdin.on('data', (chunk) => (data += chunk));
    process.stdin.on('end', () => resolve());
  });

  ensureMemoryEnabled();
  ensureWikiDirs();

  console.log(JSON.stringify({
    systemMessage: '[memory-kit] Memory available',
  }));
  process.exit(0);
});
