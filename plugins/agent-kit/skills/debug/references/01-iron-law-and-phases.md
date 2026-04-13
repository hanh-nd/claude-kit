---
name: iron-law-and-phases
description: Iron Law & 5 Phases for debugging and root cause investigation.
version: 1.0.0
---

# Debugging Methodology: The Iron Law & The 5 Phases

## The Iron Law

**NO FIXES WITHOUT ROOT CAUSE INVESTIGATION FIRST.**
Fixing symptoms creates whack-a-mole debugging. Every fix that doesn't address the root cause makes the next bug harder to find. Find the root cause, then fix it.

## Phase 1: Root Cause Investigation

Gather context before forming any hypothesis.

1.  **Collect symptoms:** Read error messages, stack traces, and steps to reproduce.
2.  **Read the code:** Trace the execution path backwards from the symptom.
3.  **Check history:** Use `git log --oneline -20 -- <affected-files>` to see if a recent regression caused this.
4.  **Reproduce:** Ensure you can trigger the bug deterministically.

## Phase 2: Pattern Analysis

Cross-reference your findings with known patterns (See `02-pattern-analysis.md`). Check `TODOS.md` or `git log`—recurring bugs in the same area indicate an architectural smell, not a coincidence.

## Phase 3: Hypothesis Testing

Before writing ANY fix logic, verify your hypothesis:

1.  **Confirm it:** Add a temporary log or assertion at the suspected root cause. Does the evidence match?
2.  **The 3-Strike Rule:** If you test 3 hypotheses and all fail, **STOP**. This is an architectural issue, not a simple bug. Do not guess.
3.  **Red Flags:** Stop if you catch yourself thinking "Quick fix for now" or proposing a fix before tracing data flow.

## Phase 4: Implementation

Once the root cause is confirmed:

1.  **Fix the root cause, not the symptom.** Keep the diff minimal.
2.  **Write a regression test:** It MUST fail without your fix, and pass with it.
3.  **Run tests:** Ensure no regressions. If the fix touches >5 files, reconsider the approach.

## Phase 5: Verification & Report

Reproduce the original bug scenario to confirm the fix works. Run the test suite. Generate the Debug Report (See `03-report-format.md`).
