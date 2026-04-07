#!/usr/bin/env node
/**
 * Cleanup script for .agent-kit directories.
 * - Removes files in .agent-kit/handoffs not modified in 7 days
 * - Removes files in .agent-kit/logs not modified in 3 days
 */

import { readdirSync, statSync, unlinkSync } from 'fs';
import { join } from 'path';
import { KIT_PATH } from '../hooks/constants.js';

const HANDOFFS_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const LOGS_MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000;

function cleanDirectory(dirPath, maxAgeMs) {
  const now = Date.now();
  let removed = 0;

  function walk(currentPath) {
    let entries;
    try {
      entries = readdirSync(currentPath, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = join(currentPath, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile()) {
        try {
          const { mtimeMs } = statSync(fullPath);
          if (now - mtimeMs > maxAgeMs) {
            unlinkSync(fullPath);
            removed++;
          }
        } catch {
          // file may have been removed already; skip
        }
      }
    }
  }

  walk(dirPath);
  return removed;
}

export function runCleanup() {
  const handoffsDir = join(KIT_PATH, 'handoffs');
  const logsDir = join(KIT_PATH, 'logs');

  const handoffsRemoved = cleanDirectory(handoffsDir, HANDOFFS_MAX_AGE_MS);
  const logsRemoved = cleanDirectory(logsDir, LOGS_MAX_AGE_MS);

  if (handoffsRemoved > 0 || logsRemoved > 0) {
    process.stderr.write(
      `[cleanup] Removed ${handoffsRemoved} handoff file(s) (>7d), ${logsRemoved} log file(s) (>3d)\n`
    );
  }
}

// Allow running directly: node scripts/cleanup-handoffs.js
if (process.argv[1] && process.argv[1].endsWith('cleanup-handoffs.js')) {
  runCleanup();
}
