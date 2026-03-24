---
description: "Review local code changes (working tree or branch) enriched with auto-detected Jira context."
---

# 🕵️ SYSTEM: INITIATE LOCAL CODE REVIEW PIPELINE

**Target Base (Branch/Commit):** $ARGUMENTS (If empty, defaults to working tree/HEAD)

## 1. DATA ACQUISITION & FILTERING (TIER 2)

You MUST NOT execute a raw `git diff`. You MUST run the following exact script to gather filtered data and extract the context safely:

```bash
# A. Define Target Base
BASE_TARGET="$ARGUMENTS"
if [ -z "$BASE_TARGET" ]; then
  BASE_TARGET="HEAD"
fi

# B. Extract Jira Ticket ID from the current branch name
TICKET_ID=$(git branch --show-current | grep -oE '[A-Z]+-[0-9]+' || echo "NONE")

# D. Generate Filtered Git Diff
# Exclude lock files, build artifacts, and minified assets to protect context limits
DIFF_DATA=$(git diff $BASE_TARGET -- . ':(exclude)*lock.json' ':(exclude)*.lock' ':(exclude)dist/*' ':(exclude)build/*' ':(exclude)*.min.js' ':(exclude)public/*' ':(exclude)*.svg' ':(exclude)*.png')

echo "{\"ticket_id\": \"$TICKET_ID\", \"diff_length\": ${#DIFF_DATA}}"
echo "$DIFF_DATA" > .claude-kit/handoffs/current_diff.txt
```

Then, if TICKET_ID is not "NONE", call `kit_jira_get_ticket(ticketId: "EXTRACTED-ID")` to fetch business context.

## 2. IDENTITY & PIPELINE INTEGRATION

1. Load Persona: call `kit_load_agent("code-reviewer")`
2. Load Workflow: call `kit_load_agent("workflows/code-review-pipeline")`

## 3. EXECUTION INSTRUCTIONS

1. **Context Ingestion:** Read the `.claude-kit/handoffs/current_diff.txt` file.
2. **Context Alignment:** If Jira context is available, evaluate the diff against the Acceptance Criteria. If the diff introduces logic that contradicts the ticket, flag it as a "Requirement Violation".
3. **Syntax & Convention:** Regardless of Jira context, apply your standard `coding-common` skills to detect code smells, security flaws, or convention violations in the diff.
4. **Actionability Rule:** You are forbidden from leaving generic comments like "Refactor this". You MUST provide the corrected code snippet using the standard format.

## 4. OUTPUT & FORMATTING (CRITICAL)

Your final output MUST exactly match the format specified in the code-reviewer persona.
Every piece of feedback MUST be actionable, contain a code snippet demonstrating the fix, and be classified strictly as `[BLOCKER]` or `[NITPICK]`.
