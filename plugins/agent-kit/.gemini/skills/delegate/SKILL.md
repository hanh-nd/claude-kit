---
name: delegate
description: 'Delegate a task to an external agent CLI (Gemini, Claude, or Codex) with optional handoff context'
---

# 🤝 Delegate

**Raw Input:** $ARGUMENTS

---

## Execution

Parse `$ARGUMENTS` as: `<agent> <task or file path>`

- **agent** — first word: `gemini`, `claude`, or `codex`
- **task** — remainder: a message string OR a path to a handoff file

Examples:

- `/delegate gemini scout the codebase and summarize key patterns`
- `/delegate gemini .agent-kit/handoffs/plans/plan-2026-03-25T19-30-42-feature.md`
- `/delegate claude implement the plan in .agent-kit/handoffs/plans/plan-xyz.md`
- `/delegate codex review this repo and identify risky refactors`

---

> The server streams Gemini's output in real-time as MCP log notifications.
> You will see progress appear in the conversation as the agent runs.

Call `kit_trigger_agent(agent: <agent>, task: <task>)`.

Report the full output to the user.

## Rules
- If the agent fails to process (e.g., timed out or requested CLI is not installed), clearly report the error and terminate execution.
- Do NOT retry the execution if the agent fails.
- Do NOT post-process, summarize, or modify the agent's output. Report the exact, raw output to the user.
