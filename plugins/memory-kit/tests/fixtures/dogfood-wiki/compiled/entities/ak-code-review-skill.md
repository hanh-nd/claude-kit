# Code-Review Skill

> Last updated: 2026-05-09 | Sources: 2 | Status: active
> ⚠️ Reality Gap: The multi-angle protocol integration planned in [[plan-multi-angle-protocol-code-review]] is NOT yet implemented in `skills/code-review/SKILL.md`.

## Summary

The primary skill for performing rigorous code reviews of diffs, PRs, or commits with evidence-backed findings. Located in `skills/code-review/SKILL.md`.

## Anchors

- Primary: `skills/code-review/SKILL.md`

## Key Decisions

- **Mandatory Exploration Rules**: For every modified function, the agent MUST read the full body and search for callers. Surface scanning from diff context alone is forbidden. [[conv_2026-04-23_24b6c927]]
- **Evidence Over Assertion**: Every finding requires `file:line` and a reasoning chain; every category checked requires a clearance line proving what was traced. [[conv_2026-04-23_24b6c927]]
- **Multi-Angle Execution (Planned)**: Pilot implementation of the [[multi-angle-protocol]] using three lenses: Blast Radius, Logic Correctness, and Checklist Pass. [[plan-multi-angle-protocol-code-review]]

## Events

- 2026-04-24 — plan — Execution Blueprint: Multi-Angle Protocol for code-review — [[plan-multi-angle-protocol-code-review]]
- 2026-04-23 — refactor — Hardened skill with mandatory exploration rules and evidence-backed reporting requirements to combat agent "laziness". — [[conv_2026-04-23_24b6c927]]

## Related

- [[multi-angle-protocol]](entities/multi-angle-protocol.md) — Implements this protocol to eliminate anchoring bias.
- [[code-review-standards]](preferences/code-review-standards.md) — The standing rules for all code reviews.
