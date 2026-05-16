import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { KIT_PATH } from './constants.js';
/**
 * Runs `fn` only when this module is the direct entry point (i.e. invoked via CLI).
 * Skips execution when the module is imported for testing or reuse.
 *
 * @param {string} importMetaUrl - pass `import.meta.url` from the calling module
 * @param {() => void | Promise<void>} fn - hook body
 */
export function runWhenInvoked(importMetaUrl, fn) {
    const entryPath = fs.realpathSync(process.argv[1]);
    const modulePath = fs.realpathSync(fileURLToPath(importMetaUrl));
    if (entryPath === modulePath) {
        fn();
    }
}
/**
 * No-op function that prints an empty JSON object and exits.
 */
export function noOp() {
    console.log(JSON.stringify({}));
    process.exit(0);
}
export function loadSettings() {
    try {
        const settingsPath = path.join(KIT_PATH, 'settings.json');
        if (fs.existsSync(settingsPath)) {
            return JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
        }
    }
    catch {
        // Fall through to defaults on parse error
    }
    return {};
}
export function getWikiConfig(settings) {
    const w = settings?.wiki ?? {};
    return {
        injectMinScore: typeof w.injectMinScore === 'number' ? w.injectMinScore : 5.0,
        debug: w.debug === true,
    };
}
export function spawnBackground(scriptUrl, args = []) {
    const scriptPath = scriptUrl instanceof URL ? fileURLToPath(scriptUrl) : fileURLToPath(new URL(scriptUrl));
    const child = spawn(process.execPath, [scriptPath, ...args], {
        detached: true,
        stdio: 'ignore',
    });
    child.unref();
}
/**
 * Parse a Claude JSONL transcript into an array of { role, content } messages.
 *
 * @param {string} transcriptPath
 * @returns {Transcript}
 */
export function parseTranscript(transcriptPath) {
    if (transcriptPath.includes('.codex')) {
        return parseCodexTranscript(transcriptPath);
    }
    if (transcriptPath.includes('.gemini')) {
        return parseGeminiTranscript(transcriptPath);
    }
    return parseClaudeTranscript(transcriptPath);
}
function extractContentText(content) {
    if (typeof content === 'string')
        return content;
    if (!Array.isArray(content))
        return '';
    return content
        .map((block) => {
        if (!block || typeof block !== 'object')
            return '';
        return block.text || block.output_text || block.input_text || '';
    })
        .filter(Boolean)
        .join('\n');
}
function parseCodexTranscript(transcriptPath) {
    try {
        const content = fs.readFileSync(transcriptPath, 'utf8');
        const lines = content.trim().split('\n');
        const messages = [];
        for (const line of lines) {
            if (!line.trim())
                continue;
            try {
                const entry = JSON.parse(line);
                const payload = entry.payload;
                if (entry.type !== 'response_item' || payload?.type !== 'message')
                    continue;
                if (payload.role !== 'user' && payload.role !== 'assistant')
                    continue;
                const contentText = extractContentText(payload.content);
                if (contentText) {
                    messages.push({
                        role: payload.role,
                        content: contentText,
                    });
                }
            }
            catch {
                continue;
            }
        }
        return { messages };
    }
    catch (error) {
        if (error instanceof Error) {
            console.error('Failed to parse Codex transcript:', error.message);
        }
        return { messages: [] };
    }
}
function parseClaudeTranscript(transcriptPath) {
    try {
        const content = fs.readFileSync(transcriptPath, 'utf8');
        const lines = content.trim().split('\n');
        const messages = [];
        for (const line of lines) {
            if (!line.trim())
                continue;
            try {
                const entry = JSON.parse(line);
                // Only process user and assistant messages
                if (entry.type === 'user' || entry.type === 'assistant') {
                    const msg = entry.message;
                    if (msg && msg.role && msg.content) {
                        // Handle content that can be string or array of content blocks
                        let contentText = '';
                        if (typeof msg.content === 'string') {
                            contentText = msg.content;
                        }
                        else if (Array.isArray(msg.content)) {
                            // Extract text from content blocks
                            contentText = msg.content
                                .filter((block) => block.type === 'text')
                                .map((block) => block.text || '')
                                .join('\n');
                        }
                        if (contentText) {
                            messages.push({
                                role: msg.role,
                                content: contentText,
                            });
                        }
                    }
                }
            }
            catch {
                // Skip malformed lines
                continue;
            }
        }
        return { messages };
    }
    catch (error) {
        if (error instanceof Error) {
            console.error('Failed to parse transcript:', error.message);
        }
        return { messages: [] };
    }
}
function parseGeminiTranscript(transcriptPath) {
    try {
        const content = fs.readFileSync(transcriptPath, 'utf8');
        const lines = content.trim().split('\n');
        const messages = [];
        for (const line of lines) {
            if (!line.trim())
                continue;
            try {
                const msg = JSON.parse(line);
                if (msg.type === 'user' || msg.type === 'gemini') {
                    let contentText = '';
                    const msgContent = msg.displayContent || msg.content;
                    if (typeof msgContent === 'string') {
                        contentText = msgContent;
                    }
                    else if (Array.isArray(msgContent)) {
                        contentText = msgContent.map((block) => block.text || '').join('\n');
                    }
                    if (contentText) {
                        messages.push({
                            role: msg.type,
                            content: contentText,
                        });
                    }
                }
            }
            catch {
                // Skip malformed lines
                continue;
            }
        }
        return { messages };
    }
    catch (error) {
        if (error instanceof Error) {
            console.error('Failed to parse transcript:', error.message);
        }
        return { messages: [] };
    }
}
