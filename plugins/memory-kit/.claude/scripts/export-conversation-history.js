#!/usr/bin/env node
import * as fs from 'fs';
import * as path from 'path';
import { KIT_PATH } from './constants.js';
import { noOp, parseTranscript, runWhenInvoked } from './utils.js';
function isRecord(value) {
    return typeof value === 'object' && value !== null;
}
runWhenInvoked(import.meta.url, async () => {
    const raw = await new Promise((resolve) => {
        let data = '';
        process.stdin.on('data', (chunk) => (data += chunk));
        process.stdin.on('end', () => resolve(data));
    });
    let input;
    try {
        const parsed = JSON.parse(raw);
        if (!isRecord(parsed) || typeof parsed.transcript_path !== 'string' || typeof parsed.session_id !== 'string') {
            noOp();
            return;
        }
        input = {
            transcript_path: parsed.transcript_path,
            session_id: parsed.session_id,
        };
    }
    catch {
        noOp();
        return;
    }
    const transcriptPath = input.transcript_path;
    const sessionId = input.session_id;
    if (!transcriptPath || !sessionId) {
        noOp();
        return;
    }
    const { messages } = parseTranscript(transcriptPath);
    if (!messages.length) {
        noOp();
        return;
    }
    try {
        const outDir = path.join(KIT_PATH, 'wiki', 'raw');
        fs.mkdirSync(outDir, { recursive: true });
        const existingFiles = fs
            .readdirSync(outDir)
            .filter((file) => new RegExp(`^conv_.*_${sessionId}\\.txt$`).test(file))
            .sort();
        let outPath = path.join(outDir, `conv_${new Date().toISOString().split('T')[0]}_${sessionId}.txt`);
        if (existingFiles.length) {
            const lastFile = existingFiles[existingFiles.length - 1];
            outPath = path.join(outDir, lastFile);
        }
        const text = messages
            .map(({ role, content }) => `[${role.toUpperCase()}]\n${content}`)
            .join('\n---\n');
        fs.writeFileSync(outPath, text, 'utf8');
    }
    catch {
        // Fail-open: never block user workflow
    }
    console.log(JSON.stringify({}));
});
