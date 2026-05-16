#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';

import { KIT_DIR, KIT_PATH, PROJECT_DIR } from './constants.js';
import { runWhenInvoked, Settings, WikiConfig } from './utils.js';

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

function ensureSettings(): void {
  const settingsPath = path.join(KIT_PATH, 'settings.json');
  let current: Settings = {};
  if (fs.existsSync(settingsPath)) {
    try {
      current = JSON.parse(fs.readFileSync(settingsPath, 'utf8')) as Settings;
    } catch {
      // Corrupted — start fresh
    }
  }

  let changed = false;
  for (const [section, defaults] of Object.entries(DEFAULT_SETTINGS)) {
    if (typeof current[section] !== 'object' || current[section] === null) {
      current[section] = {};
      changed = true;
    }
    const currentSection = current[section] as Record<string, unknown>;
    for (const [key, value] of Object.entries(defaults as Record<string, unknown>)) {
      if (!(key in currentSection)) {
        currentSection[key] = value;
        changed = true;
      }
    }
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
