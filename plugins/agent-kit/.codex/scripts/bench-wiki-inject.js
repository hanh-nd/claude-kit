#!/usr/bin/env node

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { main } from './wiki-inject-context.js';

const CORPUS_SIZE = 500;
const PAYLOAD_COUNT = 10;
const ITERATIONS = 100;
const P95_LIMIT_MS = 150;

function buildSyntheticPage(index) {
  const category = ['entities', 'concepts', 'glossary', 'preferences'][index % 4];
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

function buildSyntheticCorpus(tmpDir) {
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

function buildPayloads() {
  return [
    { tool_name: 'Read', tool_input: { file_path: '/project/anchor-42.js' }, session_id: 'bench-session' },
    { tool_name: 'Edit', tool_input: { file_path: '/project/module-17.ts', new_string: 'export function pageHelper() {}' }, session_id: 'bench-session' },
    { tool_name: 'Write', tool_input: { file_path: '/project/anchor-100.js', content: 'const x = 1;' }, session_id: 'bench-session' },
    { tool_name: 'Grep', tool_input: { pattern: 'anchor-200', path: '/project' }, session_id: 'bench-session' },
    { tool_name: 'Bash', tool_input: { command: 'ls /project' }, session_id: 'bench-session' },
    { tool_name: 'Read', tool_input: { file_path: '/project/page-300.md' }, session_id: 'bench-session' },
    { tool_name: 'Glob', tool_input: { pattern: '**/*.ts', path: '/project' }, session_id: 'bench-session' },
    { tool_name: 'Edit', tool_input: { file_path: '/project/anchor-5.js', new_string: 'module-5 helper' }, session_id: 'bench-session' },
    { tool_name: 'Read', tool_input: { file_path: '/project/page-50.md' }, session_id: 'bench-session' },
    { tool_name: 'Bash', tool_input: { command: 'node scripts/build.js' }, session_id: 'bench-session' },
  ];
}

function percentile(sortedArr, pct) {
  const idx = Math.ceil((pct / 100) * sortedArr.length) - 1;
  return sortedArr[Math.max(0, idx)];
}

async function runBench() {
  console.log('Building synthetic corpus...');
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bench-wiki-inject-'));
  try {
    buildSyntheticCorpus(tmpDir);

    const payloads = buildPayloads();
    const wikiRoot = path.join(tmpDir, 'wiki');
    const settings = { wiki: { injectMinScore: 5.0 } };

    console.log(`Running ${ITERATIONS} iterations × ${PAYLOAD_COUNT} payloads...`);
    const timings = [];

    for (let iter = 0; iter < ITERATIONS; iter++) {
      for (const payload of payloads) {
        const start = performance.now();
        await main({ ...payload, session_id: `session-${iter}` }, { wikiRoot, settings });
        timings.push(performance.now() - start);
      }
    }

    timings.sort((a, b) => a - b);
    const p95 = percentile(timings, 95);
    const p50 = percentile(timings, 50);
    const maxTime = timings[timings.length - 1];

    console.log(`Results (${timings.length} samples):`);
    console.log(`  p50: ${p50.toFixed(2)} ms`);
    console.log(`  p95: ${p95.toFixed(2)} ms`);
    console.log(`  max: ${maxTime.toFixed(2)} ms`);
    console.log(`  limit: ${P95_LIMIT_MS} ms`);

    if (p95 > P95_LIMIT_MS) {
      console.error(`FAIL: p95 ${p95.toFixed(2)} ms exceeds ${P95_LIMIT_MS} ms limit`);
      process.exit(1);
    }

    console.log(`PASS: p95 ${p95.toFixed(2)} ms <= ${P95_LIMIT_MS} ms`);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

runBench().catch((err) => {
  console.error('Bench failed:', err);
  process.exit(1);
});
