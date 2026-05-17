#!/usr/bin/env node
import * as fs from 'fs';
import * as path from 'path';
import { KIT_PATH, PROJECT_DIR } from './constants.js';
import { getWikiConfig, loadSettings, noOp, runWhenInvoked } from './utils.js';
import { extractQuery } from './wiki/extract-query.js';
import { formatHit } from './wiki/format-hit.js';
import { markInjected, readLedger, wasInjected, writeLedger } from './wiki/ledger.js';
import { loadAllPages } from './wiki/load-pages.js';
import { scoreQuery } from './wiki/score-query.js';
function appendDebugLog(decision, wikiRoot, settings) {
    try {
        const wikiConfig = getWikiConfig(settings);
        if (!wikiConfig.debug) {
            return;
        }
        const logPath = path.join(wikiRoot, '.runtime', 'debug.log');
        fs.mkdirSync(path.dirname(logPath), { recursive: true });
        const line = `${new Date().toISOString()} ${JSON.stringify(decision)}\n`;
        fs.appendFileSync(logPath, line, 'utf8');
    }
    catch (error) {
        const logFile = path.join(KIT_PATH, 'debug.log');
        const errorMessage = error instanceof Error ? error.message : String(error);
        fs.appendFileSync(logFile, JSON.stringify({ error: errorMessage }), 'utf8');
        // ignore debug log errors
    }
}
function isRecord(value) {
    return typeof value === 'object' && value !== null;
}
function parseStdin(raw) {
    try {
        const parsed = JSON.parse(raw);
        if (!isRecord(parsed) || typeof parsed.tool_name !== 'string')
            return null;
        return {
            tool_name: parsed.tool_name,
            tool_input: isRecord(parsed.tool_input) ? parsed.tool_input : undefined,
            session_id: typeof parsed.session_id === 'string' ? parsed.session_id : null,
        };
    }
    catch {
        return null;
    }
}
export async function main(stdinJSON, opts = {}) {
    try {
        const wikiRoot = opts.wikiRoot ?? path.join(KIT_PATH, 'wiki');
        const settings = opts.settings ?? loadSettings();
        const toolName = stdinJSON?.tool_name;
        if (!toolName)
            return {};
        const toolInput = stdinJSON.tool_input ?? {};
        const sessionId = stdinJSON.session_id ?? null;
        appendDebugLog({ decision: 'start', toolName, toolInput, sessionId }, wikiRoot, settings);
        let wikiRootValid = false;
        try {
            wikiRootValid = fs.statSync(wikiRoot).isDirectory();
        }
        catch {
            wikiRootValid = false;
        }
        if (!wikiRootValid) {
            return {};
        }
        const query = extractQuery(toolName, toolInput);
        if (query.terms.length === 0) {
            return {};
        }
        const pages = loadAllPages(wikiRoot);
        if (pages.length === 0) {
            return {};
        }
        const hits = scoreQuery(query, pages);
        if (hits.length === 0) {
            return {};
        }
        const wikiConfig = getWikiConfig(settings);
        const topHit = hits[0];
        if (topHit.score < wikiConfig.injectMinScore) {
            appendDebugLog({
                decision: 'score-below-threshold',
                score: topHit.score,
                threshold: wikiConfig.injectMinScore,
                toolName,
                slug: topHit.slug,
            }, wikiRoot, settings);
            return {};
        }
        const ledgerPath = path.join(wikiRoot, '.runtime', 'injected.json');
        const ledger = readLedger(ledgerPath, sessionId);
        if (wasInjected(ledger, topHit.slug)) {
            appendDebugLog({ decision: 'already-injected', toolName, slug: topHit.slug }, wikiRoot, settings);
            return {};
        }
        const snippet = formatHit(topHit, { projectRoot: PROJECT_DIR });
        const updatedLedger = markInjected(ledger, topHit.slug);
        writeLedger(ledgerPath, updatedLedger);
        appendDebugLog({ decision: 'injected', toolName, slug: topHit.slug, score: topHit.score }, wikiRoot, settings);
        return {
            hookSpecificOutput: {
                hookEventName: 'PreToolUse',
                additionalContext: snippet,
            },
        };
    }
    catch {
        return {};
    }
}
runWhenInvoked(import.meta.url, async () => {
    const raw = await new Promise((resolve) => {
        let data = '';
        process.stdin.on('data', (chunk) => (data += chunk));
        process.stdin.on('end', () => resolve(data));
    });
    const stdinJSON = parseStdin(raw);
    if (!stdinJSON) {
        noOp();
        return;
    }
    const result = await main(stdinJSON);
    console.log(JSON.stringify(result));
    process.exit(0);
});
