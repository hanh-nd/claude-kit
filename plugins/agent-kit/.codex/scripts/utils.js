import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { ENFORCEMENT_MODES, KIT_PATH } from './constants.js';

/**
 * Spawns a Node.js script as a detached background process.
 * Returns immediately — does not block the caller.
 *
 * @param {string | URL} scriptUrl - import.meta.url-relative URL or absolute path to the script
 * @param {string[]} [args] - optional CLI arguments passed to the script
 */
export function spawnBackground(scriptUrl, args = []) {
  const scriptPath =
    scriptUrl instanceof URL ? fileURLToPath(scriptUrl) : fileURLToPath(new URL(scriptUrl));

  const child = spawn(process.execPath, [scriptPath, ...args], {
    detached: true,
    stdio: 'ignore',
  });
  child.unref();
}

/**
 * Runs `fn` only when this module is the direct entry point (i.e. invoked via CLI).
 * Skips execution when the module is imported for testing or reuse.
 *
 * @param {string} importMetaUrl - pass `import.meta.url` from the calling module
 * @param {() => Promise<void>} fn - async hook body
 */
export function runWhenInvoked(importMetaUrl, fn) {
  const entryPath = fs.realpathSync(process.argv[1]);
  const modulePath = fs.realpathSync(fileURLToPath(importMetaUrl));
  if (entryPath === modulePath) {
    fn();
  }
}

/**
 * No-op function that prints an empty JSON object and exits.
 */
export function noOp() {
  console.log(JSON.stringify({}));
  process.exit(0);
}

/**
 * Block action and exit with code 2.
 * @param {string} reason
 */
export function blockAction(reason) {
  process.stderr.write(`🛑 Security Block: ${reason}\n`);
  process.exit(2);
}

export function loadSettings() {
  try {
    const settingsPath = path.join(KIT_PATH, 'settings.json');
    if (fs.existsSync(settingsPath)) {
      return JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    }
  } catch {
    // Fall through to defaults on parse error
  }
  return {};
}

export function getSecurityConfig(settings) {
  const s = settings?.security ?? {};
  return {
    allowOutside: s.allowOutside ?? false,
    allowedOutsidePaths: Array.isArray(s.allowedOutsidePaths) ? s.allowedOutsidePaths : [],
    additionalSystemBinPaths: Array.isArray(s.additionalSystemBinPaths)
      ? s.additionalSystemBinPaths
      : [],
    additionalForbiddenFiles: Array.isArray(s.additionalForbiddenFiles)
      ? s.additionalForbiddenFiles
      : [],
    additionalForbiddenDirs: Array.isArray(s.additionalForbiddenDirs)
      ? s.additionalForbiddenDirs
      : [],
    enforcementMode: s.enforcementMode ?? ENFORCEMENT_MODES.BLOCK,
  };
}
