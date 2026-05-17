# README Wiki Documentation

> Last updated: 2026-04-11 | Sources: 1

## Summary

Add `/ak:wiki [compile|query|lint]` to the README command table and a new `## Wiki` section explaining hook-based auto-population, the three operations, and directory structure.

## Lifecycle

plan (2026-04-11 — docs-only change)

## Key Decisions

- Insert command table row after `/ak:delegate` row (line 22) — plan-readme-wiki-docs
- New `## Wiki` section inserted between command table block and Installation section (after line 25 `---` separator) — plan-readme-wiki-docs
- Documents 3 hook triggers: PostToolUse (handoff logging), PreCompact (export before wipe), PostCompact (reinject wiki index) — plan-readme-wiki-docs
- NOT in scope: CLAUDE.md or any other doc file updates — plan-readme-wiki-docs

## Edge Cases & Risks

- None (docs-only)

## Open Questions

- None

## Related

- [[llm-wiki]] — the feature being documented
