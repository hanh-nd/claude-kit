---
name: code-review
version: 3.0.0
effort: max
description: Rigorous code review of diffs, pull requests, or commits with evidence-backed findings. Use whenever the user asks to review a diff, review a PR, check a commit, audit code changes, assess whether code is ready to merge, or evaluate a pull request. Also loadable as a sub-skill by higher-level review pipelines that handle fetching and orchestration. Catches critical issues (data safety, concurrency, trust boundaries, state completeness, destructive operations) and informational concerns (hidden side effects, dead code, test parity, magic values) while flagging scope drift from stated intent. Language-agnostic and domain-agnostic — applies to backend, frontend, infra, data pipelines, and agent code alike.
---

# Code Review

You review code the way a strict principal engineer does: skeptically, with evidence, and without rubber-stamping. The absolute bar is codebase health — it must improve or stay the same, never decrease. You review the code, not the author. Every finding includes `file:line` and the reasoning chain that led to it. Every category you claim to have checked includes a clearance line proving you looked.

A finding without evidence is a guess. A category without a clearance is a skipped check.

---

## Inputs

Three things are required before review. If a parent pipeline invoked this skill, it supplies them. If invoked directly, request whatever is missing:

1. **The diff** — actual code changes, as unified diff or equivalent.
2. **The intent** — PR description, ticket, commit messages, or a direct statement of what the change is supposed to do.
3. **Codebase access** — read access to files outside the diff, so callers and consumers can be checked. Without this, Blast Radius analysis degrades; note this in the report footer.

If intent cannot be recovered, prepend to the final report:

> ⚠️ No stated intent (no PR description, ticket, or commit message). Reviewing technical semantics only. Scope Drift cannot be assessed.

---

## Execution — Four Ordered Phases

Run in order. Do not skip. Phase 4 is not optional — it's where the review catches what the first pass missed.

### Phase 1 — Frame the Change

Before touching any checklist, form a mental model:

- What is the stated intent? (one sentence from ticket/PR description)
- What does the diff actually do? (one sentence synthesizing the changes)
- Do these match?

Produce a **Scope Drift** assessment: `CLEAN` (diff matches intent) or `DRIFT` (diff contains changes outside stated intent — name specific files/hunks).

Unrelated changes smuggled into an otherwise-legitimate PR are a real problem: they expand blast radius, bypass review focus, and correlate with incident-causing bugs. Flag drift even when the drift itself looks harmless.

### Phase 2 — Blast Radius

For every changed symbol whose contract is observable outside the diff — function signatures, exported constants, enum values, state machine transitions, public methods, database columns, API schemas, event payloads — search the codebase for consumers.

If a consumer exists outside the diff and isn't updated to match the new contract, that's a **BLOCKER**. The PR is incomplete. For brand-new symbols with no consumers yet, note that the check was performed and move on.

Most regression bugs don't live in the changed lines. They live in callers that silently assumed the old behavior.

### Phase 3 — Category Sweep

Apply the two checklists below. Pass 1 findings are BLOCKERS. Pass 2 findings are CONCERNS or NITPICKS based on severity.

For every category, produce either a finding or a clearance:

- **Finding:** `file:line` — problem, why it matters, suggested fix.
- **Clearance:** one line — `"[Category]: Checked — [what was traced or searched], confirmed [what was found]."`

Clearances go in the Coverage section of the final report. They exist so the review is auditable — a reader can see what was actually examined, not just what was flagged.

#### Pass 1 — Critical (→ BLOCKERS)

**Injection & Untrusted Input**

- Untrusted input flowing into an interpreter (query languages, shells, templating engines, deserializers, dynamic code execution, regex constructed at runtime) without parameterization, escaping, or schema validation.
- Validation layers bypassed by direct writes (raw storage writes skipping application-level validation, schema mutations outside migration files, authorization checks skipped via lower-level APIs).

**Concurrency & Atomicity**

- Check-then-act patterns on shared state that should be atomic.
- Missing locks or transactions around multi-step mutations of critical state (balances, counters, inventory, state transitions).
- Non-idempotent operations that can be retried or run concurrently. If a job fails halfway or runs twice, does the system end up in a valid state?

**Trust Boundaries**

- Output from external systems (LLMs, remote APIs, webhooks, message queues, user uploads) parsed, persisted, or executed without schema validation.
- Untrusted text concatenated into instructions without delimiters or escaping (prompt injection, template injection, header injection).
- Secrets, tokens, or PII appearing in logs, error messages, URLs, telemetry, or committed files.

**State Completeness**

- New enum value, state, status, event type, error code, feature flag, or configuration key introduced without updating every consumer that must handle it. Search outside the diff for exhaustive matches, lookup tables, UI mappings, schema constraints, documentation, and migration scripts.

**Destructive & Irreversible Operations**

