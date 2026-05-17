# Unified Context Injection

> Last updated: 2026-05-09 | Sources: 2 | Status: active

## Summary

Consolidates multiple overlapping context injection hooks into a single, unified mechanism that ensures behavioral rules and project context are available to the agent regardless of the workspace.

## Anchors

- Primary: `scripts/inject-agent-instructions.js`
- Related: `docs/instruction.md`, `.agent-kit/project.md`, `.agent-kit/wiki/compiled/index.md`

## Key Decisions

- **Single Hook Script:** Create `scripts/inject-agent-instructions.js` to replace `inject-project-dna.js` and `wiki-context-reinject.js`. — unified-context-injection
- **Behavioral Rule Source:** Use `docs/instruction.md` as the canonical source for behavioral rules, injected as `systemMessage`. — unified-context-injection
- **Automated Injection:** The hook script now automatically injects `docs/instruction.md`, `preferences.md`, `index.md`, and `project.md`, removing the prior [[mandatory-context-loading]] requirement from the agent's instructions. — conv_2026-05-09_176ae17d
- **Trigger Alignment:** Wire the unified hook to `SessionStart` (startup and clear) and `PostCompact` triggers. — unified-context-injection

## Edge Cases & Risks

- **Missing instruction.md:** System defaults to `noOp` to avoid breaking the session if the instruction file is missing or corrupted. — unified-context-injection
- **Injection Bloat:** As more files are added to the automated injection, the initial context size increases; must monitor token usage of the base prompt. — conv_2026-05-09_176ae17d

## Events

- 2026-05-09 — refactor — Centralized context injection in `scripts/inject-agent-instructions.js` and removed manual loading requirements from `docs/instruction.md`. — [[conv_2026-05-09_176ae17d]]
- 2026-04-11 — brainstorm — Initial design for consolidating context hooks. — [[unified-context-injection]]

## Related

- [[mandatory-context-loading]] — Concept that was automated by this entity
- [[session-continuity-pattern]] — The pattern this injection implements
- [[llm-wiki]] — One of the systems being consolidated
