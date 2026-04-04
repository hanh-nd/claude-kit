#!/usr/bin/env node
/**
 * Hard Forbid Security Hook (Files-Only)
 *
 * Intercepts and blocks actions that attempt to access sensitive
 * environment or shell configuration files across all tool calls
 * AND user prompt @-references.
 *
 * Scans:
 *   - UserPromptSubmit: @-references resolved before Claude Code processes them
 *   - PreToolUse path args (file_path, path): filename + dir segment + traversal checks
 *   - PreToolUse command args: tokenized filename check for shell commands
 */

import * as path from 'path';
import {
  FORBIDDEN_FILES,
  FORBIDDEN_PATTERN_STRINGS,
  FORBIDDEN_DIRS,
} from './constants.js';

const FORBIDDEN_REGEXES = FORBIDDEN_PATTERN_STRINGS.map((p) => new RegExp(p, 'i'));

// Only these arg keys contain actual file system paths
const PATH_ARG_KEYS = new Set(['file_path', 'path', 'notebook_path']);

// Only these arg keys contain shell command strings worth tokenizing
const COMMAND_ARG_KEYS = new Set(['command']);

function noOp() {
  console.log(JSON.stringify({}));
  process.exit(0);
}

function blockAction(reason) {
  process.stderr.write(`🛑 Security Block: ${reason}\n`);
  process.exit(2);
}

function isBlockedFilename(name) {
  const lower = name.toLowerCase();
  if (FORBIDDEN_FILES.some((f) => lower === f.toLowerCase())) return true;
  if (FORBIDDEN_REGEXES.some((re) => re.test(name))) return true;
  return false;
}

// Read stdin
const raw = await new Promise((resolve) => {
  let data = '';
  process.stdin.on('data', (chunk) => (data += chunk));
  process.stdin.on('end', () => resolve(data));
});

let input;
try {
  input = JSON.parse(raw);
} catch {
  noOp();
}

// ── UserPromptSubmit ──────────────────────────────────────────────────────────
// Scan @-references before Claude Code resolves them into tool calls.
if (input.prompt) {
  const atRefRegex = /@([^\s]+)/g;
  let match;
  while ((match = atRefRegex.exec(input.prompt)) !== null) {
    const fileName = path.basename(match[1]);
    if (isBlockedFilename(fileName)) {
      blockAction(`@-reference to '${fileName}' is strictly FORBIDDEN.`);
    }
  }
}

// ── PreToolUse ────────────────────────────────────────────────────────────────
if (input.tool_name || input.tool || input.action || input.name || input.call) {
  const toolName =
    input.tool_name ||
    input.tool ||
    input.action ||
    input.name ||
    (input.call && input.call.method);
  const args =
    input.tool_input || input.args || (input.call && input.call.params) || {};

  const workspaceRoot = process.cwd();

  for (const [key, value] of Object.entries(args)) {
    if (typeof value !== 'string') continue;

    if (PATH_ARG_KEYS.has(key)) {
      // Direct filename check on the resolved basename
      const fileName = path.basename(value);
      if (isBlockedFilename(fileName)) {
        blockAction(`Access to '${fileName}' via '${toolName}' is strictly FORBIDDEN.`);
      }

      // Directory segment check
      if (value.includes('/') || value.includes('\\')) {
        for (const segment of value.split(/[/\\]+/)) {
          if (FORBIDDEN_DIRS.some((d) => segment.toLowerCase() === d.toLowerCase())) {
            blockAction(`Access to sensitive directory '${segment}' is FORBIDDEN.`);
          }
        }
      }

      // Workspace boundary check (path traversal)
      try {
        const resolved = path.resolve(workspaceRoot, value);
        if (resolved !== workspaceRoot && !resolved.startsWith(workspaceRoot + path.sep)) {
          blockAction(`Path traversal detected: '${value}' resolves outside workspace.`);
        }
      } catch {
        // Not a valid path — ignore
      }
    }

    if (COMMAND_ARG_KEYS.has(key)) {
      // Tokenized check for shell commands (catches inline file references)
      for (const token of value.split(/[\s/\\=]+/)) {
        if (!token) continue;
        if (isBlockedFilename(path.basename(token))) {
          blockAction(`Shell command references forbidden file '${token}' via '${toolName}'.`);
        }
      }
    }
  }
}

noOp();
