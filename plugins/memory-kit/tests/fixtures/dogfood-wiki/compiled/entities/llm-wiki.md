# LLM Wiki — Project Intelligence Wiki System

> Last updated: 2026-05-09 | Sources: 4 | Status: active

## Summary

Persistent, compounding project knowledge base for agent-kit. Hooks auto-log handoffs and preserve session transcripts; `/wiki` skill compiles raw material into structured entity/concept pages. Solves cross-session context loss — agent starts each session already knowing architectural decisions, patterns, and prior work.

## Anchors

- Primary: `skills/wiki/SKILL.md`
- Related: `scripts/wiki-inbox-append.js`, `scripts/export-conversation-history.js`, `scripts/inject-agent-instructions.js`

## Key Decisions

- **Automated Logging**: PostToolUse hook on `kit_save_handoff` appends structured entries to `wiki/raw/inbox.md`. — [[plan-llm-wiki]]
- **Session Persistence**: `/clear` and `/compact` commands trigger `export-conversation-history.js` before context is lost. — [[clear-hooks]]
- **Automated Context Injection**: `scripts/inject-agent-instructions.js` automatically injects the wiki index and behavioral instructions into every fresh session. — [[unified-context-injection]]
- **User-Triggered Compilation**: Compilation remains an explicit user action via `/wiki compile` to ensure synthesis quality. — [[brainstorm-llm-wiki]]

## Edge Cases & Risks

- **Reality Gap**: `prompt-submit.js` mentioned in early plans was never implemented; its functionality was absorbed by `scripts/inject-agent-instructions.js`.
- **Fail-Open**: All wiki hooks use `process.exit(0)` on error to ensure the core user workflow is never blocked by wiki infrastructure failures. [[fail-open-pattern]]

## Events

- 2026-05-09 — refactor — Consolidated context injection and re-injection into `scripts/inject-agent-instructions.js`. — [[unified-context-injection]]
- 2026-04-11 — feature — Initial implementation of the /wiki skill and supporting hooks. — [[plan-llm-wiki]]
- 2026-04-10 — brainstorm — Design Brief: LLM Wiki. — [[brainstorm-llm-wiki]]

## Related

- [[unified-context-injection]] — The delivery mechanism for wiki context
- [[session-continuity-pattern]] — The architectural pattern this system implements
- [[fail-open-pattern]] — The infrastructure resilience pattern used throughout
