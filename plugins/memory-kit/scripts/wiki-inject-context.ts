#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';

import { KIT_PATH, PROJECT_DIR } from './constants.js';
import { getWikiConfig, loadSettings, noOp, runWhenInvoked } from './utils.js';
import { extractQuery } from './wiki/extract-query.js';
import { formatHit } from './wiki/format-hit.js';
import { applyMarginGate, applyStrongSignalGate, applyThresholdGate } from './wiki/gates.js';
import { loadOrBuildIndex } from './wiki/index-cache.js';
import { markInjected, readLedger, wasInjected, writeLedger } from './wiki/ledger.js';
import { markCooldown, isOnCooldown, readCooldown, writeCooldown } from './wiki/cooldown.js';
import { queryHash } from './wiki/query-hash.js';
import { scoreQuery } from './wiki/score-query.js';
import { shouldRun } from './wiki/trigger-gate.js';
import type { DebugDecision, MainResponse, WikiInjectOptions, WikiInjectStdin } from '@types';
import type { Settings, WikiHit } from '@types';

function appendDebugLog(decision: DebugDecision, wikiRoot: string, settings: Settings): void {
  try {
    const wikiConfig = getWikiConfig(settings);
    if (!wikiConfig.debug) {
      return;
    }

    const logPath = path.join(wikiRoot, '.runtime', 'debug.log');
    fs.mkdirSync(path.dirname(logPath), { recursive: true });
    const line = `${new Date().toISOString()} ${JSON.stringify(decision)}\n`;
    fs.appendFileSync(logPath, line, 'utf8');
  } catch (error) {
    const logFile = path.join(KIT_PATH, 'debug.log');
    const errorMessage = error instanceof Error ? error.message : String(error);
    fs.appendFileSync(logFile, JSON.stringify({ error: errorMessage }), 'utf8');
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseStdin(raw: string): WikiInjectStdin | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || typeof parsed.tool_name !== 'string') return null;
    return {
      tool_name: parsed.tool_name,
      tool_input: isRecord(parsed.tool_input) ? parsed.tool_input : undefined,
      session_id: typeof parsed.session_id === 'string' ? parsed.session_id : null,
    };
  } catch {
    return null;
  }
}

