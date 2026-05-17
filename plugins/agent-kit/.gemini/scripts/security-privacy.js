#!/usr/bin/env node
import { runSecurityPrivacyHook } from './security/hook-runner.js';
import { noOp, runWhenInvoked } from './utils.js';
function readStdin() {
    return new Promise((resolve) => {
        let data = '';
        process.stdin.on('data', (chunk) => (data += chunk.toString()));
        process.stdin.on('end', () => resolve(data));
    });
}
runWhenInvoked(import.meta.url, async () => {
    runSecurityPrivacyHook(await readStdin());
    noOp();
});
