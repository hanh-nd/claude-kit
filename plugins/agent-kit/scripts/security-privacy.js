#!/usr/bin/env node
import * as path from 'path';
import { enforce } from './security/enforcement.js';
import { isBlockedFilename, isInForbiddenDir } from './security/file-checks.js';
import { loadPolicy, PATH_ARG_KEYS, COMMAND_ARG_KEYS } from './security/policy.js';
import { extractCandidates } from './security/shell-parser.js';
import { shouldBlockOutside } from './security/workspace.js';
import { noOp, runWhenInvoked } from './utils.js';
function checkPath(p, pol, tool) {
  if (shouldBlockOutside(p, pol)) enforce(`Access to '${p}' is outside the workspace and strictly FORBIDDEN.`, pol);
  const n = path.basename(p);
  if (isBlockedFilename(n, pol)) enforce(`Access to '${n}' via '${tool}' is strictly FORBIDDEN.`, pol);
  const seg = isInForbiddenDir(p, pol);
  if (seg) enforce(`Access to sensitive directory '${seg}' is FORBIDDEN.`, pol);
}
runWhenInvoked(import.meta.url, async () => {
  const raw = await new Promise((res) => { let d = ''; process.stdin.on('data', (c) => (d += c)); process.stdin.on('end', () => res(d)); });
  let input; try { input = JSON.parse(raw); } catch { noOp(); return; }
  const pol = loadPolicy();
  if (input.prompt) { const re = /@([^\s]+)/g; let m; while ((m = re.exec(input.prompt)) !== null) checkPath(m[1], pol, 'UserPromptSubmit'); }
  if (input.tool_name || input.tool || input.action || input.name || input.call) {
    const tool = input.tool_name || input.tool || input.action || input.name || (input.call && input.call.method);
    const args = input.tool_input || input.args || (input.call && input.call.params) || {};
    for (const [key, value] of Object.entries(args)) {
      if (typeof value !== 'string') continue;
      if (PATH_ARG_KEYS.has(key)) checkPath(value, pol, tool);
      if (COMMAND_ARG_KEYS.has(key)) {
        for (const c of extractCandidates(value, pol)) {
          const sysBin = pol.systemBinPaths.some((p) => c.expanded.startsWith(p));
          const winFlag = process.platform === 'win32' && c.expanded.startsWith('/') && c.expanded.length <= 3;
          if (!sysBin && !winFlag) {
            if (c.unresolvedVars.length > 0 && /[/\\]/.test(c.expanded)) enforce(`Shell command has unresolved variable with path '${c.raw}' via '${tool}'.`, pol);
            checkPath(c.expanded, pol, tool);
          } else { const n = path.basename(c.expanded); if (isBlockedFilename(n, pol)) enforce(`Shell command references forbidden file '${c.expanded}' via '${tool}'.`, pol); }
        }
      }
    }
  }
  noOp();
});
