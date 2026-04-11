#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';

import { KIT_PATH } from './constants.js';
import { noOp, runWhenInvoked } from './utils.js';

const WIKI_INDEX_MAX_LINES = 100;
const INBOX_TAIL_MAX_ENTRIES = 5;

/**
 * Extract the last N inbox entries from inbox.md string content.
 * Entries are delimited by lines starting with '## ['.
 *
 * @param {string} content - Full inbox.md content
 * @param {number} n - Max number of entries to return
 * @returns {string}
 */
export function extractInboxTail(content, n) {
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

runWhenInvoked(import.meta.url, async () => {
  const raw = await new Promise((resolve) => {
    let data = '';
    process.stdin.on('data', (chunk) => (data += chunk));
    process.stdin.on('end', () => resolve(data));
  });

  let input;
  try {
    input = JSON.parse(raw);
  } catch {
    noOp();
  }

  const prompt = (input.prompt || '').trimStart();

  const SKILL_COMMANDS = ['brainstorm', 'plan', 'code'];
  const commandRegex = new RegExp(`^/(?:[^:]+:)?(${SKILL_COMMANDS.join('|')})`);
  if (!commandRegex.test(prompt)) {
    noOp();
  }

  // Read project DNA — skip if missing or empty
  let projectContent = '';
  try {
    const projectMdPath = path.join(KIT_PATH, 'project.md');
    projectContent = fs.readFileSync(projectMdPath, 'utf8').trim();
  } catch {
    noOp();
  }

  if (!projectContent) {
    noOp();
  }

  // Read wiki context: compiled index (first N lines) + inbox tail (last N entries)
  let wikiIndex = '';
  let inboxTail = '';

  try {
    const indexPath = path.join(KIT_PATH, 'wiki', 'compiled', 'index.md');
    if (fs.existsSync(indexPath)) {
      const content = fs.readFileSync(indexPath, 'utf8');
      wikiIndex = content.split('\n').slice(0, WIKI_INDEX_MAX_LINES).join('\n').trim();
    }
  } catch {
    // fail-open: wiki context is additive, not required
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

  // Build combined system message
  let systemMessage = `**!Important** These are the project's architectural conventions, naming patterns, error handling strategy, and critical rules. You MUST follow these throughout this command.\n\n${projectContent}`;

  if (wikiIndex || inboxTail) {
    systemMessage += '\n\n## Project Wiki\n\n';
    if (wikiIndex) systemMessage += `### Index\n${wikiIndex}\n\n`;
    if (inboxTail) systemMessage += `### Recent Activity\n${inboxTail}`;
    systemMessage = systemMessage.trimEnd();
  }

  console.log(JSON.stringify({ systemMessage }));
});
