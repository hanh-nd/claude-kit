# Mermaid as Standard Diagramming Format

> Last updated: 2026-04-27 | Seen in: 4 features

## What It Is

All diagrams in agent-kit skills, execution blueprints, and handoffs use Mermaid diagram syntax (` ```mermaid ` fences). ASCII art diagrams (box-drawing chars like `┌`, `│`, `─`, `└`, `→`) are explicitly forbidden.

Common Mermaid types in use:
- `flowchart TD` / `flowchart LR` — data flow, dependency, architecture
- `sequenceDiagram` — API interactions
- `stateDiagram-v2` — state machines

## Why We Use It

Mermaid is declarative, diffable, and renders natively in modern markdown viewers (GitHub, VS Code, Obsidian). ASCII art is fragile to edits and requires manual alignment.

The blast-radius search patterns in `skills/plan/SKILL.md` are configured to search for Mermaid keywords (` ```mermaid `, `flowchart`, `sequenceDiagram`, `stateDiagram`) to ensure diagrams stay in sync with code changes.

## Where Applied

- **Skills Layer Refactor (2026-04-05)**: Replaced all ASCII diagram references in `skills/plan/SKILL.md`, `skills/orchestrate/SKILL.md`, and `skills/brainstorm/SKILL.md`. [[mermaid-diagram-refactor]]
- **Jira Integration**: Parsing logic for ADF tables uses `graph TD` for flow visualization. [[jira-adf-to-markdown]]
- **Multi-Angle Protocol**: Uses `flowchart TD` to define the sub-agent spawning and synthesis logic. [[multi-angle-protocol]]

## Events

- 2026-04-05 — refactor — Replaced all ASCII diagrams in 3 skills with Mermaid `flowchart TD` — [[mermaid-diagram-refactor]]

## Contradictions / Open Questions

- `skills/debate/references/02-judge-protocol.md` uses `─────` as section *dividers* (not diagrams) — these are intentionally preserved as they are not representational diagrams.
