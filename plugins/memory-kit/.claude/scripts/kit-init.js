#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';

import { KIT_DIR, KIT_PATH, PROJECT_DIR } from './constants.js';
import { runWhenInvoked } from './utils.js';

function ensureDirectories() {
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

const DEFAULT_SETTINGS = {
  wiki: {
    // Minimum relevance score for a wiki page to be injected before a tool call.
    injectMinScore: 5.0,
    // Set to true to write per-call decisions to .agent-kit/wiki/.runtime/debug.log.
    debug: false,
  },
};

function ensureSettings() {
  const settingsPath = path.join(KIT_PATH, 'settings.json');
  let current = {};
  if (fs.existsSync(settingsPath)) {
    try {
      current = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
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
    for (const [key, value] of Object.entries(defaults)) {
      if (!(key in current[section])) {
        current[section][key] = value;
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
  const raw = await new Promise((resolve) => {
    let data = '';
    process.stdin.on('data', (chunk) => (data += chunk));
    process.stdin.on('end', () => resolve(data));
  });

  let input;
  try {
    input = JSON.parse(raw);
  } catch (error) {
    console.error('❌ Memory-Kit failed to initialize', error.message);
    process.exit(0);
  }

  ensureDirectories();
  ensureSettings();
});
