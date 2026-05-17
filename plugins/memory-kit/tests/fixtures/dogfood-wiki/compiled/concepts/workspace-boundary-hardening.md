# Workspace Boundary Enforcement

> Last updated: 2026-04-27 | Seen in: 2 entities

## What It Is

A security pattern that hard-blocks access to any file or directory located outside the project root (`PROJECT_DIR`). It works by resolving all path-like strings to absolute paths and verifying they reside within the workspace boundary.

## Why We Use It

To prevent the agent from accidentally or maliciously accessing system-sensitive files (e.g., `/etc/passwd`, `~/.ssh`) or escaping the project context via path traversal (`../../`). This provides **Defense in Depth** by enforcing the boundary at both the "pre-flight" hook level and the tool implementation level.

## Where Applied

- [[security-hardening]] — Implemented in `scripts/security-privacy.js` (hook) and `src/tools/security.ts` (`validatePath` utility).
- [[agent-kit-core]] — Standard requirement for all file-system tools.

## Edge Cases & Heuristics

- **System Binaries:** Absolute paths starting with `/usr/bin/`, `/bin/`, or `/usr/local/bin/` are allowed in shell commands to permit legitimate tool usage (e.g., `git`).
- **Windows Flags:** Short tokens (length <= 3) starting with `/` are ignored on Win32 to avoid false positives on command flags (e.g., `/W`).
- **Quoted Paths:** Tokenization respects single and double quotes to ensure paths with spaces are correctly resolved and checked.
