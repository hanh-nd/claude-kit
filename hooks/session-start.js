#!/usr/bin/env node
/* eslint-disable no-undef */

import * as fs from 'fs';
import * as path from 'path';
import { countTests } from '../scripts/count-tests.js';

const projectDir = process.env.GEMINI_PROJECT_DIR || process.cwd();
const kitDir = path.join(projectDir, '.agent-kit');

/**
 * SessionStart Hook
 * Initialize agent-kit on new session
 */
async function main(input) {
  try {
    input = JSON.parse(input);
  } catch {
    // If parse fails, return success (fail-open)
    console.log(JSON.stringify({}));
    process.exit(0);
  }

  // Ensure kit directories exist
  ensureDirectories();
  ensureGitExclusion();

  await updateProjectStats();

  // Return success message
  console.log(
    JSON.stringify({
      systemMessage: `🛠️ Agent-Kit ready | Session #${input.session_id}`,
    })
  );
}

// Read stdin
const input = await new Promise((resolve) => {
  let data = '';
  process.stdin.on('data', (chunk) => (data += chunk));
  process.stdin.on('end', () => resolve(data));
});

main(input).catch((error) => {
  console.log(
    JSON.stringify({
      systemMessage: `❌ Agent-Kit failed to initialize: ${error.message}`,
    })
  );
  process.exit(0);
});

/**
 * Ensures .agent-kit exists.
 */
function ensureDirectories() {
  const dirs = ['handoffs', 'memory', 'logs'];
  for (const dir of dirs) {
    const dirPath = path.join(kitDir, dir);
    if (!fs.existsSync(dirPath)) {
      try {
        fs.mkdirSync(dirPath, { recursive: true });
      } catch {
        // Silently fail if we can't create directories
      }
    }
  }
}

/**
 * Adds .agent-kit to .git/info/exclude to ensure it's ignored locally.
 */
function ensureGitExclusion() {
  const gitDir = path.join(projectDir, '.git');
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

    const ignoreLine = '.agent-kit';
    if (!content.includes(ignoreLine)) {
      const separator = content.length > 0 && !content.endsWith('\n') ? '\n' : '';
      fs.appendFileSync(gitExcludePath, `${separator}${ignoreLine}\n`);
    }
  } catch {
    // Silently fail to not block the server startup
  }
}

async function updateProjectStats() {
  const statsPath = path.join(kitDir, 'stats.json');
  if (!fs.existsSync(statsPath)) {
    fs.writeFileSync(statsPath, JSON.stringify({ sessions: 0, hasUnitTests: false }));
  }

  const stats = JSON.parse(fs.readFileSync(statsPath, 'utf8'));
  // Update session count
  stats.sessions++;

  // Update test count
  const testCount = countTests(projectDir);
  if (testCount > 5) {
    stats.hasUnitTests = true;
  }

  fs.writeFileSync(statsPath, JSON.stringify(stats, null, 2));
}
