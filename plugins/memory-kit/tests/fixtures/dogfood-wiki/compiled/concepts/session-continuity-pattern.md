# Session Continuity Pattern

> Last updated: 2026-04-11 | Seen in: 3 features

## What It Is

A paired hook strategy that preserves wiki context and behavioral rules across any event that wipes the Claude Code conversation window. The pattern always has two halves:

1. **Export** — before the wipe, dump the session transcript to `wiki/raw/` so it can be compiled later
2. **Reinject** — after the wipe, read the compiled wiki index and behavioral instructions (`docs/instruction.md`) and inject them as context so the fresh session starts informed

## Why We Use It

Claude Code's conversation history is ephemeral — `/compact` and `/clear` both discard prior turns. Without persistence, each session starts blind. The wiki and behavioral rulebook are the durable layer; this pattern ensures they're always loaded and always growing, regardless of how many times the session resets.

The hook matcher system (`"startup"`, `"clear"`, `""`) lets the same scripts be triggered by different lifecycle events, so implementation reuse is maximized.

## Where Applied

- [[clear-hooks]] — `SessionEnd.clear` (export) + `SessionStart.clear` (reinject) for the `/clear` command
- PreCompact/PostCompact pair — `PreCompact` (export) + `PostCompact` (reinject) for the `/compact` command (documented in `hooks.json`, predates this wiki)
- [[llm-wiki]] — UserPromptSubmit intercept + SessionStart compact branch is the full system-level implementation of this pattern, with inbox aggregation and structured wiki compilation
- [[unified-context-injection]] — Consolidates overlapping hooks into a single injector that uses this pattern for `docs/instruction.md` and the wiki index

## Contradictions / Open Questions

- **Self-Loading Efficiency:** With the introduction of [[mandatory-context-loading]], we shift from injection-heavy to agent-pull models. The "Reinject" phase is now lighter, primarily serving to point the agent to the wiki and instruction set rather than dumping all DNA on every prompt.
- The pattern currently exports full transcripts even for trivial sessions (smalltalk, empty /clear). Could add a minimum-length gate to avoid polluting `wiki/raw/` with noise.
