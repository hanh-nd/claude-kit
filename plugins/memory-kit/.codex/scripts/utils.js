import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { KIT_PATH } from './constants.js';
export function runWhenInvoked(importMetaUrl, fn) {
    if (!process.argv[1])
        return;
    const entryPath = fs.realpathSync(process.argv[1]);
    const modulePath = fs.realpathSync(fileURLToPath(importMetaUrl));
    if (entryPath === modulePath) {
        void fn();
    }
}
export function noOp() {
    console.log(JSON.stringify({}));
    process.exit(0);
}
function isRecord(value) {
    return typeof value === 'object' && value !== null;
}
export function loadSettings() {
    try {
        const settingsPath = path.join(KIT_PATH, 'settings.json');
        if (fs.existsSync(settingsPath)) {
            const parsed = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
            return isRecord(parsed) ? parsed : {};
        }
    }
    catch {
        // Fall through to defaults on parse error
    }
    return {};
}
export function getWikiConfig(settings) {
    const w = isRecord(settings.wiki) ? settings.wiki : {};
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
        if (!isRecord(block))
            return '';
        return block.text || block.output_text || block.input_text || '';
    })
        .filter((text) => typeof text === 'string')
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
                if (!isRecord(entry))
                    continue;
                const payload = entry.payload;
                if (!isRecord(payload))
                    continue;
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
                if (!isRecord(entry))
                    continue;
                // Only process user and assistant messages
                if (entry.type === 'user' || entry.type === 'assistant') {
                    const msg = entry.message;
                    if (isRecord(msg) && (msg.role === 'user' || msg.role === 'assistant') && msg.content) {
                        // Handle content that can be string or array of content blocks
                        let contentText = '';
                        if (typeof msg.content === 'string') {
                            contentText = msg.content;
                        }
                        else if (Array.isArray(msg.content)) {
                            // Extract text from content blocks
                            contentText = msg.content
                                .filter((block) => isRecord(block) && block.type === 'text')
                                .map((block) => block.text ?? '')
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
                if (!isRecord(msg))
                    continue;
                if (msg.type === 'user' || msg.type === 'gemini') {
                    let contentText = '';
                    const msgContent = msg.displayContent || msg.content;
                    if (typeof msgContent === 'string') {
                        contentText = msgContent;
                    }
                    else if (Array.isArray(msgContent)) {
                        contentText = msgContent
                            .filter((block) => isRecord(block))
                            .map((block) => block.text ?? '')
                            .join('\n');
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
