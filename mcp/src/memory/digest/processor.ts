import * as path from 'node:path';
import {
  DEFAULT_DIGEST_TIMEOUT_MS,
  DEFAULT_DIGEST_MAX_INPUT_CHARS,
} from './constants.js';
import {
  defaultProvisionalDigestDir,
  readConversationDigestInput,
  findExistingProvisionalDigest,
  writeProvisionalDigestFile,
  writeConversationDigestSettings,
} from './files.js';
import { getDigestModelSpec } from './model-registry.js';
import { createLlamaLocalDigestProvider } from './providers/llama-local.js';
import type {
  DigestFileOptions,
  ProvisionalDigestResult,
  ConversationDigestInitResult,
  InitializeConversationDigestInput,
} from './types.js';
import { loadProjectSettings, resolveMemoryConfig } from '../../tools/config.js';
import { MemoryStore } from '../store.js';
import { MemoryIndexer } from '../indexer.js';

async function indexProvisionalDigestFile(
  workspaceRoot: string,
  markdownPath: string,
): Promise<{ indexed: boolean; error?: string }> {
  try {
    const settings = loadProjectSettings(workspaceRoot);
    const config = resolveMemoryConfig(settings, workspaceRoot);
    const store = new MemoryStore(path.join(config.wikiDir, 'index.db'), config);
    const embedder = { embed: async (_texts: string[]) => [] };
    const indexer = new MemoryIndexer(store, embedder, config);
    await indexer.indexFile(markdownPath);
    return { indexed: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { indexed: false, error: message };
  }
}

export async function digestConversationFile(
  options: DigestFileOptions,
): Promise<ProvisionalDigestResult> {
  const outDir = options.outDir
    ? path.resolve(options.workspaceRoot, options.outDir)
    : defaultProvisionalDigestDir(options.workspaceRoot);
  const input = readConversationDigestInput(options.workspaceRoot, options.inputPath);

  const existingPath = findExistingProvisionalDigest(outDir, input);
  if (existingPath) {
    const indexResult = await indexProvisionalDigestFile(options.workspaceRoot, existingPath);
    return {
      markdown: existingPath,
      status: 'provisional',
      contentHash: input.contentHash,
      skipped: true,
      ...indexResult,
    };
  }

  const provider = await createLlamaLocalDigestProvider(options.modelId);
  try {
    const markdown = await provider.generateDigestMarkdown(input, {
      modelId: options.modelId,
      maxInputChars: options.maxInputChars ?? DEFAULT_DIGEST_MAX_INPUT_CHARS,
      timeoutMs: options.timeoutMs ?? DEFAULT_DIGEST_TIMEOUT_MS,
    });

    const markdownPath = writeProvisionalDigestFile(outDir, input, markdown);
    const indexResult = await indexProvisionalDigestFile(options.workspaceRoot, markdownPath);

    return {
      markdown: markdownPath,
      status: 'provisional',
      contentHash: input.contentHash,
      skipped: false,
      ...indexResult,
    };
  } finally {
    await provider.dispose?.();
  }
}

export async function initializeConversationDigestModel(
  input: InitializeConversationDigestInput,
): Promise<ConversationDigestInitResult> {
  try {
    getDigestModelSpec(input.modelId);
    if (input.allowDownload !== true) {
      return {
        initialized: false,
        modelId: input.modelId,
        error: 'Digest model initialization requires explicit download permission',
      };
    }

    const loadedProvider = await createLlamaLocalDigestProvider(input.modelId);
    await loadedProvider?.dispose?.();

    const initializedAt = new Date().toISOString();

    writeConversationDigestSettings(input.workspaceRoot, {
      enabled: input.enabled ?? true,
      initialized: true,
      modelId: input.modelId,
      initializedAt,
    });

    return {
      initialized: true,
      modelId: input.modelId,
      initializedAt,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      initialized: false,
      modelId: input.modelId,
      error: message,
    };
  }
}
