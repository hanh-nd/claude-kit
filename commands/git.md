---
description: 'Context-aware Git wrapper: Resolves Oh My Zsh aliases, generates context-rich arguments, and requests execution approval.'
---

# 🐙 SYSTEM: INTERACTIVE SMART GIT ORCHESTRATOR

**Raw Input:** $ARGUMENTS

## 1. ENVIRONMENT SENSING (TIER 2)

You MUST execute the following shell script to gather repository context before translating the command. Do NOT guess the environment state.

```bash
# 1. Get current branch
CURRENT_BRANCH=$(git branch --show-current)

# 2. Extract Ticket ID from branch OR fallback to the most recently modified ticket file
TICKET_ID=$(echo "$CURRENT_BRANCH" | grep -oE '[A-Z]+-[0-9]+')
if [ -z "$TICKET_ID" ]; then
  # Grab the newest file in the tickets tmp folder
  TICKET_ID=$(ls -t .agent-kit/handoffs/tickets/ 2>/dev/null | head -1 | sed 's/\.md//')
fi
if [ -z "$TICKET_ID" ]; then
  TICKET_ID="NONE"
fi

# 3. Get staged changes for commit generation (limit size to protect context)
git diff --cached > .agent-kit/handoffs/staged_diff.txt

echo "{\"current_branch\": \"$CURRENT_BRANCH\", \"ticket_id\": \"$TICKET_ID\", \"has_staged_files\": $(if [ -s .agent-kit/handoffs/staged_diff.txt ]; then echo true; else echo false; fi)}"
```

## 2. ALIAS RESOLUTION & INTENT PARSING

Translate the `Raw Input` to standard Git commands based on Oh My Zsh conventions. Examples:

- `gco` -> `git checkout`
- `gcb` -> `git checkout -b`
- `gc` / `gcmsg` -> `git commit -m`
- `ga` -> `git add`
- `gaa` -> `git add --all`
- `gp` -> `git push`
- `gl` -> `git pull`
- `gst` -> `git status`

## 3. CONTEXTUAL GENERATION (THE SMART LAYER)

Based on the resolved command, apply the following logic:

**A. Auto-Branching (`git checkout -b`):**

- **Trigger:** The resolved command is `git checkout -b` AND no branch name is provided in the input.
- **Action:** 1. If `TICKET_ID` is not "NONE", read `.agent-kit/handoffs/tickets/${TICKET_ID}.md` to determine the ticket type (Feature, Bug, Refactor) and a short summary. 2. Generate a branch name strictly following the pattern: `<type>/${TICKET_ID}-<short-kebab-case-summary>`. 3. Formulate the final command.

**B. Auto-Committing (`git commit`):**

- **Trigger:** The resolved command is `git commit` or `git commit -m` AND no message is provided in the input.
- **Validation:** If `has_staged_files` is false, ABORT and output: "Cannot commit: No files staged."
- **Action:**
  1. Read `.agent-kit/handoffs/staged_diff.txt` to analyze the actual code changes.
  2. If `TICKET_ID` is not "NONE", read `.agent-kit/handoffs/tickets/${TICKET_ID}.md` for business context.
  3. Generate a strict Conventional Commit message: `<type>(<scope>): [${TICKET_ID}] <imperative description>`.
  4. Formulate the final command wrapped in quotes for the message.

**C. Direct Pass-through:**

- If the command requires no generation (e.g., `git status`, `git push`), output the raw translated command.

## 4. INTERACTIVE EXECUTION PROTOCOL (CRITICAL)

You are the Executor. You have determined the final, exact Git command to run.

**STEP 1: The Proposal**
You MUST output the proposed command wrapped in a bash block:

```bash
<FINAL_GENERATED_GIT_COMMAND>
```

**STEP 2: Confirmation**
Ask the user to confirm before executing: "Run this command? (y/n)"
Wait for explicit approval before proceeding.
