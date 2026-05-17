import * as path from 'node:path';
import { tokenize } from './tokenize.js';
function extractPaths(toolInput) {
    const paths = [];
    if (typeof toolInput.file_path === 'string')
        paths.push(toolInput.file_path);
    if (typeof toolInput.path === 'string')
        paths.push(toolInput.path);
    if (Array.isArray(toolInput.paths)) {
        for (const p of toolInput.paths)
            if (typeof p === 'string')
                paths.push(p);
    }
    // Patch-format files: "*** Update/Create/Delete File: <path>"
    const patchText = typeof toolInput.command === 'string' ? toolInput.command : '';
    for (const m of patchText.matchAll(/\*\*\* (?:Update|Create|Delete) File: (.+)/g)) {
        paths.push(m[1].trim());
    }
    return paths;
}
function extractFreeText(toolInput) {
    const parts = [];
    if (typeof toolInput.new_string === 'string')
        parts.push(toolInput.new_string.slice(0, 200));
    if (typeof toolInput.content === 'string')
        parts.push(toolInput.content.slice(0, 200));
    if (typeof toolInput.pattern === 'string')
        parts.push(toolInput.pattern);
    if (typeof toolInput.command === 'string')
        parts.push(toolInput.command.slice(0, 200));
    if (typeof toolInput.cmd === 'string')
        parts.push(toolInput.cmd.slice(0, 200));
    return parts.join(' ');
}
function buildPathPrefixes(paths) {
    const prefixSet = new Set();
    for (const p of paths) {
        const normalized = p.replace(/\\/g, '/');
        const parts = normalized.split('/').filter(Boolean);
        // Build all directory-level prefixes (exclude the filename itself)
        for (let i = 1; i < parts.length; i++) {
            prefixSet.add('/' + parts.slice(0, i).join('/'));
        }
    }
    return Array.from(prefixSet);
}
function extractPathTokens(paths, stopwords) {
    const seen = new Set();
    const tokens = [];
    for (const p of paths) {
        const normalized = p.replace(/\\/g, '/');
        const parts = normalized.split('/').filter(Boolean);
        for (const part of parts) {
            const base = path.basename(part, path.extname(part));
            for (const token of tokenize(base, stopwords)) {
                if (seen.has(token))
                    continue;
                seen.add(token);
                tokens.push(token);
            }
        }
    }
    return tokens;
}
export function extractQuery(toolName, toolInput, config) {
    const safeInput = toolInput && typeof toolInput === 'object' ? toolInput : {};
    const stopwords = new Set(config?.stopwords ?? []);
    try {
        const paths = extractPaths(safeInput);
        const pathPrefixes = buildPathPrefixes(paths);
        const freeText = extractFreeText(safeInput);
        // For Bash, do not derive symbols from paths (commands are not file paths)
        const isBash = toolName === 'Bash';
        const pathTokens = isBash ? [] : extractPathTokens(paths, stopwords);
        const symbols = isBash
            ? []
            : paths.flatMap((p) => {
                const base = path.basename(p, path.extname(p));
                return tokenize(base, stopwords);
            });
        const rawFreeTextTokens = tokenize(freeText, stopwords);
        // Dedupe preserving order, cap at top-20 unique
        const seen = new Set();
        const freeTextTokens = [];
        for (const t of rawFreeTextTokens) {
            if (!seen.has(t)) {
                seen.add(t);
                freeTextTokens.push(t);
                if (freeTextTokens.length === 20)
                    break;
            }
        }
        const terms = Array.from(new Set([...pathTokens, ...symbols, ...freeTextTokens]));
        return { toolName, paths, pathPrefixes, pathTokens, symbols, freeText, freeTextTokens, terms };
    }
    catch {
        return { toolName, paths: [], pathPrefixes: [], pathTokens: [], symbols: [], freeText: '', freeTextTokens: [], terms: [] };
    }
}
