# Fail-Open Pattern

> Last updated: 2026-04-11 | Seen in: 2 features

## What It Is

Infrastructure components default to *allowing* the request or operation when their backing service fails. The component logs the failure but does not propagate it to the caller.

In hooks: `process.exit(0)` + pass-through JSON `{}` via `noOp()` on any error — the hook never blocks the user's workflow.

## Why We Use It

An outage in a supporting component (file I/O, wiki index, project DNA) must not cascade into a blocked user session. Agent-kit hooks in particular must never block user prompts — the cost of a missed log entry or missing context injection is far lower than the cost of a stuck session.

**Important exception:** The security hook (`scripts/security-privacy.js`) is intentionally BLOCKING — a security check that silently passes on error defeats its purpose. Fail-open applies only to non-security infrastructure layers.

## Where Applied

- [[llm-wiki]] — `scripts/wiki-inbox-append.js` has explicit `// fail-open` comment; `scripts/inject-project-dna.js` has two explicit `// fail-open` comments; both use `noOp()` (process.exit(0)) on any file I/O error — `scripts/utils.js:29`
- [[security-hardening]] — explicitly does NOT use fail-open; `scripts/security-privacy.js` blocks on any suspicious path/file detection (correct divergence: security layers must be fail-closed)

## Contradictions / Open Questions

- None
