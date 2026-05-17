#!/usr/bin/env node
import * as fs from 'fs';
import * as path from 'path';
import { MEMORY_DIR } from './constants.js';
import { parseTranscript, runWhenInvoked } from './utils.js';
const LOCK_RETRY_MS = 50;
const LOCK_TIMEOUT_MS = 500;
async function acquireLock(lockPath) {
    const deadline = Date.now() + LOCK_TIMEOUT_MS;
    while (Date.now() < deadline) {
        try {
            fs.writeFileSync(lockPath, String(process.pid), { flag: 'wx' });
            return true;
        }
        catch {
            await new Promise((r) => setTimeout(r, LOCK_RETRY_MS));
        }
    }
    return false;
}
function releaseLock(lockPath) {
    try {
        fs.unlinkSync(lockPath);
    }
    catch {
        // ignore
    }
}
function formatTurns(transcriptPath) {
    const transcript = parseTranscript(transcriptPath);
    if (transcript.messages.length === 0)
        return '';
    const now = new Date().toISOString();
    const lines = [`### ${now}`];
    for (const msg of transcript.messages) {
        const role = msg.role === 'assistant' || msg.role === 'gemini' ? 'Assistant' : 'User';
        lines.push(`**${role}:** ${msg.content}`);
        lines.push('');
    }
    return lines.join('\n');
}
runWhenInvoked(import.meta.url, async () => {
    let stdinData = '';
    await new Promise((resolve) => {
        process.stdin.on('data', (chunk) => (stdinData += chunk));
        process.stdin.on('end', () => resolve());
    });
    let transcriptPath;
    try {
        const parsed = JSON.parse(stdinData);
        if (typeof parsed === 'object' && parsed !== null) {
            const p = parsed;
            transcriptPath =
                typeof p.transcript_path === 'string' ? p.transcript_path : undefined;
        }
    }
    catch {
        // fall through
    }
    if (!transcriptPath) {
        console.log(JSON.stringify({}));
        process.exit(0);
    }
    let content;
    try {
        content = formatTurns(transcriptPath);
    }
    catch {
        console.log(JSON.stringify({}));
        process.exit(0);
    }
    if (!content) {
        console.log(JSON.stringify({}));
        process.exit(0);
    }
    const now = new Date();
    const datePart = now.toISOString().slice(0, 10);
    const todayPath = path.join(MEMORY_DIR, `${datePart}.md`);
    const lockPath = `${todayPath}.lock`;
    try {
        fs.mkdirSync(MEMORY_DIR, { recursive: true });
    }
    catch {
        // ignore
    }
    const acquired = await acquireLock(lockPath);
    try {
        fs.appendFileSync(todayPath, `\n${content}\n`, 'utf8');
    }
    catch (err) {
        console.error('[memory-kit] Failed to write session end content:', err);
    }
    finally {
        if (acquired)
            releaseLock(lockPath);
    }
    console.log(JSON.stringify({}));
    process.exit(0);
});
