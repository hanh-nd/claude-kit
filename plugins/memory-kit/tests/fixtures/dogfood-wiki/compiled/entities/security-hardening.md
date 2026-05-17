# Security Hardening — Agent-Kit Plugin

> Last updated: 2026-04-27 | Sources: 2

## Summary

Three-layer security hardening for the agent-kit MCP plugin: hook-level file/path blocking (`scripts/security-privacy.js`), TypeScript `validatePath()` hardening in `src/tools/security.ts`, and sub-agent environment sanitization in `src/tools/agent.ts`. Fixes confirmed vulnerabilities including case-insensitive bypass, path suffix bypass, and workspace boundary gap.

## Lifecycle

complete → plan-security-hardening (2026-04-04) → [[workspace-boundary-hardening]] (2026-04-27)

## Key Decisions

- Centralize all forbidden file/directory lists in `src/tools/config.ts` (`FORBIDDEN_FILES`, `FORBIDDEN_PATTERNS`, `FORBIDDEN_DIRS`, `SAFE_ENV_VARS`) and mirror to `hooks/constants.js` (plain JS strings) — plan-security-hardening
- Case-insensitive file matching blocks `.Env`, `.ENV` variants — plan-security-hardening
- Directory segment blocking: `.git/config`, `.ssh/id_rsa` caught by splitting resolved path on `path.sep` and checking each segment against `FORBIDDEN_DIRS` — plan-security-hardening
- Sub-agent env allowlist: `spawn()` receives only `SAFE_ENV_VARS` keys from `process.env`; prevents `echo $ATLASSIAN_API_TOKEN` leakage — plan-security-hardening
- Output sanitization via `sanitizeOutput()` with regex patterns for GitHub tokens (`ghp_`), AWS keys (`AKIA`), Slack tokens (`xox`), OpenAI keys (`SK-`), Atlassian tokens — plan-security-hardening
- Hook uses tokenized string check (split on `\s+`) to catch `cat .env` patterns and resolve absolute paths — plan-security-hardening, [[workspace-boundary-hardening]]
- **Workspace Boundary Enforcement:** Hook (`scripts/security-privacy.js`) resolves all file/path arguments and shell tokens to absolute paths using `path.resolve(PROJECT_DIR, ...)` and blocks any access outside the root. — [[workspace-boundary-hardening]]
- **@-Reference Hardening:** Security hook scans `@-references` in user prompts for both forbidden filenames and boundary violations before they reach tool logic. — [[workspace-boundary-hardening]]

## Edge Cases & Risks

- `.env_bak`, `.env-prod`, `.env.local` — caught by suffix pattern `/^\.env[^a-z]/i`, not exact match — plan-security-hardening
- `scripts/security-privacy.js` testing: verified via `node --test tests/security-hooks.test.js` using `spawnSync` to mock stdin. — [[workspace-boundary-hardening]]
- NOT in scope: OS-level sandboxing of spawned agent CLI processes, encrypting secrets at rest, auditing CLI binary permissions — plan-security-hardening

## Open Questions

- `scripts/security-utils.js` extraction for testability — flagged but deferred

## Events

- 2026-04-27 — refactor — Hardened security hook with workspace boundary check and @-reference validation. — [[workspace-boundary-hardening]]

## Related

- [[fail-open-pattern]] — NOTE: security hook is intentionally blocking (unlike most hooks); security checks must NOT fail-closed
- [[credentials-utility]] — Centralized credential resolution in src/utils/credentials.ts