export async function main(stdinJSON: WikiInjectStdin, opts: WikiInjectOptions = {}): Promise<MainResponse | Record<string, never>> {
  try {
    const wikiRoot = opts.wikiRoot ?? path.join(KIT_PATH, 'wiki');
    const settings = opts.settings ?? loadSettings();
    const config = getWikiConfig(settings);

    const toolName = stdinJSON?.tool_name;
    if (!toolName) return {};

    const toolInput = stdinJSON.tool_input ?? {};
    const sessionId = stdinJSON.session_id ?? null;

    // FM-1: verify wiki root exists
    let wikiRootValid = false;
    try {
      wikiRootValid = fs.statSync(wikiRoot).isDirectory();
    } catch {
      wikiRootValid = false;
    }
    if (!wikiRootValid) return {};

    // Phase 1: pre-check with empty anchor prefixes — avoids loading the index for
    // shell/no-field denies (the common fast-reject path).
    // The only case that needs a retry is a read-type tool whose file extension is not
    // in CODE_EXTENSIONS but might be covered by an anchor-path prefix in the corpus.
    const preGate = shouldRun(toolName, toolInput, new Set<string>(), config);
    if (!preGate.allow && preGate.reason !== 'read-no-code-ext-or-anchor-prefix') {
      appendDebugLog({ decision: 'gate-rejected', toolName, reason: preGate.reason }, wikiRoot, settings);
      return {};
    }

    // Load corpus index (always needed for scoring, and supplies anchor prefixes for phase 2)
    const corpus = loadOrBuildIndex(wikiRoot, config);

    // Phase 2: re-check only when the pre-gate was conditionally denied (read + no code ext)
    if (!preGate.allow) {
      const anchorPathPrefixes = new Set<string>(
        corpus.pages.flatMap((e) =>
          e.page.anchors.flatMap((a) => {
            const parts = a.replace(/\\/g, '/').split('/').filter(Boolean);
            const prefixes: string[] = [];
            for (let i = 1; i < parts.length; i++) {
              prefixes.push('/' + parts.slice(0, i).join('/'));
            }
            return prefixes;
          }),
        ),
      );
      const fullGate = shouldRun(toolName, toolInput, anchorPathPrefixes, config);
      if (!fullGate.allow) {
        appendDebugLog({ decision: 'gate-rejected', toolName, reason: fullGate.reason }, wikiRoot, settings);
        return {};
      }
    }

    const query = extractQuery(toolName, toolInput, config);

    // FM-8: min query tokens gate
    if (query.terms.length < config.minQueryTokens) {
      appendDebugLog({ decision: 'min-query-tokens', toolName, reason: `terms=${query.terms.length} < min=${config.minQueryTokens}` }, wikiRoot, settings);
      return {};
    }

    const pages = corpus.pages.map((e) => e.page);
    if (pages.length === 0) return {};

    // Pre-build slug→mtime lookup to avoid repeated O(n) scans below
    const slugToMtime = new Map<string, number>(corpus.pages.map((e) => [e.slug, e.mtimeMs]));

    let hits: WikiHit[] = scoreQuery(query, pages, corpus.idf, corpus.avgBodyLength, corpus.avgSlugLen, corpus.avgHeadingLen, corpus.avgKdLen);

    // Gate: strong signal
    hits = applyStrongSignalGate(hits);
    if (hits.length === 0) {
      appendDebugLog({ decision: 'strong-signal-gate', toolName, reason: 'no strong-signal hits' }, wikiRoot, settings);
      return {};
    }

    // Gate: threshold
    hits = applyThresholdGate(hits, config.injectMinScore);
    if (hits.length === 0) {
      appendDebugLog({ decision: 'threshold', toolName, reason: `below injectMinScore=${config.injectMinScore}` }, wikiRoot, settings);
      return {};
    }

    // Gate: margin
    hits = applyMarginGate(hits, config.injectMarginRatio);
    if (hits.length === 0) {
      appendDebugLog({ decision: 'margin', toolName, reason: `margin ratio < ${config.injectMarginRatio}` }, wikiRoot, settings);
      return {};
    }

    const top3 = hits.slice(0, 3).map((h) => ({ slug: h.slug, score: h.score, breakdown: h.breakdown }));
    const maxResults = Math.min(hits.length, config.injectMaxResults, 2);
    const candidates = hits.slice(0, maxResults);

    // Dedupe check
    const ledgerPath = path.join(wikiRoot, '.runtime', 'injected.json');
    const cooldownPath = path.join(wikiRoot, '.runtime', 'cooldown.json');
    let sessionLedger = readLedger(ledgerPath, sessionId);
    let cooldownLedger = readCooldown(cooldownPath, config.cooldownHours);

    const hash = queryHash(query);
    const surviving: WikiHit[] = [];
    for (const hit of candidates) {
      const pageMtimeMs = slugToMtime.get(hit.slug) ?? 0;
      if (wasInjected(sessionLedger, hit.slug, hash)) continue;
      if (isOnCooldown(cooldownLedger, hit.slug, pageMtimeMs, config.cooldownHours)) continue;
      surviving.push(hit);
    }

    if (surviving.length === 0) {
      appendDebugLog({ decision: 'all-deduped', toolName, reason: 'session or cooldown blocked all candidates' }, wikiRoot, settings);
      return {};
    }

    const snippets: string[] = [];
    const injectedSlugs: string[] = [];
    for (const hit of surviving) {
      snippets.push(formatHit(hit, { projectRoot: PROJECT_DIR }));
      injectedSlugs.push(hit.slug);
      const pageMtimeMs = slugToMtime.get(hit.slug) ?? 0;
      sessionLedger = markInjected(sessionLedger, hit.slug, hash);
      cooldownLedger = markCooldown(cooldownLedger, hit.slug, hash, pageMtimeMs);
    }

    writeLedger(ledgerPath, sessionLedger);
    writeCooldown(cooldownPath, cooldownLedger);

    appendDebugLog(
      {
        decision: 'injected',
        toolName,
        injectedSlugs,
        top3,
        breakdown: surviving[0]?.breakdown,
      },
      wikiRoot,
      settings,
    );

    return {
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        additionalContext: snippets.join('\n\n'),
      },
    };
  } catch {
    return {};
  }
}

runWhenInvoked(import.meta.url, async () => {
  const raw = await new Promise<string>((resolve) => {
    let data = '';
    process.stdin.on('data', (chunk) => (data += chunk));
    process.stdin.on('end', () => resolve(data));
  });

  const stdinJSON = parseStdin(raw);
  if (!stdinJSON) {
    noOp();
  }

  const result = await main(stdinJSON);
  console.log(JSON.stringify(result));
  process.exit(0);
});
