---
name: ak:review
version: 1.0.0
description: Review local uncommitted code changes (both staged and unstaged) with auto-detected Jira context from the current branch. Use whenever the user wants to review their work in progress, check their local changes before committing or pushing, or asks to "review my changes", "review current code changes", "review current diff", "check my work", or "review this". Defaults to reviewing all uncommitted tracked changes from HEAD; accepts an optional base (branch, tag, or commit) to diff against for broader scopes.
---

# Review Local Changes

**Target Base:** `$ARGUMENTS` _(defaults to `HEAD` — reviews all staged and unstaged changes to tracked files)_

Thin orchestrator for reviewing local code changes. Computes the diff, detects Jira context from the current branch, invokes the `code-review` skill, and assembles the output. Review criteria, severity, and output format are owned by `code-review` — this skill does not duplicate them.

---

## Execution Pipeline

### Phase 1 — Acquire Changes

Compute the diff with JS/TS noise excluded:

```bash
BASE_TARGET="$ARGUMENTS"
if [ -z "$BASE_TARGET" ]; then
  BASE_TARGET="HEAD"
fi

CURRENT_BRANCH=$(git branch --show-current)

DIFF=$(git diff "$BASE_TARGET" -- . \
  ':(exclude)package-lock.json' \
  ':(exclude)yarn.lock' \
  ':(exclude)pnpm-lock.yaml' \
  ':(exclude)bun.lockb' \
  ':(exclude)node_modules/*' \
  ':(exclude)dist/*' \
  ':(exclude)build/*' \
  ':(exclude).next/*' \
  ':(exclude)out/*' \
  ':(exclude).turbo/*' \
  ':(exclude)coverage/*' \
  ':(exclude)storybook-static/*' \
  ':(exclude)*.min.js' \
  ':(exclude)*.min.css' \
  ':(exclude)*.snap' \
  ':(exclude)*.tsbuildinfo' \
  ':(exclude)*.svg' \
  ':(exclude)*.png' \
  ':(exclude)*.jpg' \
  ':(exclude)*.jpeg' \
  ':(exclude)*.gif' \
  ':(exclude)*.ico' \
  ':(exclude)*.woff' \
  ':(exclude)*.woff2' \
  ':(exclude)*.ttf')

FILES_CHANGED=$(git diff "$BASE_TARGET" --name-only -- . | wc -l | tr -d ' ')
UNTRACKED_COUNT=$(git ls-files --others --exclude-standard | wc -l | tr -d ' ')
```

Notes on scope:

- `.env*` files are intentionally NOT excluded. If one shows up in the diff, it should surface as a secret-leak finding via the `code-review` skill's Trust Boundaries category, not be silently hidden.
- Migration files are NOT excluded. Destructive operations are in scope for review.
- Untracked files are outside `git diff` and cannot be reviewed here. They're reported as a footnote only.

**Empty diff handling:** If `DIFF` is empty, stop and tell the user there are no changes between the working tree and `$BASE_TARGET`. Suggest `git status` or passing a different base. Do not invoke `code-review` on an empty diff.

### Phase 2 — Detect Jira Intent (optional)

Extract a ticket ID from the current branch name:

```bash
TICKET_ID=$(echo "$CURRENT_BRANCH" | grep -oE '[A-Z]+-[0-9]+' | head -1 || true)
```

- If `TICKET_ID` is non-empty: call `kit_jira_get_ticket(ticketId: "$TICKET_ID")` and pass the ticket body as intent to the child skill. If the tool call fails, proceed without intent — do not block the review.
- If `TICKET_ID` is empty: proceed with no intent. Do not warn, do not prompt. This is the expected case for branches without ticket references.

### Phase 3 — Invoke `code-review`

Load the `code-review` skill and pass it:

- **Diff** — from Phase 1.
- **Intent** — Jira ticket body if available; otherwise absent.
- **Codebase access** — always full (running locally in the target repository).

The child owns framing, Scope Drift (when intent is available), Blast Radius, Pass 1 and Pass 2 sweep, self-critique, and final report formatting. Do not re-run those phases here.

### Phase 4 — Report Assembly

Prepend this header to the child skill's report:

```markdown
## 🕵️ Local Change Review

- **Branch:** `{CURRENT_BRANCH}`
- **Base:** `{BASE_TARGET}`
- **Files changed:** {FILES_CHANGED}
- **Ticket:** `{TICKET_ID}` — {ticket title} ← omit this line entirely if no ticket
```

Append the child skill's full report below, unchanged.

If `UNTRACKED_COUNT > 0`, append to the report footer:

> ℹ️ {UNTRACKED_COUNT} untracked file(s) exist in the working tree but were not reviewed — `git diff` does not include them. Run `git add -N .` (or `git add -A`) and re-run `/review` to include them.

---

## What this skill does NOT do

- Does not define review criteria, severity, or output format — those belong to `code-review`.
- Does not mutate git state: no staging, no stashing, no commits, no branch switches.
- Does not review untracked files by default.
- Does not silently drop `.env*` files or migrations from the diff — those need eyes on them.
- Does not re-assess Scope Drift, Blast Radius, or category coverage — the child owns those.
