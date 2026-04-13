#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';

import { KIT_PATH } from './constants.js';
import { noOp, parseTranscript, runWhenInvoked } from './utils.js';

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

  const transcriptPath = input.transcript_path;
  const sessionId = input.session_id;
  if (!transcriptPath || !sessionId) {
    noOp();
  }

  const { messages } = parseTranscript(transcriptPath);
  if (!messages.length) {
    noOp();
  }

  try {
    const outDir = path.join(KIT_PATH, 'wiki', 'raw');
    fs.mkdirSync(outDir, { recursive: true });

    const existingFiles = fs
      .readdirSync(outDir)
      .filter((file) => new RegExp(`^conv_.*_${sessionId}\.txt$`).test(file))
      .sort();
    let outPath = path.join(
      outDir,
      `conv_${new Date().toISOString().split('T')[0]}_${sessionId}.txt`
    );
    if (existingFiles.length) {
      const lastFile = existingFiles[existingFiles.length - 1];
      outPath = path.join(outDir, lastFile);
    }
    const text = messages
      .map(({ role, content }) => `[${role.toUpperCase()}]\n${content}`)
      .join('\n---\n');
    fs.writeFileSync(outPath, text, 'utf8');
  } catch {
    // Fail-open: never block user workflow
  }

  console.log(JSON.stringify({}));
});
