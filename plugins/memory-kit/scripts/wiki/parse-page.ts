import * as fs from 'fs';
import * as path from 'path';
import type { PageStatus, WikiPage } from '@types';

const BODY_LIMIT = 8192;
const SUMMARY_LIMIT = 600;
const VALID_STATUS_VALUES: readonly PageStatus[] = ['active', 'complete', 'parked', 'deprecated'];

export const VALID_STATUSES: Set<PageStatus> = new Set(VALID_STATUS_VALUES);
const VALID_CATEGORIES = ['entities', 'concepts', 'glossary', 'preferences', 'inbox'];

function isPageStatus(value: string): value is PageStatus {
  return value === 'active' || value === 'complete' || value === 'parked' || value === 'deprecated';
}

function parseStatus(text: string): PageStatus | null {
  const match = text.match(/^Status:\s*(\w+)/im);
  if (!match) return null;
  const val = match[1].toLowerCase();
  return isPageStatus(val) ? val : null;
}

function parseUpdated(text: string): string | null {
  const match = text.match(/^>\s*Last updated:\s*(\d{4}-\d{2}-\d{2})/im);
  return match ? match[1] : null;
}

function escapeForRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractSection(text: string, heading: string): string {
  const re = new RegExp(`^##\\s+${escapeForRegex(heading)}\\s*$`, 'im');
  const match = re.exec(text);
  if (!match) return '';
  const afterHeading = text.indexOf('\n', match.index) + 1;
  if (afterHeading === 0) return '';
  const rest = text.slice(afterHeading);
  const nextH2 = rest.search(/^## /m);
  return nextH2 === -1 ? rest : rest.slice(0, nextH2);
}

function extractBullets(sectionText: string): string[] {
  return sectionText
    .split('\n')
    .filter((line) => /^\s*-\s/.test(line))
    .map((line) => line.replace(/^\s*-\s*/, '').trim())
    .filter(Boolean);
}

function deriveCategory(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/');
  for (const cat of VALID_CATEGORIES) {
    if (normalized.includes(`/${cat}/`) || normalized.includes(`/${cat}.md`)) {
      return cat;
    }
  }
  if (normalized.endsWith('inbox.md')) return 'inbox';
  return 'concepts';
}

export function parsePageContent(content: string, slug: string, category: string, absolutePath: string): WikiPage {
  const h1 = content.match(/^#\s+(.+)$/m);
  const title = h1 ? h1[1].trim() : slug;

  const status = parseStatus(content);
  const updated = parseUpdated(content);

  const summarySection = extractSection(content, 'Summary');
  const summary = summarySection.replace(/\s+/g, ' ').trim().slice(0, SUMMARY_LIMIT);

  const anchorsSection = extractSection(content, 'Anchors');
  const anchors = extractBullets(anchorsSection);

  const decisionsSection = extractSection(content, 'Key Decisions');
  const keyDecisions = extractBullets(decisionsSection).slice(0, 5);

  const edgesSection = extractSection(content, 'Edge Cases & Risks');
  const edgeCases = extractBullets(edgesSection).slice(0, 3);

  const bodyText = content.slice(0, BODY_LIMIT).toLowerCase();

  return {
    slug,
    category,
    path: absolutePath,
    title,
    status,
    updated,
    summary,
    anchors,
    keyDecisions,
    edgeCases,
    bodyText,
  };
}

export function parsePage(absolutePath: string): WikiPage | null {
  try {
    const content = fs.readFileSync(absolutePath, 'utf8');
    const slug = path.basename(absolutePath, '.md');
    const category = deriveCategory(absolutePath);
    return parsePageContent(content, slug, category, absolutePath);
  } catch {
    return null;
  }
}
