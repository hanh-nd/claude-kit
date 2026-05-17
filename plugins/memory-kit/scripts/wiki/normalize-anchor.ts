import { tokenize } from './tokenize.js';

export type NormalizedAnchorKind = 'path' | 'symbol';

export interface NormalizedAnchor {
  raw: string;
  value: string;
  label: string | null;
  kind: NormalizedAnchorKind;
}

const STRUCTURAL_LABELS = new Set([
  'anchor',
  'anchors',
  'primary',
  'related',
  'see',
  'source',
  'sources',
]);

const NO_STOPWORDS = new Set<string>();

function isPathValue(value: string): boolean {
  return value.includes('/') || value.startsWith('/');
}

function cleanValue(value: string): string {
  return value
    .trim()
    .replace(/^["'`]+|["'`]+$/g, '')
    .replace(/[),.;]+$/g, '')
    .trim();
}

function splitLabel(raw: string): { label: string | null; body: string } {
  const match = raw.match(/^([^:`]+):\s*(.+)$/);
  if (!match) return { label: null, body: raw.trim() };
  return { label: match[1].trim(), body: match[2].trim() };
}

function hasUsefulTokens(value: string, stopwords: ReadonlySet<string>): boolean {
  return tokenize(value, stopwords).length > 0;
}

function normalizeCandidate(raw: string, label: string | null, candidate: string, stopwords: ReadonlySet<string>): NormalizedAnchor | null {
  const value = cleanValue(candidate);
  if (!value || !hasUsefulTokens(value, stopwords)) return null;
  return {
    raw,
    value,
    label,
    kind: isPathValue(value) ? 'path' : 'symbol',
  };
}

function addAlias(aliases: string[], seen: Set<string>, value: string, stopwords: ReadonlySet<string>): void {
  const cleaned = cleanValue(value);
  if (!cleaned || !hasUsefulTokens(cleaned, stopwords)) return;
  const key = cleaned.toLowerCase();
  if (seen.has(key)) return;
  seen.add(key);
  aliases.push(cleaned);
}

function isStructuralLabel(label: string): boolean {
  const tokens = tokenize(label, NO_STOPWORDS);
  return tokens.length > 0 && tokens.every((token) => STRUCTURAL_LABELS.has(token));
}

export function normalizeAnchorBullet(raw: string, stopwords: ReadonlySet<string> = new Set()): NormalizedAnchor[] {
  try {
    const trimmed = typeof raw === 'string' ? raw.trim() : '';
    if (!trimmed) return [];

    const { label, body } = splitLabel(trimmed);
    const backticked = Array.from(body.matchAll(/`([^`]+)`/g), (match) => match[1]);
    const candidates = backticked.length > 0 ? backticked : [body];
    const anchors: NormalizedAnchor[] = [];
    const seen = new Set<string>();

    for (const candidate of candidates) {
      const anchor = normalizeCandidate(trimmed, label, candidate, stopwords);
      if (!anchor) continue;
      const key = `${anchor.kind}:${anchor.value.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      anchors.push(anchor);
    }

    return anchors;
  } catch {
    return [];
  }
}

export function derivePageAliases(input: {
  slug: string;
  title: string;
  anchors: NormalizedAnchor[];
  stopwords?: ReadonlySet<string>;
}): string[] {
  try {
    const stopwords = input.stopwords ?? new Set<string>();
    const aliases: string[] = [];
    const seen = new Set<string>();

    addAlias(aliases, seen, input.slug.replace(/[-_]/g, ' '), stopwords);
    addAlias(aliases, seen, input.title, stopwords);

    for (const anchor of input.anchors) {
      addAlias(aliases, seen, anchor.value.replace(/[-_./\\]/g, ' '), stopwords);
      if (anchor.label && !isStructuralLabel(anchor.label)) {
        addAlias(aliases, seen, anchor.label, stopwords);
      }
    }

    return aliases;
  } catch {
    return [];
  }
}
