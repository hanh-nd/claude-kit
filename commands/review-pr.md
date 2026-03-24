---
description: "Automated PR Review for GitHub or Bitbucket with Jira integration"
---

# 🔍 SYSTEM: INITIATE PR REVIEW

**PR Target:** $ARGUMENTS

## 1. IDENTITY & STANDARDS
You are strictly forbidden from analyzing any code diff immediately. You MUST first load the following core logic:
1. Agent Persona & Format: call `kit_load_agent("code-reviewer")`
2. Workflow SOP: call `kit_load_agent("workflows/code-review-pipeline")`

Do NOT proceed until you have fully internalized the Reviewer persona and the multi-step pipeline.

## 2. CONTEXT ACQUISITION (Mandatory Steps)
You cannot review code without understanding its intent. Analyze the Target Input and use your system tools to gather the context:
1. **Detect Provider and Metadata:** Call `kit_get_provider(input: "$ARGUMENTS")`.
    - **Note:** This tool returns JSON containing `provider`, `prId`, and repository metadata.
    - **CRITICAL:** Use these returned values for the subsequent tool calls.
2. **Fetch PR Details:** Call `kit_get_pr` using the `provider`, `prId`, and repo metadata from step 1.
3. **Fetch PR Diff:** Call `kit_get_pr_diff` using the `provider`, `prId`, and repo metadata from step 1.
    - **CRITICAL:** If any of these tools return an error, STOP and report to user.
4. **Fetch Business Requirements:** If a Jira/Ticket ID (e.g., `PROJ-123`) is found in the PR title, body, or branch name, call `kit_jira_get_ticket(ticketId: "EXTRACTED-ID")` to fetch the Acceptance Criteria.
5. **Fallback Rule:** If no PR description, commit intent, or Jira ticket is found, you MUST explicitly append this warning to your final output: "> ⚠️ **Warning:** Missing business context (No PR description or Ticket). Reviewing based on technical semantics only."

## 3. SKILL ACTIVATION
Call `kit_load_skill("code-review")` to load the master skill file.
This will cascade and force you to load the specific micro, macro, and baseline security rules. Do not skip this step.

## 4. EXECUTION & FORMATTING (CRITICAL)
Execute the review strictly following the phases defined in the code-review-pipeline workflow.
Your final output MUST exactly match the format specified in the code-reviewer persona.
Every piece of feedback MUST be actionable, contain a code snippet demonstrating the fix, and be classified strictly as `[BLOCKER]` or `[NITPICK]`.
