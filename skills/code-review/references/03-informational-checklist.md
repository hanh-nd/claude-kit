---
name: 03-informational-checklist
description: Informational Checklist
version: 1.0.0
---

# Pass 2: Informational Checklist & Operations

This pass focuses on codebase health, side effects, and testing. Findings here should be classified as **CONCERNS** (ambiguous, needs developer input) or **NITPICKS** (mechanical auto-fixes).

## 1. Pass 2 Checklist Categories

### Conditional Side Effects & State Mutations

- Flag hidden state mutations inside functions that appear to be pure getters or validators.
- Flag modifying arguments directly (mutation) instead of returning a new copy (unless explicitly designed for performance).

### Magic Numbers & String Coupling

- Flag hardcoded numbers or strings used in conditional logic. Demand they be extracted to named constants or enums.

### Dead Code & Consistency

- Flag unused variables, lingering `console.log` / `debugger` statements, or commented-out code blocks.
- Flag redundant `if` checks that are logically impossible to reach.
- Flag version or path mismatches.

### Prompt & Context Issues (LLM specific)

- Flag vague instructions in LLM prompts (e.g., "be helpful") instead of explicit system directives.
- Flag context bloat: feeding massive files to an LLM when only a snippet is needed.

### Test Parity & Gaps

- Flag missing failure path tests. Every new logic path must be tested.
- Flag flaky test risks (e.g., relying on `Time.now` without freezing time, or unsorted array assertions).
- Flag missing mocks for external HTTP boundaries.

### View / Frontend

- Flag `O(n*m)` lookups in views/templates (e.g., finding an item in an array inside a render loop).
- Flag inline styles instead of CSS classes.

---

## 2. The Fix-First Heuristic

When categorizing findings, apply the Fix-First logic:

- **AUTO-FIX (Nitpicks):** If the fix is mechanical and a senior engineer would apply it without discussion (e.g., renaming a variable, removing dead code, extracting a magic number).
- **ASK (Concerns):** If reasonable engineers could disagree about the fix, or if it requires architectural judgment.
  _Note: Critical findings from Pass 1 default toward ASK because they are inherently riskier. Informational findings default toward AUTO-FIX._

---

## 3. Suppressions — DO NOT FLAG THESE

You are strictly forbidden from flagging the following harmless patterns to avoid review noise:

- **Harmless Redundancy:** Do not flag "redundancy" if it aids readability (e.g., checking `if present?` before checking `length > 20`).
- **Missing Comments for Thresholds:** Do not ask for comments explaining why a threshold/constant was chosen, as these change during tuning and comments rot.
- **Multi-guard Tests:** Do not complain if a single test exercises multiple guard clauses simultaneously. Tests don't need to isolate every guard.
- **Harmless No-ops:** Do not flag operations like calling `.reject` on an element that's never in the array.
- **Already Addressed Issues:** Read the FULL diff before commenting. Never flag an issue in file A if it is mitigated correctly in file B.
- **Tighter Assertions:** Do not complain "this assertion could be tighter" if the assertion already covers the core behavior.
