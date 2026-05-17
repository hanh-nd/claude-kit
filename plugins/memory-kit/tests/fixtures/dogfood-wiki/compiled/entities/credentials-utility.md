# Credentials Utility

> Last updated: 2026-04-27 | Sources: 1 | Status: active

## Summary

Centralized logic for credential resolution, profiles, and parsing. Located at `src/utils/credentials.ts`.

## Anchors

- Primary: `src/utils/credentials.ts`

## Key Decisions

- **Single Source of Truth**: All credential logic is consolidated into a single utility file; planned facade pattern and separate manager were rejected for simplicity. [[plan-credential-manager-refactor]]
- **Priority Chain**: `getCredential(key)` resolves via `process.env.KEY` → `~/.claude/credentials [profile]` → `undefined`. `process.env` always wins.
- **Profile Selection**: `KIT_PROFILE` env var selects the INI profile section (defaults to `"default"`).
- **Security Check**: Warns on stderr if the credentials file (`~/.claude/credentials`) is not set to mode `600`.
- **In-Memory Cache**: Credentials are parsed once and cached in a singleton for the process lifetime.

## Edge Cases & Risks

- **Fail-Open Parsing**: Missing files or invalid INI syntax (lines without `=`) are skipped gracefully without crashing the server.

## Events

- 2026-04-11 — refactor — Consolidated credential resolution into `src/utils/credentials.ts` — [[plan-credential-manager-refactor]]

## Related

- [[security-hardening]] — Complemented by the `SAFE_ENV_VARS` allowlist.
