# Skill vs. Subagent Decision

> Last updated: 2026-05-01 | Seen in: 2 entities

## What It Is

A 6-axis framework for deciding whether a knowledge package should run as a **skill** (markdown persona in the main context) or a **subagent** (spawned isolated Claude agent). The key insight: in an architecture where skills are first-class markdown files any agent can consume, the skill IS the subagent definition — the distinction collapses to **execution context**, not the knowledge package itself.

**The 6 axes:**

| Axis | Skill | Subagent |
|---|---|---|
| Interactivity | Needs back-and-forth mid-task | Fire-and-forget; user waits for result |
| Context dependency | Needs full conversation history | Can be fully briefed upfront |
| Output nature | Behavioral overlay / ongoing dialogue | Discrete artifact (report, file, code) |
| Context protection | Fine to run in main context | Would pollute main context with noise |
| Context inflation cost | Output stays in main context, paid every turn | Output isolated; only summary returned |
| Agent compatibility | Consumable by any LLM (Gemini, Claude, etc.) | Claude-only construct; external agents can't invoke |

**The heuristic:** "Is the user talking WITH it, or waiting FOR it?"
- Talking with → Skill
- Waiting for → Subagent

## Why We Use It

The question "skill vs subagent" emerged from noticing that many skills produce discrete artifacts (reports, code, reviews) and could be parallelized. However, converting everything to subagents would break Gemini compatibility — Gemini has no `Agent` tool and cannot spawn subagents. Any skill that `delegate` hands to Gemini must stay a skill.

## Implementation Patterns

When a skill needs to scale, two patterns emerge:

### Pattern A — Internal Spawn (Self-Orchestration)
The skill file itself contains the instruction to spawn subagents for specific phases.
- **Best for:** Skills that are already orchestrators by nature and NOT intended for Gemini delegation (e.g., `ak:init`, `ak:wiki compile`, `ak:code-review`).
- **Risk:** Shatters Gemini compatibility if used in skills that Gemini needs to execute.

### Pattern B — External Spawn (Upstream Orchestration)
The skill file remains unchanged. An upstream orchestrator (like `ak:plan` or `ak:orchestrate`) spawns N general-purpose agent instances, each instructed to read and apply the skill file.
- **Best for:** Preserving Gemini compatibility (via `ak:delegate`) while still achieving parallelism and context isolation.
- **Recommended for:** `ak:code`, `ak:security`, `ak:research`.

## The 3 MUST-Subagent Scenarios

Default to skill. Force to subagent only when one of these structural constraints applies:

1. **Parallelism** — same work on multiple targets simultaneously. A skill runs sequentially in main context; you cannot run 5 instances in parallel. Example: `orchestrate` analyzing 5 services needs 5 subagents.

2. **Context window exhaustion** — task is too large for the current context window (already loaded with history, DNA, prior outputs). A subagent gets a fresh, full context window.

3. **Genuine independence / "fresh eyes"** — task requires a truly uncontaminated second opinion. A skill always has access to full conversation history; it cannot fake not knowing what it already knows. Example: `debate` — Gilfoyle must not see Dinesh's reasoning before forming his own.

**Note:** "Speed" alone is not a sufficient reason to create a dedicated subagent type if it adds coordination overhead without structural gain.

## Cost Nuance

- Large output → subagent saves money (context isolation; output not paid on every future turn)
- Tiny task → skill saves money (no spawn overhead — spawning initializes a fresh context + system prompt)
- Full formula: `expected output size × session length` vs. `spawn overhead`

## Generalist + Skill Pattern

A generalist agent instructed to read a specific skill file is functionally equivalent to a dedicated subagent type for all 3 MUST scenarios. Dedicated subagent types add only ergonomic benefits: invocation clarity, drift prevention (persona always baked in), caller doesn't need to know the skill system.

## Where Applied

- [[agent-kit-core]] — Orchestrates the entire team using this framework.
- [[ak-plan-behavioral-spec-redesign]] — plan's "Parallel agents" option spawns N `code` agents (one per independent WBS task batch), using the skill file in each
- [[pipeline-skill-menus]] — the menu system surfaces parallelism as a first-class execution option

## Contradictions / Open Questions

- `code` skill: stays a skill (Gemini compatibility via `delegate`), but is the highest-value candidate for parallel spawning. The same skill file, spawned N times, each handling one WBS task — no conversion needed.
- `wiki compile/lint`: these specific commands are pure artifact-generators that could benefit from subagent isolation, but `/wiki query` is interactive. Split not yet implemented.
