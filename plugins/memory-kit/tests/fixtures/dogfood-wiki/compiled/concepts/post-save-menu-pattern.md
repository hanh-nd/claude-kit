# Post-Save Menu Pattern

> Last updated: 2026-04-27 | Seen in: 3 features

## What It Is

A pipeline UX pattern where a skill (1) saves its output immediately via `kit_save_handoff`, then (2) presents a concise numbered menu letting the user choose what happens next — always ending with a freeform option for open-ended continuation. The approval gate ("type Approve to proceed") is eliminated.

**Canonical structure:**

```
✅ [Output type] saved → [path]

What would you like to do next?

1) [Primary next pipeline stage]
2) Done — no further action
3) Something else — type here
```

## Why We Use It

The approval gate ("Approve") was a friction point that added no information — completing a pipeline phase is itself the approval. Removing it and replacing with an action menu makes the pipeline feel fluent: output appears, user immediately sees their options, no extra keystrokes required.

The freeform option is the key insight: the range of things a user might want to do after any skill output is too open-ended to enumerate.

## Key Decisions

- **Immediate Persistence**: Skills call `kit_save_handoff` immediately upon output completion, before the menu is shown. [[pipeline-skill-menus]]
- **No Approval Gate**: The natural flow of phases is treated as approval; manual "Approve" typing is removed for speed. [[post-save-menu-pattern]]
- **Standardized Menus**:
  - `ticket` → (1) Plan, (2) Done, (3) Freeform
  - `brainstorm` → (1) Execute plan phase, (2) Done, (3) Freeform
  - `plan` → (1) Execute now, (2) Delegate, (3) Parallel agents, (4) Done, (5) Freeform

## Where Applied

- [[ak-plan-skill]] — The most complex instance, including the parallel agents option.
- `skills/ticket/SKILL.md` and `skills/brainstorm/SKILL.md` — Coordinated rollout of the pattern.

## Events

- 2026-04-12 — feature — Coordinated rollout of auto-save menus across `ticket`, `brainstorm`, and `plan` skills. — [[pipeline-skill-menus]]

## Contradictions / Open Questions

- **Discoverability**: Replacing specific options like "Revise" with a "Freeform" field makes those actions less discoverable for new users.
- **Rollout Scope**: Skills like `code-simplify` and `review` do not yet have post-output menus.
