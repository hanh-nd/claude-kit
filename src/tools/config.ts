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
 * Lifecycle and state management interfaces
 */
export interface LifecycleState {
  agent?: string; // Optional: Override the workflow agent
  skills: string[]; // e.g., ["unit-testing/SKILL.md"] (relative to extensionRoot/skills/)
  instructions: string; // Phase-specific brief (e.g., "Focus ONLY on logic.")
  next: string | null; // Key of the next state
}

export interface Workflow {
  initial: string;
  agent?: string; // Default agent for the entire workflow
  states: Record<string, LifecycleState>;
}

export interface Workflows {
  [workflowId: string]: Workflow;
}

export interface HandoffSummary {
  original_goal: string;
  completed_tasks: string[];
  pending_tasks: string[];
  current_context_brief: string;
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
  const settingsPath = path.join(projectDir, '.gemini', 'settings.json');

  if (fs.existsSync(settingsPath)) {
    try {
      return JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
    } catch (error) {
      // Log warning for debugging bad config files
      console.error(`[gemini-kit] Warning: Failed to parse ${settingsPath}:`, error);
    }
  }

  return {};
}
