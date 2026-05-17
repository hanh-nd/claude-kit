#!/usr/bin/env node

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { main } from '../scripts/wiki-inject-context.js';
import { copyCompiledWiki, resolveDogfoodWikiRoot } from './dogfood-fixture.js';
import type { Settings, WikiInjectStdin } from '@types';

const COLD_SAMPLES = 12;
const WARM_ITERATIONS = 100;
const DEDUPE_ITERATIONS = 100;

const P95_LIMIT_MS_COLD = 100;
const P95_LIMIT_MS_WARM = 25;
const P95_LIMIT_MS_DEDUPE = 10;

const SETTINGS: Settings = {
  wiki: {
    injectMinScore: 1.0,
    injectMarginRatio: 1.0,
    injectMaxResults: 1,
  },
};

const PAYLOADS: WikiInjectStdin[] = [
  { tool_name: 'Read', tool_input: { file_path: '/repo/src/utils/credentials.ts' }, session_id: 'bench' },
  { tool_name: 'Edit', tool_input: { file_path: '/repo/src/tools/integration.ts', new_string: 'preserve Atlassian Document Format tables in ticket markdown' }, session_id: 'bench' },
  { tool_name: 'Edit', tool_input: { file_path: '/repo/scripts/inject-agent-instructions.js', new_string: 'inject docs/instruction.md and wiki compiled index at startup' }, session_id: 'bench' },
  { tool_name: 'Edit', tool_input: { file_path: '/repo/src/tools/security.ts', new_string: 'validate workspace boundary and forbidden path segments case-insensitively' }, session_id: 'bench' },
  { tool_name: 'Read', tool_input: { file_path: '/repo/src/kit-server.ts' }, session_id: 'bench' },
  { tool_name: 'Edit', tool_input: { file_path: '/repo/hooks/hooks.json', new_string: 'wire SessionEnd clear export and SessionStart clear reinject hooks' }, session_id: 'bench' },
  { tool_name: 'Edit', tool_input: { file_path: '/repo/scripts/wiki-inbox-append.js', new_string: 'on file I/O error call noOp and process.exit(0)' }, session_id: 'bench' },
  { tool_name: 'Read', tool_input: { file_path: '/repo/.claude-plugin/marketplace.json' }, session_id: 'bench' },
  { tool_name: 'Edit', tool_input: { file_path: '/repo/plugins/agent-kit/package.json', new_string: 'keep each plugin self-contained with independent build scripts' }, session_id: 'bench' },
  { tool_name: 'Bash', tool_input: { command: 'git status' }, session_id: 'bench' },
  { tool_name: 'Read', tool_input: { file_path: '/repo/reports/finance.xlsx' }, session_id: 'bench' },
  { tool_name: 'Read', tool_input: { file_path: '/repo/assets/logo.png' }, session_id: 'bench' },
];

const DEDUPE_PAYLOADS = PAYLOADS.slice(0, 6);

interface Fixture {
  tmpDir: string;
  wikiRoot: string;
}

function percentile(sortedArr: number[], pct: number): number {
  const idx = Math.ceil((pct / 100) * sortedArr.length) - 1;
  return sortedArr[Math.max(0, idx)];
}

function summarize(name: string, timings: number[], limit: number): boolean {
  timings.sort((a, b) => a - b);
  const p50 = percentile(timings, 50);
  const p95 = percentile(timings, 95);
  const max = timings[timings.length - 1];
  console.log(`${name} results (${timings.length} samples):`);
  console.log(`  p50: ${p50.toFixed(2)} ms`);
  console.log(`  p95: ${p95.toFixed(2)} ms  (limit: ${limit} ms)`);
  console.log(`  max: ${max.toFixed(2)} ms`);
  if (p95 > limit) {
    console.error(`FAIL: ${name} p95 ${p95.toFixed(2)} ms exceeds ${limit} ms limit`);
    return false;
  }
  return true;
}

function createFixture(sourceWikiRoot: string): Fixture {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bench-wiki-inject-'));
  const wikiRoot = path.join(tmpDir, '.agent-kit', 'wiki');
  copyCompiledWiki(sourceWikiRoot, wikiRoot);
  return { tmpDir, wikiRoot };
}

async function measureCold(sourceWikiRoot: string): Promise<number[]> {
  const timings: number[] = [];
  for (let i = 0; i < COLD_SAMPLES; i++) {
    const fixture = createFixture(sourceWikiRoot);
    try {
      const payload = PAYLOADS[i % PAYLOADS.length];
      const start = performance.now();
      await main({ ...payload, session_id: `bench-cold-${i}` }, { wikiRoot: fixture.wikiRoot, settings: SETTINGS });
      timings.push(performance.now() - start);
    } finally {
      fs.rmSync(fixture.tmpDir, { recursive: true, force: true });
    }
  }
  return timings;
}

async function measureWarm(wikiRoot: string): Promise<number[]> {
  await main({ ...PAYLOADS[0], session_id: 'bench-warm-prime' }, { wikiRoot, settings: SETTINGS });

  const timings: number[] = [];
  for (let iter = 0; iter < WARM_ITERATIONS; iter++) {
    for (let i = 0; i < PAYLOADS.length; i++) {
      const payload = PAYLOADS[i];
      const start = performance.now();
      await main({ ...payload, session_id: `bench-warm-${iter}-${i}` }, { wikiRoot, settings: SETTINGS });
      timings.push(performance.now() - start);
    }
  }
  return timings;
}

async function measureDedupe(wikiRoot: string): Promise<number[]> {
  const sessionId = 'bench-dedupe';
  for (const payload of DEDUPE_PAYLOADS) {
    await main({ ...payload, session_id: sessionId }, { wikiRoot, settings: SETTINGS });
  }

  const timings: number[] = [];
  for (let iter = 0; iter < DEDUPE_ITERATIONS; iter++) {
    for (const payload of DEDUPE_PAYLOADS) {
      const start = performance.now();
      await main({ ...payload, session_id: sessionId }, { wikiRoot, settings: SETTINGS });
      timings.push(performance.now() - start);
    }
  }
  return timings;
}

async function runBench(): Promise<void> {
  const sourceWikiRoot = resolveDogfoodWikiRoot();
  console.log('Wiki Inject Bench');
  console.log(`  corpus: ${sourceWikiRoot}`);
  console.log(`  payloads: ${PAYLOADS.length}`);

  const coldTimings = await measureCold(sourceWikiRoot);

  const fixture = createFixture(sourceWikiRoot);
  try {
    const warmTimings = await measureWarm(fixture.wikiRoot);
    const dedupeTimings = await measureDedupe(fixture.wikiRoot);

    console.log('');
    const coldOk = summarize('Cold build', coldTimings, P95_LIMIT_MS_COLD);
    console.log('');
    const warmOk = summarize('Warm retrieval', warmTimings, P95_LIMIT_MS_WARM);
    console.log('');
    const dedupeOk = summarize('Dedupe fast path', dedupeTimings, P95_LIMIT_MS_DEDUPE);

    if (!coldOk || !warmOk || !dedupeOk) process.exit(1);
    console.log('\nPASS: wiki injection latency stayed within p95 limits');
  } finally {
    fs.rmSync(fixture.tmpDir, { recursive: true, force: true });
  }
}

runBench().catch((err) => {
  console.error('Bench failed:', err);
  process.exit(1);
});
