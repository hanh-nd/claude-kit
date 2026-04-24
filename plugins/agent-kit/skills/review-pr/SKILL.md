---
name: ak:review-pr
version: 1.0.0
description: Fetch a PR with its Jira context, check out its branch locally for full codebase access, invoke the code-review skill, and return a complete review. Use whenever the user wants a deep review of a PR by URL or identifier, or asks to "review PR X", "check PR X", "is PR X ready to merge", or "audit this pull request".
---

# Review PR

**PR Target:** $ARGUMENTS

This skill is a thin orchestrator. It handles fetching the PR, pulling its Jira ticket, and setting up the local codebase so the `code-review` skill can run with full context. Review criteria, severity levels, output format, and judgment all live in `code-review` — this skill does not duplicate or override them.

---

## Execution Pipeline

### Phase 1 — Context Acquisition

Gather the inputs `code-review` needs:

1. **PR details + diff.** Call `kit_get_bitbucket_pr(input: "$ARGUMENTS", includeDiff: true)`. Capture PR metadata (`workspace`, `repoSlug`, `sourceBranch`, `destinationBranch`, `title`, `description`, `author`) and the unified diff. On tool error, stop and report the error to the user — do not fall back to partial data.

2. **Jira ticket (if referenced).** If a ticket ID matching `[A-Z]+-\d+` appears in the PR title, description, or branch name, call `kit_jira_get_ticket(ticketId: "EXTRACTED-ID")` and capture the ticket body. This becomes part of the intent passed to the child skill.

3. **Intent availability.** If no PR description, commit messages, or Jira ticket exists, record this — the child skill will emit its own missing-intent warning.

### Phase 2 — Environment Setup

Check out the source branch locally so `code-review` has full codebase access (required for Blast Radius analysis):

1. `git branch --show-current` → save as `originalBranch`.
2. `git status --porcelain` → if non-empty, mark `checkoutState = UNHAPPY` (dirty working tree; checkout would destroy uncommitted work).
3. `git remote get-url origin` → if the URL does not contain both `workspace` and `repoSlug` from Phase 1, mark `checkoutState = UNHAPPY` (wrong repo).
4. If not marked `UNHAPPY`:
   - `git fetch origin`
   - `git checkout {sourceBranch}`
   - `git reset --hard origin/{sourceBranch}`
   - Set `checkoutState = CHECKED_OUT`.
5. If `UNHAPPY`: skip checkout. Never stash, never force. Record the reason (`dirty working tree` or `mismatched repo`).

### Phase 3 — Invoke `code-review`

Load the `code-review` skill and hand it:

- **Diff** — from Phase 1.
- **Intent** — PR description and Jira ticket body (when available). If neither exists, pass what you have and let the child skill handle the missing-intent case.
- **Codebase access** — full if `checkoutState = CHECKED_OUT`, degraded if `UNHAPPY`. Tell the child which mode applies so its Blast Radius phase can adjust.

The child owns framing, Scope Drift assessment, Blast Radius, Pass 1 and Pass 2 sweep, self-critique, and final report formatting. Do not re-run those phases here and do not second-guess the child's verdict.

### Phase 4 — Report Assembly

Prepend this PR header to the child skill's report:

```markdown
## 📝 PR Review: {PR Title}

- **PR:** [{workspace}/{repoSlug}#{PR number}]({PR URL})
- **Branch:** `{sourceBranch}` → `{destinationBranch}`
- **Ticket:** `{TICKET-ID}` — {ticket title, if available}
- **Author:** {PR author}
```

Append the child skill's full report below the header, unchanged. Do not rewrite or summarize the child's findings.

If `checkoutState = UNHAPPY`, append this to the report footer:

> ⚠️ Codebase context unavailable ({reason}). Blast Radius and callsite verification could not run. Review is diff-only.

### Phase 5 — Environment Restore (always runs)

This phase runs before returning the report, and must run even if Phases 1–4 errored partway through. Treat it as cleanup that survives failure:

- If `checkoutState = CHECKED_OUT`: `git checkout {originalBranch}`.
- If `checkoutState = UNHAPPY`: nothing to restore; skip.

If the restore command itself fails, surface that failure clearly in the final output so the user knows their git state needs manual recovery. A silent failure here leaves the user on an unexpected branch — worse than the original review problem.

**Implementation rule:** before moving to Phase 1, register in your working memory that Phase 5 is mandatory. If you encounter an error mid-pipeline, do not terminate the response without executing Phase 5 first.

---

## What this skill does NOT do

To keep the boundary with `code-review` clean:

- It does not define review criteria, severity levels, category checklists, or output sections — those belong to `code-review`.
- It does not produce findings of its own. If a PR-level concern exists that the child skill missed, the fix is to improve `code-review`, not to duplicate logic here.
- It does not mutate the PR (no comments posted, no approve/reject actions). The review is advisory; the human decides.
- It does not re-assess Scope Drift, Blast Radius, or category coverage. The child skill reports those once, in its own format.
