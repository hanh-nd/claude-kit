# Behavioral Contract Pattern

> Last updated: 2026-04-11 | Seen in: 2 features

## What It Is

WBS tasks in implementation blueprints specify *what* code must achieve and *why* it exists — not step-by-step syntax. The implementing engineer owns variable names, control flow, and local logic. The planner provides business rules: inputs, outputs, error cases, and the Goal's "Why + What."

The `skills/plan/SKILL.md` enforcement text (line 178–180):
> "Tasks must be granular — not 'Implement the logic' but 'Map the array of `User` objects to `UserDTO`, filtering out items where `isActive` is false. Throw `ValidationError` if the array is empty.' Internal logic should be expressed as business rules (inputs, outputs, error cases) — avoid prescribing local variable names, which the implementing engineer should own."

The Goal section (line 187) explicitly requires both:
- "Why" — rationale/context
- "What" — high-level outcome

## Why We Use It

Prevents the planner from writing pseudocode that reduces the implementing agent to a transcription tool. Discovered during brainstorm (`ak-plan-behavioral-spec-redesign`) and confirmed via skill-creator eval runs. With AI-assisted coding, the planner has already done the expensive codebase exploration; the coder should make implementation decisions, not copy-paste pseudocode.

## Where Applied

- [[ak-plan-behavioral-spec-redesign]] — the origin; redesign of ak:plan WBS enforces "business rules" over step-by-step logic; landed in `skills/plan/SKILL.md:178-180, 187`
- [[llm-wiki]] — plan blueprint uses "Why + What" goal framing and behavioral task descriptions throughout

## Contradictions / Open Questions

- The `_Logic: [Step-by-step]` label in the WBS template (line 206) still exists but the surrounding enforcement text overrides its literal meaning — the label is a legacy artifact, the guidance is behavioral
