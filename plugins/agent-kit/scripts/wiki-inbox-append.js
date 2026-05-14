#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';

import { KIT_PATH } from './constants.js';
import { noOp, runWhenInvoked } from './utils.js';

const HANDOFF_TYPES = [
  'brainstorm',
  'clarification',
  'plan',
  'ticket',
  'research',
  'scenario',
  'investigation',
];

const TICKET_ID_PATTERN = /\b[A-Za-z][A-Za-z0-9]+-\d+\b/;

function normalizeHandoffType(type) {
  if (!HANDOFF_TYPES.includes(type)) throw new Error(`Unsupported handoff type: ${type}`);
  return type;
}

function sanitizeFeatureSlug(value) {
  return value
    .replace(/[^a-zA-Z0-9-_]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

function findTicketId(value) {
  return value.match(TICKET_ID_PATTERN)?.[0].toLowerCase() ?? null;
}

function contentSlugCandidate(content) {
  const heading = content
    .split(/\r?\n/)
    .map((line) => line.replace(/^#+\s*/, '').trim())
    .find((line) => line.length > 0);

  return heading ?? content.replace(/\s+/g, ' ').trim().slice(0, 80);
}

function deriveFeatureSlug({ slug, content }) {
  const ticketSlug = findTicketId(slug) ?? findTicketId(content);
  if (ticketSlug) return ticketSlug;

  return (
    sanitizeFeatureSlug(slug) ||
    sanitizeFeatureSlug(contentSlugCandidate(content)) ||
    'untitled-handoff'
  );
}

/**
 * Build a structured inbox entry from a kit_save_handoff tool call.
 * Returns null if required fields (type, slug) are missing.
 *
 * Entry format:
 *   ## [YYYY-MM-DDTHH:MM:SS] handoff | {type}-{slug}
 *   - type: {type}
 *   - slug: {slug}
 *   - path: {absolute-path}          (omitted if not found in response)
 *   - summary: {first-h2 or 100 chars}
 *
 * @param {{ type?: string, slug?: string, content?: string }} toolInput
 * @returns {string|null}
 */
export function buildInboxEntry(toolInput) {
  if (!toolInput?.type || !toolInput?.slug) return null;

  const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, '');
  const { type, slug, content = '' } = toolInput;

  // Derive the saved file path by scanning the feature-central handoff location.
  // Avoids fragile regex on MCP response text — the message format is an
  // implementation detail of core.ts that can change independently.
  let filePath = '';
  try {
    const canonicalType = normalizeHandoffType(type);
    const featureSlug = deriveFeatureSlug({ slug, content });
    const newPath = path.join(KIT_PATH, 'handoffs', featureSlug, `${canonicalType}.md`);
    if (fs.existsSync(newPath)) {
      filePath = newPath;
    }
  } catch {
    // fail-open: path stays empty, entry is still written without it
  }

  // Extract summary: first ## heading text; fallback to first 100 chars of content
  let summary = '';
  const headingMatch = content.match(/^## (.+)$/m);
  if (headingMatch) {
    summary = headingMatch[1].trim();
  } else {
    summary = content.replace(/\s+/g, ' ').trim().slice(0, 100);
  }

  const lines = [
    `## [${timestamp}] handoff | ${type}-${slug}`,
    `- type: ${type}`,
    `- slug: ${slug}`,
  ];
  if (filePath) lines.push(`- path: ${filePath}`);
  if (summary) lines.push(`- summary: ${summary}`);

  return lines.join('\n');
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

  // Only handle kit_save_handoff calls
  if (!input.tool_name || !input.tool_name.includes('kit_save_handoff')) {
    noOp();
  }

  const entry = buildInboxEntry(input.tool_input);
  if (!entry) {
    noOp();
  }

  const response = {};
  try {
    const inboxPath = path.join(KIT_PATH, 'wiki', 'raw', 'inbox.md');
    fs.appendFileSync(inboxPath, '\n' + entry + '\n', 'utf8');

    // Count entries and alert if > 10
    const content = fs.readFileSync(inboxPath, 'utf8');
    const entryCount = (content.match(/^## \[/gm) || []).length;
    if (entryCount > 10) {
      response.systemMessage = `⚠️ Wiki Inbox has more than 10 entries. Please run \`/wiki compile\` to organize them.`;
    }
  } catch {
    // Fail-open: never block user workflow
  }

  console.log(JSON.stringify(response));
});
