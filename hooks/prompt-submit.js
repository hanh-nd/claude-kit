#!/usr/bin/env node
/**
 * UserPromptSubmit Hook — Project DNA Injector
 *
 * When the user invokes a command (prompt starts with "/"), automatically
 * injects the contents of .agent-kit/project.md as a system message so
 * every command has project conventions in context without needing to
 * explicitly read the file themselves.
 *
 * Gracefully no-ops when:
 *   - The prompt is not a command invocation
 *   - project.md does not exist or is empty (e.g. before /init is run)
 */

import * as fs from 'fs';
import * as path from 'path';

import { KIT_PATH } from './constants.js';

function noOp() {
  console.log(JSON.stringify({}));
  process.exit(0);
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

const prompt = (input.prompt || '').trimStart();

// Only inject for command invocations
const SHOULD_INJECT_COMMANDS = ['brainstorm', 'plan', 'code'];
const commandRegex = new RegExp(`^/(?:[^:]+:)?(${SHOULD_INJECT_COMMANDS.join('|')})`);
const shouldInject = commandRegex.test(prompt);
if (!shouldInject) {
  noOp();
}

// Read project DNA — skip if missing or empty
let projectContent = '';
try {
  const projectMdPath = path.join(KIT_PATH, 'project.md');
  projectContent = fs.readFileSync(projectMdPath, 'utf8').trim();
} catch {
  noOp();
}

if (!projectContent) {
  noOp();
}

console.log(
  JSON.stringify({
    systemMessage: `**!Important** These are the project's architectural conventions, naming patterns, error handling strategy, and critical rules. You MUST follow these throughout this command.\n\n${projectContent}`,
  })
);
