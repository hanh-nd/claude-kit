/**
 * Configuration utilities
 * Shared configuration constants and loaders
 */

import * as fs from 'fs';
import * as path from 'path';

/**
 * Default file extensions - expanded to support more languages
 * Used by kit_get_project_context and other tools
 */
export const DEFAULT_EXTENSIONS = [
  '.ts',
  '.js',
  '.tsx',
  '.jsx', // JavaScript/TypeScript
  '.py', // Python
  '.go', // Go
  '.rs', // Rust
  '.java',
  '.kt', // Java/Kotlin
  '.cpp',
  '.c',
  '.h',
  '.hpp', // C/C++
  '.php', // PHP
  '.rb', // Ruby
  '.swift', // Swift
  '.vue',
  '.svelte', // Frontend frameworks
  '.json',
  '.yaml',
  '.yml', // Config files
  '.md', // Documentation
];
/**
 * Project settings interface
 */
export interface ProjectSettings {
  fileExtensions?: string[];
  [key: string]: unknown;
}

/**
 * Get file extensions - from settings.json or defaults
 * Allows project-specific customization
 */
export function getFileExtensions(projectDir: string): string[] {
  const settings = loadProjectSettings(projectDir);
  if (settings.fileExtensions && Array.isArray(settings.fileExtensions)) {
    return settings.fileExtensions;
  }
  return DEFAULT_EXTENSIONS;
}

/**
 * Load project settings from .gemini/settings.json
 */
export function loadProjectSettings(projectDir: string): ProjectSettings {
  const settingsPath = path.join(projectDir, '.agent-kit', 'settings.json');

  if (fs.existsSync(settingsPath)) {
    try {
      return JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
    } catch (error) {
      console.error(`[agent-kit] Warning: Failed to parse ${settingsPath}:`, error);
    }
  }

  return {};
}

/**
 * Sensitive files that agents are FORBIDDEN from reading/writing.
 */
export const FORBIDDEN_FILES: string[] = [
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
  'credentials', // ~/.claude/credentials file
];

/**
 * Regex patterns (case-insensitive) matched against path.basename.
 */
export const FORBIDDEN_PATTERNS: RegExp[] = [
  /^\.env$/i, // .env, .Env — case-insensitive exact
  /^\.env[^a-z]/i, // .env_bak, .env-prod, .env.local
  /^id_rsa/i, // SSH private keys
  /^id_ed25519/i,
  /^id_ecdsa/i,
  /\.pem$/i, // Certificates
  /credentials\.json$/i,
  /secrets\.json$/i,
  /secret\.json$/i,
];

/**
 * Directory name segments that are always blocked.
 */
export const FORBIDDEN_DIRS: string[] = [
  '.git',
  '.ssh',
  '.aws',
  '.kube',
  '.gnupg',
  '.docker',
];
