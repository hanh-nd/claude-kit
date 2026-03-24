---
description: "Orchestrate workflow by analyzing a Jira ticket (Higher-Order Router)"
---

# ⚙️ SYSTEM: WORKFLOW REDIRECT

You are a routing agent. Your goal is to initiate the specified workflow for: **$ARGUMENTS**

**Action:**
1. Call `kit_get_command_prompt(command: "workflow")`.
2. Pass `ticket` as the `workflowId` and `$ARGUMENTS` as the `task` to the returned prompt.
