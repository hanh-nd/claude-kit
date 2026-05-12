---
name: investigate
description: 'Systematic root-cause investigation — traces bugs, errors, and unexpected behavior to their source and produces an evidence-backed Investigation Report. Use when the user presents an error, crash, test failure, stack trace, or unexpected behavior. Output is a report only; no code changes are applied.'
version: 1.0.0
providers:
  claude:
    effort: high
---

# 🔎 Investigate

**Issue:** $ARGUMENTS

---

## The Iron Law

**No conclusions without evidence.** A hypothesis without proof is a guess. Your job is to find and confirm the root cause — not to fix it. Source code changes are out of scope; this skill produces an Investigation Report that a developer or the `code` skill can act on.

---

## Phase 1: Symptoms & Reproduction

Gather evidence before forming any hypothesis.

1. **Capture baseline.** Record the current broken state before investigating: exact command run, full error/test output, stack trace, relevant logs with timestamps, and `git status --short`. This is the before-state that `code` must verify against after applying a fix.
2. **Collect symptoms.** Read error messages, stack traces, and steps to reproduce verbatim.
3. **Reproduce.** Confirm the issue is triggerable deterministically. If it is intermittent, document the conditions under which it appears.
4. **Check history.** Run `git log --oneline -20 -- <affected-files>` to surface recent regressions.
5. **Trace the code path.** Starting from the error, trace execution backwards through the call stack to the earliest contributing point.

While tracing, note which patterns in the Pattern Catalog the symptoms resemble — pattern recognition runs naturally alongside reading and need not wait for Phase 2.

---

## Phase 2: Pattern Match

Cross-reference your findings against the catalog. A matching pattern becomes the starting hypothesis. If multiple patterns match, rank by fit and investigate the strongest first.

Check `git log` for recurring fixes in the same area — a file patched repeatedly for similar issues signals an architectural smell, not a coincidence.

### Pattern Catalog

| Pattern | Signature | Where to look |
| :-- | :-- | :-- |
| **Race condition** | Intermittent, timing-dependent failures | Concurrent access to shared state |
| **Nil/null propagation** | `NoMethodError`, `TypeError`, `Cannot read properties of undefined` | Missing guards, unvalidated API responses |
| **State corruption** | Inconsistent data, partial updates | Transactions, callbacks, lifecycle hooks |
| **Integration failure** | Timeout, unexpected response shape | External API calls, service boundaries |
| **Configuration drift** | Works locally, fails in staging/prod | Env vars, feature flags, DB migrations |
| **Stale cache** | Shows old data, clears on flush | Redis, CDN, browser cache |
| **Off-by-one** | Wrong final element, fence-post errors | Loop bounds, index calculations, pagination |
| **Dependency conflict** | Works in isolation, fails when combined | Package versions, transitive dependencies |
| **Serialization failure** | Wrong shape, missing fields, type coercion | JSON parsing, API contracts, schema validation |
| **Auth/permission failure** | 401/403, silent access denial | Token expiry, scope checks, middleware order |

---

## Phase 3: Hypothesis Testing

Form one specific, falsifiable hypothesis at a time.

1. **State the hypothesis.** "The root cause is X because Y."
2. **Define proof conditions before testing.** For each hypothesis, state:
   - what evidence would confirm it
   - what evidence would refute it
   - the fastest safe test
3. **Add targeted instrumentation if needed.** Insert a temporary log or assertion at the suspected root cause and read the output.
4. **Remove instrumentation.** Once the hypothesis is confirmed or refuted, remove all temporary logs and assertions before proceeding.
5. **Record the result in a hypothesis ledger.** Mark each hypothesis `CONFIRMED`, `REFUTED`, or `INCONCLUSIVE` with the evidence that decided it.
6. **Apply the 3-strike rule.** After three consecutive refuted hypotheses, stop. The root cause is either architectural or requires information not available in this context. Set status to `INCONCLUSIVE` and write the report documenting what was ruled out.

Move to a new hypothesis only after the current one is confirmed or refuted with evidence.

### Root Cause Chain

After a hypothesis is confirmed, trace it backward in this exact shape:

```
Symptom → immediate cause → contributing factor(s) → root cause
```

