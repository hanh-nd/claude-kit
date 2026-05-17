import * as path from 'node:path';
import type { WikiConfig } from '@types';

// Module-level cache: avoids recompiling the same pattern list on every PreToolUse event.
// Key is the patterns joined with a null byte (patterns never contain \x00).
const patternCache = new Map<string, RegExp[]>();

function compilePatterns(patterns: string[]): RegExp[] {
  const key = patterns.join('\x00');
  const cached = patternCache.get(key);
  if (cached) return cached;
  const compiled: RegExp[] = [];
  for (const pattern of patterns) {
    try {
      compiled.push(new RegExp(pattern));
    } catch {
      // Skip the bad pattern and warn; remaining valid patterns still apply.
      process.stderr.write(`[memory-kit] warn: invalid regex in bashAllowlist.patterns — "${pattern}" skipped\n`);
    }
  }
  patternCache.set(key, compiled);
  return compiled;
}

export const CODE_EXTENSIONS: ReadonlySet<string> = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.py', '.go', '.rs', '.java', '.rb', '.cs',
  '.cpp', '.c', '.h', '.sh', '.md', '.json',
  '.yaml', '.yml', '.toml', '.env', '.sql', '.graphql',
]);

// Fields that carry a file path across all supported providers
const PATH_FIELDS = ['file_path', 'path', 'notebook_path'] as const;
// Fields that carry edited/written content (write intent)
const CONTENT_FIELDS = ['new_string', 'content', 'new_source'] as const;
// Fields that carry a shell command
const COMMAND_FIELDS = ['command', 'cmd'] as const;
// Codex apply_patch marker pattern
const PATCH_MARKER_RE = /\*\*\* (?:Update|Create|Delete) File:/;

function extractFilePath(toolInput: Record<string, unknown>): string | null {
  for (const field of PATH_FIELDS) {
    if (typeof toolInput[field] === 'string') return toolInput[field] as string;
  }
  if (Array.isArray(toolInput.paths) && typeof toolInput.paths[0] === 'string') {
    return toolInput.paths[0] as string;
  }
  return null;
}

function hasContentField(toolInput: Record<string, unknown>): boolean {
  return CONTENT_FIELDS.some((f) => typeof toolInput[f] === 'string');
}

function extractCommand(toolInput: Record<string, unknown>): string | null {
  for (const field of COMMAND_FIELDS) {
    if (typeof toolInput[field] === 'string') return toolInput[field] as string;
  }
  return null;
}

export function shouldRun(
  _toolName: string,
  toolInput: Record<string, unknown>,
  anchorPathPrefixes: ReadonlySet<string>,
  config: WikiConfig,
): { allow: boolean; reason: string } {
  const filePath = extractFilePath(toolInput);
  const hasContent = hasContentField(toolInput);
  const command = extractCommand(toolInput);

  // 1. File write/edit: path + content field → always allow
  //    Covers Claude Edit/Write, Gemini write_file/replace, any future write-type tool
  if (filePath && hasContent) {
    return { allow: true, reason: 'file-write' };
  }

  // 2. Patch command (Codex apply_patch): command containing file markers → always allow
  if (command !== null && PATCH_MARKER_RE.test(command)) {
    return { allow: true, reason: 'patch-command' };
  }

  // 3. File read: path only → check code extension or anchor prefix
  //    Covers Claude Read, Gemini read_file/read_many_files, any future read-type tool
  if (filePath) {
    const ext = path.extname(filePath).toLowerCase();
    if (CODE_EXTENSIONS.has(ext)) {
      return { allow: true, reason: 'code-extension' };
    }
    for (const prefix of anchorPathPrefixes) {
      if (filePath.startsWith(prefix)) {
        return { allow: true, reason: 'anchor-path-prefix' };
      }
    }
    return { allow: false, reason: 'read-no-code-ext-or-anchor-prefix' };
  }

  // 4. Shell command: command/cmd only → apply bash denylist/allowlist
  //    Covers Claude Bash, Gemini run_shell_command, any future shell-type tool
  //    _toolName is intentionally unused: the gate is field-based (provider-agnostic)
  if (command !== null) {
    if (command.length < 4) {
      return { allow: false, reason: 'bash-too-short' };
    }

    const { mode, patterns } = config.bashAllowlist;
    const compiled = compilePatterns(patterns);

    if (mode === 'denylist') {
      for (let i = 0; i < compiled.length; i++) {
        if (compiled[i].test(command)) {
          return { allow: false, reason: `bash-denylist:${patterns[i]}` };
        }
      }
      return { allow: true, reason: 'bash-denylist-pass' };
    }

    for (const re of compiled) {
      if (re.test(command)) {
        return { allow: true, reason: 'bash-allowlist-match' };
      }
    }
    return { allow: false, reason: 'bash-allowlist-no-match' };
  }

  // 5. No recognizable fields → deny
  return { allow: false, reason: 'no-recognizable-fields' };
}
