import * as path from 'path';

export const PROJECT_DIR =
  process.env.GEMINI_PROJECT_DIR || process.env.CLAUDE_PROJECT_DIR || process.cwd();
export const KIT_DIR = '.agent-kit';
export const KIT_PATH = path.join(PROJECT_DIR, KIT_DIR);

// SYNC WITH: src/tools/config.ts — enforced by tests/security-parity.test.js
export const FORBIDDEN_FILES = [
  '.env',
  '.bashrc',
  '.zshrc',
  '.profile',
  '.bash_profile',
  '.bash_history',
  '.zsh_history',
  'config.mjs',
  '.npmrc',
  '.yarnrc',
  '.netrc',
  '.gitconfig',
  'credentials',
];

export const FORBIDDEN_PATTERN_STRINGS = [
  '^\\.env$',
  '^\\.env[^a-z]',
  '^id_rsa',
  '^id_ed25519',
  '^id_ecdsa',
  '\\.pem$',
  'credentials\\.json$',
  'secrets\\.json$',
  'secret\\.json$',
];

export const FORBIDDEN_DIRS = ['.git', '.ssh', '.aws', '.kube', '.gnupg', '.docker'];