The root cause is the earliest actionable trigger inside the codebase or its configuration boundary. If the chain stops at the line where the error appeared, the report cannot be `CONFIRMED`; it is `PROBABLE` at best. Recommended Actions must target the root cause, not the symptom location.

---

## Phase 4: Report

Write the Investigation Report immediately after a hypothesis is confirmed or after the 3-strike rule triggers.

```
# 🔍 INVESTIGATION REPORT: [Short Descriptive Title]

> **Status:** [CONFIRMED | PROBABLE | INCONCLUSIVE]
> **Pattern Match:** [Pattern Name from Catalog, or "None"]

---

## 📌 Executive Summary
* **Symptom:** [What was observed—error message, behavior, or steps to reproduce]
* **Root Cause:** [High-level mechanical explanation of what is wrong and why]
* **Blast Radius:** [Number of files] — [Systems or modules affected]
* **Verification Target:** [Exact command or manual reproduction step that demonstrates the bug before the fix and should pass after the fix]

---

## 🛠 Technical Deep Dive

### 0. Baseline Captured
| Item | Evidence |
| :--- | :--- |
| Command / Repro Step | `[exact command or steps]` |
| Error / Output | `[verbatim failure output or observed behavior]` |
| Logs / Stack Trace | `[relevant excerpt, timestamped if available]` |
| Git State | `[git status --short summary]` |

### 1. Root Cause Analysis
[Provide the detailed breakdown of the failure mechanism here. Use bullet points for compounding issues.]
* **Root Cause Chain:** Symptom → immediate cause → contributing factor(s) → root cause
* **[Primary Issue]:** [Detailed explanation]
* **[Contributing Factor]:** [Detailed explanation]

### 2. Hypothesis Ledger
| Hypothesis | Confirm Evidence | Refute Evidence | Result | Evidence Used |
| :--- | :--- | :--- | :--- | :--- |
| [Root cause is X because Y] | [What would prove it] | [What would disprove it] | CONFIRMED / REFUTED / INCONCLUSIVE | [file:line, command output, log, or observation] |

### 3. Evidence & Observations
| Location (File:Line) | Observation | Significance |
| :--- | :--- | :--- |
| `path/to/file:line` | [Log output, code snippet, or state value] | [How this confirms the hypothesis] |
| `path/to/file:line` | [Log output, code snippet, or state value] | [How this confirms the hypothesis] |

---

## 🚀 Recommended Actions
[List the specific steps the `code` skill or a developer should take to resolve the root cause. Do not recommend patching only the symptom location unless that location is proven to be the root cause.]
1.  **[File/Component]:** [Specific fix logic]
2.  **[File/Component]:** [Specific fix logic]

### Prevention Needed
[State the minimal recurrence-prevention work the implementer should include. Every report must either name a prevention measure or explicitly state why none applies.]
* **Regression Coverage:** [Test or manual assertion that should fail before the fix and pass after]
* **Guard / Validation:** [Boundary check, type guard, timeout, transaction, or other prevention if applicable]
* **Observability:** [Log/error context that would make recurrence diagnosable, or "none needed"]

---

## 🔗 Metadata & Context
* **Related History:** [Prior bugs in the same area, TODOs, or architectural notes]
* **Investigation Path:** [Summarize the hypothesis ledger, especially refuted hypotheses future agents should not retry]
* **Hard Stop Notes:** [If Blast Radius > 5 files or reproduction was impossible, explain why here]
```

**Status definitions:**

- `CONFIRMED` — root cause traced to a specific condition and confirmed with direct evidence.
- `PROBABLE` — strong hypothesis supported by circumstantial evidence but not fully reproducible (e.g., intermittent issue, restricted environment).
- `INCONCLUSIVE` — 3-strike rule triggered; hypotheses exhausted without confirmation; report documents what was ruled out.

---

## Hard Stops

Surface to the user when:

- **Blast radius exceeds 5 files.** The root cause touches more than 5 files — this likely indicates an architectural issue rather than a point bug. Note this in the report and recommend a planning session before any fix is attempted.
- **Reproduction is impossible.** The issue cannot be reproduced and the environment difference is unclear. Note the gap in the Evidence field and set status to `PROBABLE` or `INCONCLUSIVE`.
- **Root cause is in a dependency.** The bug originates in an external package or service outside the codebase. Document the finding and stop — do not trace further into the dependency.
