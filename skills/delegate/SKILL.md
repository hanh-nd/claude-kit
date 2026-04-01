---
name: ak:delegate
description: 'Delegate a task to an external agent CLI (Gemini or Claude) with optional handoff context'
version: 1.0.0
---

# 🤝 Delegate

**Raw Input:** $ARGUMENTS

---

## Execution

Parse `$ARGUMENTS` as: `<agent> <task or file path>`

- **agent** — first word: `gemini` or `claude`
- **task** — remainder: a message string OR a path to a handoff file

Examples:

- `/delegate gemini scout the codebase and summarize key patterns`
- `/delegate gemini .agent-kit/handoffs/plans/plan-2026-03-25T19-30-42-feature.md`
- `/delegate claude implement the plan in .agent-kit/handoffs/plans/plan-xyz.md`

---

> The server streams Gemini's output in real-time as MCP log notifications.
> You will see progress appear in the conversation as the agent runs.

Call `kit_trigger_agent(agent: <agent>, task: <task>)`.

Report the full output to the user. If the agent fell back to an alternate CLI (e.g., gemini not installed → claude), note this clearly with the `fallback_reason`.
