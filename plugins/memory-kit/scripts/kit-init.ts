#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';
import { KIT_PATH, MEMORY_DIR } from './constants.js';
import { readdirSorted, runWhenInvoked } from './utils.js';

function ensureMemoryDir(): void {
  try {
    fs.mkdirSync(MEMORY_DIR, { recursive: true });
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

function writeTodaySessionHeading(): void {
  const now = new Date();
  const datePart = now.toISOString().slice(0, 10);
  const timePart = now.toTimeString().slice(0, 5);
  const todayPath = path.join(MEMORY_DIR, `${datePart}.md`);
  const heading = `\n## Session ${timePart}\n`;

  try {
    const existing = fs.existsSync(todayPath) ? fs.readFileSync(todayPath, 'utf8') : '';
    if (!existing.includes(`## Session ${timePart}`)) {
      fs.appendFileSync(todayPath, heading, 'utf8');
    }
  } catch {
    // Silently fail to not block session startup
  }
}

function buildAdditionalContext(): string {
  const files = readdirSorted(MEMORY_DIR).slice(-2);
  if (files.length === 0) return '';

  const lines: string[] = [];
  for (const filePath of files) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const matched = content
        .split('\n')
        .filter((line) => /^(#{2,4} |- )/.test(line))
        .slice(0, 20);
      lines.push(...matched);
    } catch {
      // skip unreadable files
    }
  }

  return lines.join('\n');
}

runWhenInvoked(import.meta.url, async () => {
  await new Promise<void>((resolve) => {
    let data = '';
    process.stdin.on('data', (chunk) => (data += chunk));
    process.stdin.on('end', () => resolve());
  });

  ensureMemoryEnabled();
  ensureMemoryDir();
  writeTodaySessionHeading();
  const additionalContext = buildAdditionalContext();

  const output = additionalContext
    ? {
        systemMessage: '[memory-kit] Memory available',
        hookSpecificOutput: {
          hookEventName: 'SessionStart',
          additionalContext,
        },
      }
    : {};

  console.log(JSON.stringify(output));
  process.exit(0);
});
