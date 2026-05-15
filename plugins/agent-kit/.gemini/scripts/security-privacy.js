#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';
import {
  ENFORCEMENT_MODES,
  FORBIDDEN_DIRS,
  FORBIDDEN_FILES,
  FORBIDDEN_PATTERN_STRINGS,
  KIT_PATH,
  PROJECT_DIR,
} from './constants.js';
import { blockAction, getSecurityConfig, loadSettings, noOp, runWhenInvoked } from './utils.js';

// Only these arg keys contain actual file system paths
const PATH_ARG_KEYS = new Set(['file_path', 'path', 'notebook_path']);

// Only these arg keys contain shell command strings worth tokenizing
const COMMAND_ARG_KEYS = new Set(['command']);

runWhenInvoked(import.meta.url, async () => {
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

  const cfg = getSecurityConfig(loadSettings());

  const allForbiddenFiles = [...FORBIDDEN_FILES, ...cfg.additionalForbiddenFiles];
  const allForbiddenDirs = [...FORBIDDEN_DIRS, ...cfg.additionalForbiddenDirs];
  const allForbiddenRegexes = FORBIDDEN_PATTERN_STRINGS.map((p) => new RegExp(p, 'i'));
  const allSystemBinPaths = ['/usr/bin/', '/bin/', '/usr/local/bin/', ...cfg.additionalSystemBinPaths];

  function enforce(reason) {
    if (cfg.enforcementMode === ENFORCEMENT_MODES.AUDIT) {
      try {
        const logPath = path.join(KIT_PATH, 'logs', 'security-audit.log');
        fs.appendFileSync(logPath, `[${new Date().toISOString()}] AUDIT: ${reason}\n`);
      } catch {
        // Never block on logging failure
      }
      noOp();
    } else {
      blockAction(reason);
    }
  }

  function isBlockedFilename(name) {
    const lower = name.toLowerCase();
    if (allForbiddenFiles.some((f) => lower === f.toLowerCase())) return true;
    if (allForbiddenRegexes.some((re) => re.test(name))) return true;
    return false;
  }

  function isOutsideWorkspace(filePath) {
    const resolved = path.resolve(PROJECT_DIR, filePath);
    return resolved !== PROJECT_DIR && !resolved.startsWith(PROJECT_DIR + path.sep);
  }

  function isInAllowedOutsidePath(filePath) {
    if (cfg.allowedOutsidePaths.length === 0) return false;
    const resolved = path.resolve(PROJECT_DIR, filePath);
    return cfg.allowedOutsidePaths.some(
      (allowed) => resolved === allowed || resolved.startsWith(allowed + path.sep)
    );
  }

  function shouldBlockOutside(filePath) {
    if (!isOutsideWorkspace(filePath)) return false;
    if (isInAllowedOutsidePath(filePath)) return false;
    if (cfg.allowOutside) return false;
    return true;
  }

  // ── UserPromptSubmit ──────────────────────────────────────────────────────────
  // Scan @-references before Claude Code resolves them into tool calls.
  if (input.prompt) {
    const atRefRegex = /@([^\s]+)/g;
    let match;
    while ((match = atRefRegex.exec(input.prompt)) !== null) {
      const fileName = path.basename(match[1]);
      if (isBlockedFilename(fileName)) {
        enforce(`@-reference to '${fileName}' is strictly FORBIDDEN.`);
      }
      if (shouldBlockOutside(match[1])) {
        enforce(`@-reference to '${match[1]}' is outside the workspace and FORBIDDEN.`);
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
    const args = input.tool_input || input.args || (input.call && input.call.params) || {};

    for (const [key, value] of Object.entries(args)) {
      if (typeof value !== 'string') continue;

      if (PATH_ARG_KEYS.has(key)) {
        if (shouldBlockOutside(value)) {
          enforce(`Access to '${value}' is outside the workspace and strictly FORBIDDEN.`);
        }

        const fileName = path.basename(value);
        if (isBlockedFilename(fileName)) {
          enforce(`Access to '${fileName}' via '${toolName}' is strictly FORBIDDEN.`);
        }

        const segment = value
          .split(/[/\\]+/)
          .find((s) => allForbiddenDirs.some((d) => s.toLowerCase() === d.toLowerCase()));
        if (segment) {
          enforce(`Access to sensitive directory '${segment}' is FORBIDDEN.`);
        }
      }

      if (COMMAND_ARG_KEYS.has(key)) {
        const tokenRegex = /"([^"]+)"|'([^']+)'|([^\s]+)/g;
        let match;

        while ((match = tokenRegex.exec(value)) !== null) {
          const token = match[1] || match[2] || match[3];
          if (!token) continue;

          if (/[/\\]/.test(token) && isOutsideWorkspace(token)) {
            const isSystemBinary = allSystemBinPaths.some((p) => token.startsWith(p));
            const isWindowsFlag =
              process.platform === 'win32' && token.startsWith('/') && token.length <= 3;

            if (!isSystemBinary && !isWindowsFlag && !isInAllowedOutsidePath(token)) {
              enforce(
                `Shell command references path '${token}' outside workspace via '${toolName}'.`
              );
            }
          }

          if (isBlockedFilename(path.basename(token))) {
            enforce(`Shell command references forbidden file '${token}' via '${toolName}'.`);
          }
        }
      }
    }
  }

  noOp();
});
