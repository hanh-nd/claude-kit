import { tokenize } from './tokenize.js';
const STRUCTURAL_LABELS = new Set([
    'anchor',
    'anchors',
    'primary',
    'related',
    'see',
    'source',
    'sources',
]);
const NO_STOPWORDS = new Set();
function isPathValue(value) {
    return value.includes('/') || value.startsWith('/');
}
function cleanValue(value) {
    return value
        .trim()
        .replace(/^["'`]+|["'`]+$/g, '')
        .replace(/[),.;]+$/g, '')
        .trim();
}
function splitLabel(raw) {
    const match = raw.match(/^([^:`]+):\s*(.+)$/);
    if (!match)
        return { label: null, body: raw.trim() };
    return { label: match[1].trim(), body: match[2].trim() };
}
function hasUsefulTokens(value, stopwords) {
    return tokenize(value, stopwords).length > 0;
}
function normalizeCandidate(raw, label, candidate, stopwords) {
    const value = cleanValue(candidate);
    if (!value || !hasUsefulTokens(value, stopwords))
        return null;
    return {
        raw,
        value,
        label,
        kind: isPathValue(value) ? 'path' : 'symbol',
    };
}
function addAlias(aliases, seen, value, stopwords) {
    const cleaned = cleanValue(value);
    if (!cleaned || !hasUsefulTokens(cleaned, stopwords))
        return;
    const key = cleaned.toLowerCase();
    if (seen.has(key))
        return;
    seen.add(key);
    aliases.push(cleaned);
}
function isStructuralLabel(label) {
    const tokens = tokenize(label, NO_STOPWORDS);
    return tokens.length > 0 && tokens.every((token) => STRUCTURAL_LABELS.has(token));
}
export function normalizeAnchorBullet(raw, stopwords = new Set()) {
    try {
        const trimmed = typeof raw === 'string' ? raw.trim() : '';
        if (!trimmed)
            return [];
        const { label, body } = splitLabel(trimmed);
        const backticked = Array.from(body.matchAll(/`([^`]+)`/g), (match) => match[1]);
        const candidates = backticked.length > 0 ? backticked : [body];
        const anchors = [];
        const seen = new Set();
        for (const candidate of candidates) {
            const anchor = normalizeCandidate(trimmed, label, candidate, stopwords);
            if (!anchor)
                continue;
            const key = `${anchor.kind}:${anchor.value.toLowerCase()}`;
            if (seen.has(key))
                continue;
            seen.add(key);
            anchors.push(anchor);
        }
        return anchors;
    }
    catch {
        return [];
    }
}
export function derivePageAliases(input) {
    try {
        const stopwords = input.stopwords ?? new Set();
        const aliases = [];
        const seen = new Set();
        addAlias(aliases, seen, input.slug.replace(/[-_]/g, ' '), stopwords);
        addAlias(aliases, seen, input.title, stopwords);
        for (const anchor of input.anchors) {
            addAlias(aliases, seen, anchor.value.replace(/[-_./\\]/g, ' '), stopwords);
            if (anchor.label && !isStructuralLabel(anchor.label)) {
                addAlias(aliases, seen, anchor.label, stopwords);
            }
        }
        return aliases;
    }
    catch {
        return [];
    }
}
