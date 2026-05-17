#!/usr/bin/env node

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { main } from './wiki-inject-context.js';
import type { Settings } from '@types';
import type { WikiInjectStdin } from '@types';

const CORPUS_SIZE = 100;
const PAYLOAD_COUNT = 10;
const ITERATIONS = 100;
const P95_LIMIT_MS = 50;
const P95_LIMIT_MS_WARM = 10;

function buildSyntheticPage(index: number): string {
  const slug = `page-${index}`;
  return `# Page ${index}

Status: active
> Last updated: 2025-01-01

## Summary
This is a synthetic wiki page number ${index} used for benchmarking the wiki injection hook.

## Anchors
- anchor-${index}.js
- module-${index}.ts

## Key Decisions
- Decision alpha for page ${index} which explains the core approach taken
- Decision beta covering edge cases and boundary conditions
- Decision gamma about performance characteristics

## Edge Cases & Risks
- Risk one: when the value of index is ${index} mod 7 equals zero
- Risk two: concurrent access patterns during high load
`;
}

function buildSyntheticCorpus(tmpDir: string): void {
  const categories = ['entities', 'concepts', 'glossary', 'preferences'];
  for (const cat of categories) {
    fs.mkdirSync(path.join(tmpDir, 'wiki', 'compiled', cat), { recursive: true });
  }

  for (let i = 0; i < CORPUS_SIZE; i++) {
    const category = categories[i % categories.length];
    const content = buildSyntheticPage(i);
    const filePath = path.join(tmpDir, 'wiki', 'compiled', category, `page-${i}.md`);
    fs.writeFileSync(filePath, content, 'utf8');
  }
}

function buildPayloads(): WikiInjectStdin[] {
  return [
    { tool_name: 'Read', tool_input: { file_path: '/project/anchor-42.js' }, session_id: 'bench-session' },
    { tool_name: 'Edit', tool_input: { file_path: '/project/module-17.ts', new_string: 'export function pageHelper() {}' }, session_id: 'bench-session' },
    { tool_name: 'Write', tool_input: { file_path: '/project/anchor-10.js', content: 'const x = 1;' }, session_id: 'bench-session' },
    { tool_name: 'Bash', tool_input: { command: 'ls /project' }, session_id: 'bench-session' },
    { tool_name: 'Read', tool_input: { file_path: '/project/module-30.ts' }, session_id: 'bench-session' },
    { tool_name: 'Edit', tool_input: { file_path: '/project/anchor-5.js', new_string: 'module-5 helper function for page 5' }, session_id: 'bench-session' },
    { tool_name: 'Read', tool_input: { file_path: '/project/anchor-50.js' }, session_id: 'bench-session' },
    { tool_name: 'Write', tool_input: { file_path: '/project/module-60.ts', content: 'export class PageService {}' }, session_id: 'bench-session' },
    { tool_name: 'Edit', tool_input: { file_path: '/project/module-25.ts', new_string: 'decision alpha beta gamma' }, session_id: 'bench-session' },
    { tool_name: 'Read', tool_input: { file_path: '/project/anchor-80.js' }, session_id: 'bench-session' },
  ];
}

function percentile(sortedArr: number[], pct: number): number {
  const idx = Math.ceil((pct / 100) * sortedArr.length) - 1;
  return sortedArr[Math.max(0, idx)];
}

async function runBench(): Promise<void> {
  console.log('Building synthetic corpus...');
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bench-wiki-inject-'));
  try {
    buildSyntheticCorpus(tmpDir);

    const payloads = buildPayloads();
    const wikiRoot = path.join(tmpDir, 'wiki');
    const settings: Settings = { wiki: { injectMinScore: 5.0 } };

    console.log(`Running cold pass: ${ITERATIONS} iterations × ${PAYLOAD_COUNT} payloads (${CORPUS_SIZE}-page corpus)...`);
    const coldTimings: number[] = [];

    for (let iter = 0; iter < ITERATIONS; iter++) {
      for (const payload of payloads) {
        const start = performance.now();
        await main({ ...payload, session_id: `session-cold-${iter}` }, { wikiRoot, settings });
        coldTimings.push(performance.now() - start);
      }
    }

    coldTimings.sort((a, b) => a - b);
    const p95Cold = percentile(coldTimings, 95);
    const p50Cold = percentile(coldTimings, 50);

    console.log(`Cold results (${coldTimings.length} samples):`);
    console.log(`  p50: ${p50Cold.toFixed(2)} ms`);
    console.log(`  p95: ${p95Cold.toFixed(2)} ms  (limit: ${P95_LIMIT_MS} ms)`);
    console.log(`  max: ${coldTimings[coldTimings.length - 1].toFixed(2)} ms`);

    // Warm pass — re-run same payloads with same session so cache is warm
    console.log(`\nRunning warm pass: ${ITERATIONS} iterations × ${PAYLOAD_COUNT} payloads...`);
    const warmTimings: number[] = [];
    const warmSession = 'session-warm';

    // Prime the session ledger + cooldown ledger for warmSession so the warm loop hits the dedup fast-exit path
    for (const payload of payloads) {
      await main({ ...payload, session_id: warmSession }, { wikiRoot, settings: { wiki: { injectMinScore: 1.0 } } });
    }

    for (let iter = 0; iter < ITERATIONS; iter++) {
      for (const payload of payloads) {
        const start = performance.now();
        await main({ ...payload, session_id: warmSession }, { wikiRoot, settings });
        warmTimings.push(performance.now() - start);
      }
    }

    warmTimings.sort((a, b) => a - b);
    const p95Warm = percentile(warmTimings, 95);
    const p50Warm = percentile(warmTimings, 50);

    console.log(`Warm results (${warmTimings.length} samples):`);
    console.log(`  p50: ${p50Warm.toFixed(2)} ms`);
    console.log(`  p95: ${p95Warm.toFixed(2)} ms  (limit: ${P95_LIMIT_MS_WARM} ms)`);
    console.log(`  max: ${warmTimings[warmTimings.length - 1].toFixed(2)} ms`);

    let failed = false;
    if (p95Cold > P95_LIMIT_MS) {
      console.error(`\nFAIL: cold p95 ${p95Cold.toFixed(2)} ms exceeds ${P95_LIMIT_MS} ms limit`);
      failed = true;
    }
    if (p95Warm > P95_LIMIT_MS_WARM) {
      console.error(`FAIL: warm p95 ${p95Warm.toFixed(2)} ms exceeds ${P95_LIMIT_MS_WARM} ms limit`);
      failed = true;
    }
    if (failed) process.exit(1);

    console.log(`\nPASS: cold p95 ${p95Cold.toFixed(2)} ms <= ${P95_LIMIT_MS} ms, warm p95 ${p95Warm.toFixed(2)} ms <= ${P95_LIMIT_MS_WARM} ms`);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

runBench().catch((err) => {
  console.error('Bench failed:', err);
  process.exit(1);
});
