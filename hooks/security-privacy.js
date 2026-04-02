#!/usr/bin/env node
/**
 * Hard Forbid Security Hook (Files-Only)
 *
 * Intercepts and blocks actions that attempt to access sensitive 
 * environment or shell configuration files (.env, .bashrc, etc.)
 * across all tool calls.
 */

import * as path from 'path';

const FORBIDDEN_FILES = [
  '.env',
  '.bashrc',
  '.zshrc',
  '.profile',
  '.bash_profile',
  '.bash_history',
  '.zsh_history',
  'config.mjs',
];

function noOp() {
  console.log(JSON.stringify({}));
  process.exit(0);
}

function blockAction(reason) {
  process.stderr.write(`🛑 Security Block: ${reason}\n`);
  process.exit(2);
}

// Read stdin for action/tool info
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

// Intercept Tool Calls / Action Proposals
// Claude Code PreToolUse hook sends: { tool_name, tool_input, ... }
if (input.tool_name || input.tool || input.action || input.name || input.call) {
  const toolName = input.tool_name || input.tool || input.action || input.name || (input.call && input.call.method);
  const args = input.tool_input || input.args || (input.call && input.call.params) || {};

  for (const [key, value] of Object.entries(args)) {
    if (typeof value === 'string') {
      // Check for Forbidden Files (Paths)
      const fileName = path.basename(value);
      if (FORBIDDEN_FILES.some((f) => fileName === f || fileName.startsWith(f + '.'))) {
        blockAction(`Access to '${fileName}' via '${toolName}' is strictly FORBIDDEN.`);
      }
    }
  }
}

// For all other cases (including prompt submissions), just proceed
noOp();
