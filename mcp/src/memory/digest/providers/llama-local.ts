import * as fs from 'node:fs';
import * as path from 'node:path';
import { getLlama, LlamaChatSession, createModelDownloader } from 'node-llama-cpp';
import {
  LLAMA_CONTEXT_SIZE,
  LLAMA_MAX_GENERATED_TOKENS,
  LLAMA_TEMPERATURE,
} from '../constants.js';
import { getDigestModelSpec } from '../model-registry.js';
import type { ConversationDigestProvider } from '../types.js';
import type { ConversationDigestInput } from '../types.js';
import { withTimeout } from '../../../utils/async.js';
import { MODEL_CACHE_DIR } from '../../../utils/paths.js';

interface ChatMessage {
  role: 'system' | 'user';
  content: string;
}

export class LlamaLocalDigestProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LlamaLocalDigestProviderError';
  }
}

function titleFromSource(sourcePath: string): string {
  return path
    .basename(sourcePath)
    .replace(/\.[^.]+$/, '')
    .replace(/[_-]+/g, ' ');
}

export function trimConversationExport(content: string, maxInputChars: number): string {
  const trimmed = content.trim();
  if (trimmed.length <= maxInputChars) return trimmed;

  return [
    '[Earlier conversation content omitted to fit the local digest context window.]',
    trimmed.slice(-maxInputChars),
  ].join('\n\n');
}

function buildPrompt(input: ConversationDigestInput, maxInputChars: number): ChatMessage[] {
  const conversationExport = trimConversationExport(input.content, maxInputChars);
  const sourceName = path.basename(input.sourcePath);

  return [
    {
      role: 'system',
      content: [
        '# ROLE',
        'You write temporary project-memory wiki pages from developer/agent transcripts.',
        'Your output is provisional recall used by subsequent sessions to prevent blind steps.',
        '',
        '# CRITICAL CHRONOLOGY RULES',
        '1. Conversations often evolve. Read the end of the export FIRST to discover the ultimate resolution.',
        '2. The latest explicit user decision ALWAYS overrides any earlier assistant proposals or intermediate agreements.',
        '3. If a user rejects a feature, aborts a turn, or simplifies a design mid-conversation, treat all preceding over-engineered steps as REJECTED.',
        '4. Capture actual engineering conclusions, not conversational pleasantries.',
        '',
        '# EXTRACTION FOCUS',
        '- Extract concrete outcomes: decisions made, decisions rejected, project constraints, user preferences, and file-level implementation context.',
        '- Do not summarize turn-by-turn. Extract conclusions only.',
        '- Return Markdown only. Do not wrap your response in an outer markdown code block (```markdown ... ```).',
      ].join('\n'),
    },
    {
      role: 'user',
      content: [
        'Generate a concise project memory page adhering STRICTLY to this structural layout:',
        '',
        '# Conversation Digest: ' + titleFromSource(input.sourcePath),
        '',
        '> Source: [[' + sourceName + ']] | Status: provisional | Purpose: temporary recall until /wiki compile',
        '',
        '## Summary',
        '[Provide a single, short paragraph capturing the ultimate resolution and technical pivot of the session.]',
        '',
        '## Key Decisions',
        '[List bullets of what was explicitly changed, simplified, or finalized. Omit section if empty.]',
        '',
        '## Constraints',
        '[List project boundaries, language limits, or tool requirements. Omit section if empty.]',
        '',
        '## Preferences',
        '[List explicit workflow choices or styling constraints stated by the user. Omit section if empty.]',
        '',
        '## Implementation Context',
        '[List exact modified files, script locations, or runtime changes mentioned. Omit section if empty.]',
        '',
        '## Considered & Rejected',
        '[List bullets of options, paths, or code logic that were initially proposed but discarded or overridden by the user.]',
        '',
        '## Related',
        '- [[' + sourceName + ']]',
        '- [[memory-kit]]',
        '',
        '# CONTEXT PROCESSING RULES:',
        '- Do not emit empty sections or default labels like "None found". If a section has no items, omit its heading entirely.',
        '- Write absolute conclusions (e.g., "Removed workspace boundary checks completely"), never vague labels.',
        '- Do not invent files, code blocks, or decisions that did not occur in the source text.',
        '- Pay extreme attention to user corrections or turn interruptions; what the user says LAST dictates the final state.',
        '',
        'Source path: ' + input.sourcePath,
        '<conversation_export format="memory-kit">',
        conversationExport,
        '</conversation_export>',
      ].join('\n'),
    },
  ];
}

function stripCodeFence(text: string): string {
  const trimmed = text.trim();
  const match = trimmed.match(/^```(?:markdown|md)?\s*\n([\s\S]*?)\n```$/i);
  return match ? match[1].trim() : trimmed;
}

export function sanitizeConversationDigestMarkdown(generatedText: string): string {
  return stripCodeFence(generatedText).trim() + '\n';
}

export async function createLlamaLocalDigestProvider(
  modelId: string,
): Promise<ConversationDigestProvider> {
  const spec = getDigestModelSpec(modelId);

  const modelCacheDir = path.join(MODEL_CACHE_DIR, 'llama');
  fs.mkdirSync(modelCacheDir, { recursive: true });

  let modelFilePath: string;
  try {
    const downloader = await createModelDownloader({
      modelUri: spec.ggufUri,
      dirPath: modelCacheDir,
    });
    modelFilePath = downloader.entrypointFilePath;
    if (!fs.existsSync(modelFilePath)) {
      await downloader.download();
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new LlamaLocalDigestProviderError(`Failed to download model: ${message}`);
  }

  type LlamaInstance = Awaited<ReturnType<typeof getLlama>>;
  type LlamaModel = Awaited<ReturnType<LlamaInstance['loadModel']>>;

  let llama: LlamaInstance;
  let model: LlamaModel;

  try {
    llama = await getLlama();
    model = await llama.loadModel({ modelPath: modelFilePath });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new LlamaLocalDigestProviderError(`Failed to load model: ${message}`);
  }

  return {
    id: 'llama-local',
    async dispose() {
      await model.dispose();
    },
    async generateDigestMarkdown(input, options) {
      const messages = buildPrompt(input, options.maxInputChars);
      const systemContent = messages[0].content;
      const userContent = messages[1].content;

      const context = await model.createContext({ contextSize: LLAMA_CONTEXT_SIZE });
      try {
        const session = new LlamaChatSession({
          contextSequence: context.getSequence(),
          systemPrompt: systemContent,
        });

        const response = await withTimeout(
          session.prompt(userContent, {
            maxTokens: LLAMA_MAX_GENERATED_TOKENS,
            temperature: LLAMA_TEMPERATURE,
          }),
          options.timeoutMs,
          () => new LlamaLocalDigestProviderError(`Llama provider timed out after ${options.timeoutMs}ms`),
        );

        return sanitizeConversationDigestMarkdown(response);
      } finally {
        await context.dispose();
      }
    },
  };
}
