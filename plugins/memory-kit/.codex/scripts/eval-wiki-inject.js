#!/usr/bin/env node
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { main } from './wiki-inject-context.js';
function readEvents(eventsPath) {
    const lines = fs.readFileSync(eventsPath, 'utf8').trim().split('\n');
    return lines
        .filter((l) => l.trim())
        .map((l) => JSON.parse(l));
}
function readExpected(expectedPath) {
    return JSON.parse(fs.readFileSync(expectedPath, 'utf8'));
}
function copyDir(src, dest) {
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        if (entry.isDirectory()) {
            copyDir(srcPath, destPath);
        }
        else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}
async function runEval() {
    const fixtureDir = path.join(process.cwd(), 'tests', 'fixtures', 'wiki-eval');
    const eventsPath = path.join(fixtureDir, 'events.jsonl');
    const expectedPath = path.join(fixtureDir, 'expected.json');
    if (!fs.existsSync(eventsPath) || !fs.existsSync(expectedPath)) {
        console.error('Missing fixture files: tests/fixtures/wiki-eval/events.jsonl or expected.json');
        process.exit(1);
    }
    const events = readEvents(eventsPath);
    const expected = readExpected(expectedPath);
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'eval-wiki-inject-'));
    try {
        // Use a temp wiki root (no real wiki pages; eval relies on fixtures having their own wiki)
        const wikiRoot = path.join(tmpDir, 'wiki');
        fs.mkdirSync(path.join(wikiRoot, 'compiled', 'entities'), { recursive: true });
        let truePositives = 0;
        let falsePositives = 0;
        let falseNegatives = 0;
        let correctRejects = 0;
        let incorrectRejects = 0;
        const missed = [];
        for (const event of events) {
            const exp = expected[event.eventId];
            if (!exp)
                continue;
            const stdin = {
                tool_name: event.tool_name,
                tool_input: event.tool_input,
                session_id: event.session_id ?? `eval-${event.eventId}`,
            };
            const result = await main(stdin, { wikiRoot, settings: { wiki: { injectMinScore: 1.0 } } });
            const injected = 'hookSpecificOutput' in result && result.hookSpecificOutput;
            if (exp.expectedSlug) {
                if (injected && result.hookSpecificOutput?.additionalContext.includes(exp.expectedSlug)) {
                    truePositives++;
                }
                else if (injected) {
                    falsePositives++;
                    missed.push(`${event.eventId}: injected wrong slug (expected ${exp.expectedSlug})`);
                }
                else {
                    falseNegatives++;
                    missed.push(`${event.eventId}: expected injection of ${exp.expectedSlug} but got {}`);
                }
            }
            else if (exp.expectedReject) {
                if (!injected) {
                    correctRejects++;
                }
                else {
                    incorrectRejects++;
                    missed.push(`${event.eventId}: expected reject (${exp.expectedReject}) but got injection`);
                }
            }
        }
        const totalAnchor = truePositives + falseNegatives;
        const precision = totalAnchor > 0 ? truePositives / (truePositives + falsePositives) : 1;
        const recall = totalAnchor > 0 ? truePositives / totalAnchor : 1;
        const totalReject = correctRejects + incorrectRejects;
        const falseFireRate = totalReject > 0 ? incorrectRejects / totalReject : 0;
        console.log('\nEval Results:');
        console.log(`  Precision: ${(precision * 100).toFixed(1)}% (${truePositives}/${truePositives + falsePositives})`);
        console.log(`  Recall:    ${(recall * 100).toFixed(1)}% (${truePositives}/${totalAnchor})`);
        console.log(`  False-fire rate: ${(falseFireRate * 100).toFixed(1)}% (${incorrectRejects}/${totalReject})`);
        if (missed.length > 0) {
            console.error('\nMissed targets:');
            for (const m of missed)
                console.error(`  - ${m}`);
            process.exit(1);
        }
        console.log('\nPASS: all labeled targets met');
    }
    finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
}
runEval().catch((err) => {
    console.error('Eval failed:', err);
    process.exit(1);
});
