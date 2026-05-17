#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';

import { KIT_DIR, KIT_PATH, PROJECT_DIR } from './constants.js';
import { runWhenInvoked } from './utils.js';
import type { Settings } from '@types';

function ensureDirectories(): void {
  const dirs = [
    'wiki/raw',
    'wiki/compiled',
    'wiki/compiled/entities',
    'wiki/compiled/concepts',
    'wiki/archive',
    'wiki/archive/conversations',
  ];
  for (const dir of dirs) {
    const dirPath = path.join(KIT_PATH, dir);
    if (!fs.existsSync(dirPath)) {
      try {
        fs.mkdirSync(dirPath, { recursive: true });
      } catch {
        // Silently fail if we can't create directories
      }
    }
  }

  const files = ['wiki/raw/inbox.md'];
  for (const file of files) {
    const filePath = path.join(KIT_PATH, file);
    if (!fs.existsSync(filePath)) {
      try {
        fs.writeFileSync(filePath, '');
      } catch {
        // Silently fail to not block session startup
      }
    }
  }
}

function ensureGitExclusion(): void {
  const gitDir = path.join(PROJECT_DIR, '.git');
  if (!fs.existsSync(gitDir)) return;

  const gitExcludePath = path.join(gitDir, 'info', 'exclude');

  try {
    const infoDir = path.dirname(gitExcludePath);
    if (!fs.existsSync(infoDir)) {
      fs.mkdirSync(infoDir, { recursive: true });
    }

    let content = '';
    if (fs.existsSync(gitExcludePath)) {
      content = fs.readFileSync(gitExcludePath, 'utf8');
    }

    if (!content.includes(KIT_DIR)) {
      const separator = content.length > 0 && !content.endsWith('\n') ? '\n' : '';
      fs.appendFileSync(gitExcludePath, `${separator}${KIT_DIR}\n`);
    }
  } catch {
    // Silently fail to not block the server startup
  }
}

const DEFAULT_SETTINGS: Settings = {
  wiki: {
    // Minimum relevance score for a wiki page to be injected before a tool call.
    injectMinScore: 5.0,
    // Set to true to write per-call decisions to .agent-kit/wiki/.runtime/debug.log.
    debug: false,
  },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function ensureSettings(): void {
  const settingsPath = path.join(KIT_PATH, 'settings.json');
  let current: Settings = {};
  if (fs.existsSync(settingsPath)) {
    try {
      const parsed: unknown = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      current = isRecord(parsed) ? parsed : {};
    } catch {
      // Corrupted — start fresh
    }
  }

  let changed = false;
  if (!isRecord(current.wiki)) {
    current.wiki = {};
    changed = true;
  }
  if (current.wiki.injectMinScore === undefined) {
    current.wiki.injectMinScore = DEFAULT_SETTINGS.wiki?.injectMinScore;
    changed = true;
  }
  if (current.wiki.debug === undefined) {
    current.wiki.debug = DEFAULT_SETTINGS.wiki?.debug;
    changed = true;
  }

  if (changed) {
    try {
      fs.writeFileSync(settingsPath, JSON.stringify(current, null, 2));
    } catch {
      // Silently fail to not block session startup
    }
  }
}

/**
 * SessionStart Hook — Memory Kit Initializer
 */
runWhenInvoked(import.meta.url, async () => {
  const raw = await new Promise<string>((resolve) => {
    let data = '';
    process.stdin.on('data', (chunk) => (data += chunk));
    process.stdin.on('end', () => resolve(data));
  });

  try {
    JSON.parse(raw);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('❌ Memory-Kit failed to initialize', errorMessage);
    process.exit(0);
  }

  ensureDirectories();
  ensureGitExclusion();
  ensureSettings();

  console.log(
    JSON.stringify({
      systemMessage: `🧠 Memory-Kit ready`,
    })
  );
});
