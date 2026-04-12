#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';

import { countTests } from '../scripts/count-tests.js';
import { KIT_DIR, KIT_PATH, PROJECT_DIR } from './constants.js';
import { runWhenInvoked } from './utils.js';

/**
 * Ensures .agent-kit exists.
 */
function ensureDirectories() {
  const dirs = [
    'handoffs',
    'logs',
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

  const files = ['project.md', 'wiki/raw/inbox.md'];
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

/**
 * Adds .agent-kit to .git/info/exclude to ensure it's ignored locally.
 */
function ensureGitExclusion() {
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

function updateProjectStats() {
  const statsPath = path.join(KIT_PATH, 'stats.json');
  if (!fs.existsSync(statsPath)) {
    fs.writeFileSync(statsPath, JSON.stringify({ sessions: 0, hasUnitTests: false }));
  }

  const stats = JSON.parse(fs.readFileSync(statsPath, 'utf8'));
  // Update session count
  stats.sessions++;

  // Update test count
  const testCount = countTests(PROJECT_DIR);
  if (testCount > 5) {
    stats.hasUnitTests = true;
  }

  fs.writeFileSync(statsPath, JSON.stringify(stats, null, 2));
}

/**
 * SessionStart Hook — Kit Initializer
 * Ensures .agent-kit directory structure exists, wires git exclusion,
 * and updates session stats.
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
    console.error('❌ Agent-Kit failed to initialize', error.message);
    process.exit(0);
  }

  // Ensure kit directories exist
  ensureDirectories();
  ensureGitExclusion();
  updateProjectStats();

  console.log(
    JSON.stringify({
      systemMessage: `🛠️ Agent-Kit ready | Session #${input.session_id}`,
    })
  );
});
