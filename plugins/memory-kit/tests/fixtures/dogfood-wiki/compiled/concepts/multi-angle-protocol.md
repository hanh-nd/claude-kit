# Multi-Angle Protocol Pattern

> Last updated: 2026-04-27 | Seen in: 2 entities

## What It Is

An architectural pattern for skills that require multiple cognitive angles (e.g., code-review, debug, security). It involves running each cognitive "lens" as a separate, independent parallel sub-agent in its own fresh context, then synthesizing the results to eliminate **anchoring bias**.

Defined in the reference file: `skills/references/multi-angle-protocol.md`.

## Why We Use It

Single-agent sequential analysis causes the agent to form a mental model early and filter or ignore subsequent findings that contradict it. Independent parallel agents ensure each lens starts with a "clean slate".

## Key Decisions

- **Independent Parallel Execution**: All lens agents MUST be launched in a single response via parallel tool calls to prevent agents from seeing each other's outputs. [[brainstorm-multi-angle-protocol]]
- **Subject Extraction**: Subjects (diffs, files) must be inlined into sub-agent prompts. File paths alone are insufficient for isolated sub-agents. [[plan-multi-angle-protocol-code-review]]
- **Gemini Fallback**: If the Agent tool is unavailable, skills must fall back to sequential execution with a warning header about anchoring bias. [[plan-multi-angle-protocol-code-review]]
- **Deduplication & Synthesis**: Findings from multiple lenses are deduplicated; findings confirmed by multiple lenses receive a higher confidence annotation. [[plan-multi-angle-protocol-code-review]]

## Where Applied

- [[ak-code-review-skill]] — The pilot skill adopting this pattern for Blast Radius, Logic, and Checklist analysis.

## Events

- 2026-04-24 — brainstorm — Design Brief: Multi-Angle Protocol for Skills — [[brainstorm-multi-angle-protocol]]
- 2026-04-24 — plan — Execution Blueprint: Multi-Angle Protocol for code-review — [[plan-multi-angle-protocol-code-review]]

## Contradictions / Open Questions

- Performance vs. Thoroughness: Multi-angle execution uses significantly more tokens (roughly 3x for a 3-lens pass). This is an intentional trade-off for quality.
- [Unresolved] Exact truncation strategy for extremely large diffs beyond "most significant sections".
