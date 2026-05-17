import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { KIT_PATH } from './constants.js';
import type { Settings, WikiConfig } from '@types';
import type { ContentBlock, Message, Transcript } from '@types';

export function runWhenInvoked(importMetaUrl: string, fn: () => void | Promise<void>): void {
  if (!process.argv[1]) return;
  const entryPath = fs.realpathSync(process.argv[1]);
  const modulePath = fs.realpathSync(fileURLToPath(importMetaUrl));
  if (entryPath === modulePath) {
    void fn();
  }
}

export function noOp(): never {
  console.log(JSON.stringify({}));
  process.exit(0);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function loadSettings(): Settings {
  try {
    const settingsPath = path.join(KIT_PATH, 'settings.json');
    if (fs.existsSync(settingsPath)) {
      const parsed: unknown = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      return isRecord(parsed) ? parsed : {};
    }
  } catch {
    // Fall through to defaults on parse error
  }
  return {};
}

export function getWikiConfig(settings: Settings): WikiConfig {
  const w = isRecord(settings.wiki) ? settings.wiki : {};

  let injectMaxResults = typeof w.injectMaxResults === 'number' ? w.injectMaxResults : 1;
  if (injectMaxResults < 1) injectMaxResults = 1;
  if (injectMaxResults > 2) injectMaxResults = 2; // hard cap: injecting more risks overwhelming the context window

  return {
    injectMinScore: typeof w.injectMinScore === 'number' ? w.injectMinScore : 5.0,
    debug: w.debug === true,
    injectMarginRatio: typeof w.injectMarginRatio === 'number' ? w.injectMarginRatio : 1.5,
    injectMaxResults,
    minQueryTokens: typeof w.minQueryTokens === 'number' ? w.minQueryTokens : 2,
    cooldownHours: typeof w.cooldownHours === 'number' ? w.cooldownHours : 24,
    cacheEnabled: w.cacheEnabled === false ? false : true,
    bashAllowlist:
      isRecord(w.bashAllowlist) &&
      (w.bashAllowlist.mode === 'denylist' || w.bashAllowlist.mode === 'allowlist') &&
      Array.isArray(w.bashAllowlist.patterns)
        ? {
            mode: w.bashAllowlist.mode,
            patterns: w.bashAllowlist.patterns.filter((p): p is string => typeof p === 'string'),
          }
        : {
            mode: 'denylist',
            patterns: [
              '^ls(\\s|$)',
              '^pwd(\\s|$)',
              '^echo(\\s|$)',
              '^cd(\\s|$)',
              '^cat(\\s|$)',
              '^git\\s+(status|log|diff|branch|show)(\\s|$)',
            ],
          },
    stopwords: Array.isArray(w.stopwords)
      ? w.stopwords.filter((v): v is string => typeof v === 'string')
      : ['the', 'and', 'for', 'with', 'from', 'this', 'that', 'into', 'onto'],
  };
}

export function spawnBackground(scriptUrl: string | URL, args: string[] = []): void {
  const scriptPath =
    scriptUrl instanceof URL ? fileURLToPath(scriptUrl) : fileURLToPath(new URL(scriptUrl));

  const child = spawn(process.execPath, [scriptPath, ...args], {
    detached: true,
    stdio: 'ignore',
  });
  child.unref();
}

export function parseTranscript(transcriptPath: string): Transcript {
  if (transcriptPath.includes('.codex')) {
    return parseCodexTranscript(transcriptPath);
  }
  if (transcriptPath.includes('.gemini')) {
    return parseGeminiTranscript(transcriptPath);
  }
  return parseClaudeTranscript(transcriptPath);
}

function extractContentText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';

  return content
    .map((block) => {
      if (!isRecord(block)) return '';
      return block.text || block.output_text || block.input_text || '';
    })
    .filter((text): text is string => typeof text === 'string')
    .filter(Boolean)
    .join('\n');
}

function parseCodexTranscript(transcriptPath: string): Transcript {
  try {
    const content = fs.readFileSync(transcriptPath, 'utf8');
    const lines = content.trim().split('\n');
    const messages: Message[] = [];

    for (const line of lines) {
      if (!line.trim()) continue;

      try {
        const entry: unknown = JSON.parse(line);
        if (!isRecord(entry)) continue;
        const payload = entry.payload;
        if (!isRecord(payload)) continue;
        if (entry.type !== 'response_item' || payload?.type !== 'message') continue;
        if (payload.role !== 'user' && payload.role !== 'assistant') continue;

        const contentText = extractContentText(payload.content);
        if (contentText) {
          messages.push({
            role: payload.role,
            content: contentText,
          });
        }
      } catch {
        continue;
      }
    }

    return { messages };
  } catch (error) {
    if (error instanceof Error) {
      console.error('Failed to parse Codex transcript:', error.message);
    }
    return { messages: [] };
  }
}

function parseClaudeTranscript(transcriptPath: string): Transcript {
  try {
    const content = fs.readFileSync(transcriptPath, 'utf8');
    const lines = content.trim().split('\n');
    const messages: Message[] = [];

    for (const line of lines) {
      if (!line.trim()) continue;

      try {
        const entry: unknown = JSON.parse(line);
        if (!isRecord(entry)) continue;

        // Only process user and assistant messages
        if (entry.type === 'user' || entry.type === 'assistant') {
          const msg = entry.message;
          if (isRecord(msg) && (msg.role === 'user' || msg.role === 'assistant') && msg.content) {
            // Handle content that can be string or array of content blocks
            let contentText = '';
            if (typeof msg.content === 'string') {
              contentText = msg.content;
            } else if (Array.isArray(msg.content)) {
              // Extract text from content blocks
              contentText = msg.content
                .filter((block): block is ContentBlock => isRecord(block) && block.type === 'text')
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
      } catch {
        // Skip malformed lines
        continue;
      }
    }

    return { messages };
  } catch (error) {
    if (error instanceof Error) {
      console.error('Failed to parse transcript:', error.message);
    }
    return { messages: [] };
  }
}

function parseGeminiTranscript(transcriptPath: string): Transcript {
  try {
    const content = fs.readFileSync(transcriptPath, 'utf8');
    const lines = content.trim().split('\n');
    const messages: Message[] = [];

    for (const line of lines) {
      if (!line.trim()) continue;

      try {
        const msg: unknown = JSON.parse(line);
        if (!isRecord(msg)) continue;

        if (msg.type === 'user' || msg.type === 'gemini') {
          let contentText = '';
          const msgContent = msg.displayContent || msg.content;
          if (typeof msgContent === 'string') {
            contentText = msgContent;
          } else if (Array.isArray(msgContent)) {
            contentText = msgContent
              .filter((block): block is ContentBlock => isRecord(block))
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
      } catch {
        // Skip malformed lines
        continue;
      }
    }

    return { messages };
  } catch (error) {
    if (error instanceof Error) {
      console.error('Failed to parse transcript:', error.message);
    }
    return { messages: [] };
  }
}
