export interface ConversationDigestSettings {
  enabled?: boolean;
  initialized: boolean;
  modelId: string;
  initializedAt: string;
}

export interface DigestModelSpec {
  id: string;
  ggufUri: string;
  approxSizeBytes: number;
  license: string;
  sourceUrl: string;
  enabled: boolean;
}

export interface ConversationDigestInput {
  sourcePath: string;
  content: string;
  contentHash: string;
}

export interface ConversationDigestOptions {
  modelId: string;
  maxInputChars: number;
  timeoutMs: number;
}

export interface ConversationDigestInitResult {
  initialized: boolean;
  modelId: string;
  initializedAt?: string;
  error?: string;
}

export interface ConversationDigestProvider {
  readonly id: string;
  dispose?(): Promise<void>;
  generateDigestMarkdown(
    input: ConversationDigestInput,
    options: ConversationDigestOptions,
  ): Promise<string>;
}

export interface DigestFileOptions {
  workspaceRoot: string;
  inputPath: string;
  modelId: string;
  outDir?: string;
  maxInputChars?: number;
  timeoutMs?: number;
}

export interface ProvisionalDigestResult {
  markdown: string;
  status: 'provisional';
  contentHash: string;
  indexed: boolean;
  skipped: boolean;
  error?: string;
}

export interface InitializeConversationDigestInput {
  workspaceRoot: string;
  modelId: string;
  allowDownload: boolean;
  enabled?: boolean;
}
