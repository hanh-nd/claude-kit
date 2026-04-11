#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';

import { KIT_PATH } from './constants.js';
import { noOp, runWhenInvoked } from './utils.js';

const WIKI_INDEX_MAX_LINES = 100;
const INBOX_TAIL_MAX_ENTRIES = 5;

/**
 * Extract the last N inbox entries from inbox.md content.
 * Entries are delimited by lines starting with '## ['.
 *
 * @param {string} content - Full inbox.md file content
 * @param {number} n - Number of entries to return
 * @returns {string}
 */
function extractInboxTail(content, n) {
  if (!content || !content.trim()) return '';
  const lines = content.split('\n');
  const entryStarts = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('## [')) entryStarts.push(i);
  }
  if (entryStarts.length === 0) return '';
  const fromIdx = entryStarts[Math.max(0, entryStarts.length - n)];
  return lines.slice(fromIdx).join('\n').trim();
}

/**
 * Build the wiki context systemMessage for post-compact injection.
 * Returns null if both inputs are empty (triggers noOp).
 *
 * @param {string} indexContent - First N lines of compiled/index.md
 * @param {string} inboxTail - Last N inbox entries
 * @returns {string|null}
 */
function buildWikiContextMessage(indexContent, inboxTail) {
  const hasIndex = indexContent && indexContent.trim();
  const hasTail = inboxTail && inboxTail.trim();
  if (!hasIndex && !hasTail) return null;

  let message = '## Project Wiki (restored after /compact)\n\n';
  if (hasIndex) message += `### Index\n${indexContent.trim()}\n\n`;
  if (hasTail) message += `### Recent Activity\n${inboxTail.trim()}`;
  return message.trim();
}

runWhenInvoked(import.meta.url, async () => {
  const raw = await new Promise((resolve) => {
    let data = '';
    process.stdin.on('data', (chunk) => (data += chunk));
    process.stdin.on('end', () => resolve(data));
  });

  try {
    JSON.parse(raw);
  } catch {
    noOp();
  }

  let wikiIndex = '';
  let inboxTail = '';

  try {
    const indexPath = path.join(KIT_PATH, 'wiki', 'compiled', 'index.md');
    if (fs.existsSync(indexPath)) {
      const content = fs.readFileSync(indexPath, 'utf8');
      wikiIndex = content.split('\n').slice(0, WIKI_INDEX_MAX_LINES).join('\n');
    }
  } catch {
    // fail-open
  }

  try {
    const inboxPath = path.join(KIT_PATH, 'wiki', 'raw', 'inbox.md');
    if (fs.existsSync(inboxPath)) {
      const content = fs.readFileSync(inboxPath, 'utf8');
      inboxTail = extractInboxTail(content, INBOX_TAIL_MAX_ENTRIES);
    }
  } catch {
    // fail-open
  }

  const message = buildWikiContextMessage(wikiIndex, inboxTail);
  if (!message) {
    noOp();
  }

  console.log(JSON.stringify({ systemMessage: message }));
  process.exit(0);
});
