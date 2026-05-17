# Plan Skill

> Last updated: 2026-04-27 | Sources: 2 | Status: active

## Summary

The primary skill for creating "intern-proof" implementation blueprints (WBS) from requirements or design briefs. Enforces structural integrity and explicit data contracts without modifying functional code. Located in `skills/plan/SKILL.md`.

## Anchors

- Primary: `skills/plan/SKILL.md`

## Key Decisions

- **Behavioral Contract Pattern**: WBS tasks specify business rules (inputs, outputs, error cases) rather than step-by-step pseudocode to preserve implementation ownership for the coder. [[behavioral-contract-pattern]]
- **Parallelism Annotations**: Every WBS task carries machine-readable `[P]` (parallel) or `[S: task_id]` (sequential) annotations for multi-agent execution. [[skill-vs-subagent-decision]]
- **Post-Save Menu Pattern**: Phase 5 auto-saves immediately via `kit_save_handoff` and presents a 5-option execution menu (Execute now / Delegate / Parallel agents / Done / Freeform). [[post-save-menu-pattern]]
- **Rationale Capture**: The Goal section template requires both "Why" (rationale) and "What" (outcome).

## Edge Cases & Risks

- The `_Logic:` field label in the WBS template is a legacy artifact; enforcement text explicitly overrides it with behavioral spec requirements.

## Events

- 2026-04-12 — redesign — Phase 2: added parallel annotations (`[P]`/`[S:]`) + Phase 5 auto-save 5-option menu — [[ak-plan-behavioral-spec-redesign]]
- 2026-04-11 — redesign — Phase 1: WBS format changed from step-by-step pseudocode to behavioral contracts — [[behavioral-contract-pattern]]

## Related

- [[behavioral-contract-pattern]] — the foundational logic for WBS tasks.
- [[post-save-menu-pattern]] — used for the Phase 5 execution menu.
- [[skill-vs-subagent-decision]] — informs the "Parallel agents" execution batching.