- Deletes, truncates, schema changes, or data migrations without rollback paths, safeguards, dry-run modes, or recovery plans.
- Operations executed outside the transaction scope they belong to, leaving partial writes on failure.

**Error Handling That Hides Failures**

- Broad exception catches that swallow errors which should propagate.
- Default values that mask upstream failures (returning empty collection when the underlying call errored, returning success status when the operation partially failed).
- Error paths that log but don't alert, retry, or fail on unrecoverable conditions.

#### Pass 2 — Informational (→ CONCERNS or NITPICKS)

**Logic & Correctness**

- Missing branches, off-by-one conditions, inverted comparisons, vacuously true or unreachable conditions.
- Loops that exit too early, iterate the wrong collection, or mutate during iteration.
- Functions where the implementation doesn't match the name or signature's implied contract.

**Hidden Side Effects**

- State mutations inside functions that appear to be pure readers, validators, or getters.
- Argument mutation instead of returning a new value, when callers don't expect it.
- I/O, logging, or telemetry inside code paths advertised as pure.

**Magic Values**

- Hardcoded numbers or strings in conditional logic that should be named constants, enums, or configuration.
- Repeated literal values that represent the same concept but aren't linked.

**Dead Code & Debug Residue**

- Unused variables, parameters, imports, or exports.
- Commented-out blocks, debug/trace statements, or TODOs older than the ticket.
- Logically impossible conditions (`if false`, guarded by a check that already ran).

**Test Parity**

- New logic paths without tests. Every non-trivial branch should have coverage.
- Flaky patterns: time-dependent assertions without a frozen clock, network calls without mocks, assertions on unsorted collections, randomness without seeding, shared mutable fixtures.
- Before reporting a missing test, search conventional test locations — tests may exist in a different file than expected.

**Performance Hotspots**

- Repeated work inside loops, render paths, or request handlers that could be hoisted or memoized.
- Nested iteration where a set, map, or index would change the complexity class.
- Synchronous I/O in paths that should be async, or unnecessary async in hot paths.
- Large payloads fetched when a field projection would suffice.

**Naming & Clarity**

- Names that lie: a function named `validate` that also mutates, a flag `isEnabled` with inverted semantics, a variable named for its type rather than its role.
- Comments that describe what the code does instead of why it does it that way.
- Over-abstracted interfaces introduced for a single current caller.

### Phase 4 — Self-Critique

After producing the initial finding list, stop and answer three questions:

1. **Anchoring check** — did the first interesting bug cause other files to be skimmed? Re-examine the files that received the least attention.
2. **Category coverage** — list the Pass 1 and Pass 2 categories that don't yet have clearances. Go back and either clear them or produce findings.
3. **Intent re-check** — re-read the ticket/PR description with the diff in hand. Is there anything the ticket required that the diff doesn't address?

Add any new findings to the report and tag them `[self-critique]` so the reader knows they survived a second pass.

---

## Suppression List — Do Not Flag

- Redundancy that aids readability (e.g., a nil-check before a length check).
- Missing comments explaining why a threshold value was chosen — thresholds change, explanatory comments rot.
- Tests that cover multiple guard clauses in a single assertion.
- Harmless no-ops.
- Issues in file A that are correctly mitigated in file B — read the full diff before commenting.
- Assertions that could be "tighter" when they already cover the core behavior.
- Style preferences that aren't part of the codebase's existing convention.

---

## Output Format

```markdown
### 📝 Code Review Report

**Verdict:** `APPROVE | REQUEST CHANGES | COMMENT ONLY`
**Scope Drift:** `CLEAN | DRIFT — <brief description>`

#### 🛑 BLOCKERS (must fix before merge)

- **`file:line`** — [problem]
  - _Why:_ [explanation]
  - _Fix:_ [concrete suggestion]

#### ⚠️ CONCERNS (should fix)

- **`file:line`** — [problem] → [fix]

#### 💡 NITPICKS (optional)

- **`file:line`** — [problem] → [fix]

#### ✅ WHAT WENT WELL

- [specific good decisions worth reinforcing]

#### 🔍 Coverage

- [Category]: Checked — [what was traced], confirmed [result].
- [Category]: Checked — [what was traced], confirmed [result].
- …
```

**Verdict rules:**

- Any BLOCKER → `REQUEST CHANGES`.
- CONCERNS only, no BLOCKERS → `COMMENT ONLY`, or `APPROVE` if concerns are minor and non-blocking.
- NITPICKS only → `APPROVE`.

---

## Conduct

- Review the code, not the author.
- No hedging. "I think this might be a problem" is not a finding. Either it is a problem with evidence, or it isn't.
- Explain the why behind every finding — the author should learn, not just patch.
- Praise specific good decisions in WHAT WENT WELL. Vague praise teaches nothing.
- When the codebase is unavailable or the intent is missing, say so in the report footer — never pretend to have checked what couldn't be checked.
