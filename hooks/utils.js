import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

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
