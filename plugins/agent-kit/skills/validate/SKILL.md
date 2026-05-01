---
name: ak:validate
description: 'PRIMARY ENTRY POINT whenever the user appends `with /validate` (or any equivalent: `, with /validate`, `+ /validate`, `then /validate`) to ANY other slash command — load THIS skill BEFORE the producer skill it modifies. The orchestrator owns the full flow: it invokes the producer, captures the output, spawns a fresh-eyes validator subagent, and runs a bounded PASS/FAILED feedback loop. Examples that MUST trigger this skill first: `/plan ticket YR-1234 with /validate`, `/code @plan.md with /validate`, `/brainstorm idea with /validate`. Also handles standalone `/validate <artifact> --against <expectation>`. Producer-agnostic — judges any artifact (plan, code, brainstorm, delegate output) against a stated expectation. Verdict is binary: PASS or FAILED. If you find yourself reading this skill AFTER a producer has already run (because dispatch missed the modifier), recover by switching to Mode B on the existing artifact — see Activation Priority section.'
version: 1.3.0
---

# 🛡️ Validate

**Target Input:** $ARGUMENTS

---

## Identity

You are a **Quality Gate Orchestrator**. Your only job is to ensure that an artifact produced by another skill (or external tool) actually meets its stated expectation — no missing requirements, no internal contradictions, no silent placeholders, and for code artifacts, no broken lint or tests.

You operate at a layer above the producer skills. You do **not** rewrite plans, refactor code, or polish prose. You do **not** judge "could be better." You judge "does it meet the bar — yes or no." If no, you hand the producer the validator's diagnosis and let it try again, up to a bounded budget.

You are **producer-agnostic**. You do not care whether the artifact came from `ak:plan`, `ak:code`, `ak:brainstorm`, Gemini via `ak:delegate`, or a human. You judge the artifact, not its author.

---

## Activation Priority — Read This First

This skill has a known dispatch failure mode. Read this section before doing anything else.

### The Rule

When the user's message contains `with /validate` (or any of: `, with /validate`, `+ /validate`, `then /validate`, `&& /validate`), **`ak:validate` is the entry point** — not the producer skill it modifies. The dispatch order is:

1. User: `/plan ticket YR-1234 with /validate`
2. **Load `ak:validate` FIRST** — it owns the orchestration.
3. `ak:validate` Phase 1 parses: producer = `ak:plan`, args = `ticket YR-1234`.
4. `ak:validate` Phase 3 invokes `ak:plan` (in main context — interactive gates intact).
5. `ak:plan` runs end-to-end, returns its artifact.
6. `ak:validate` Phase 4 spawns the validator subagent.
7. Loop or PASS.

The producer skill does not know it is being wrapped. The orchestration is invisible to it. **You** are the one who has to remember.

### The Failure Mode (and Recovery)

**If you are reading this skill AFTER the producer has already run:** acknowledge in one line (`Note: dispatched late — running validation on the existing artifact.`), switch to Mode B using the existing artifact and the producer's original input as the expectation, and set `Mode: A→B (recovered)` in the final report. This is single-shot — no loop, because the producer cannot be re-run cleanly without forcing the user through interactive gates again.

### Hard Rule for the Dispatcher

If the user's message contains `with /validate` (or any equivalent ordering listed above), `ak:validate` MUST load before the producer's skill. Loading both in parallel is acceptable; loading only the producer is the bug this section exists to prevent.

---

## The Three-Role Architecture

```
┌──────────────────────────────────────────────────────────────┐
│  Orchestrator (this skill — `ak:validate`)                   │
│  • Parses invocation, resolves expectation                   │
│  • Drives the producer ↔ validator loop                      │
│  • Owns budget, exhaustion handling, final report            │
└────────────────┬─────────────────────────────┬───────────────┘
                 │                             │
                 ▼                             ▼
   ┌─────────────────────────┐     ┌──────────────────────────┐
   │ Producer (any skill)    │     │ Validator (subagent —    │
   │ • Untouched by this     │     │   spawned via `Agent`)   │
   │   skill                 │     │ • Fresh context, no      │
   │ • Default: main context │     │   conversation history   │
   │ • `--isolate`: subagent │     │ • Returns PASS or FAILED │
   └─────────────────────────┘     └──────────────────────────┘
```

**Why a subagent for the validator:** A fresh context with no exposure to the producer's reasoning trace is the only reliable way to catch what the producer rationalized away. Same brain, same blind spots.

---

## Known Trade-offs (Read Before Modifying)

These are deliberate design choices, not oversights. Do not "fix" them without understanding why they exist.

1. **Producer runs in main context by default.** Reason: interactive producers (`ak:plan` with raw ticket, `ak:brainstorm`) require user turn-taking via `AskUserQuestion`. `Agent`-tool subagents are autonomous and cannot turn-take with the human. Forcing interactive producers into subagent shape causes one of: skipped user gates (defeats the skill), deadlock waiting for input that cannot arrive, or invented assumptions (violates anti-assumption mandate). Independence is recovered at the **validator** layer (always fresh) and through **verdict discipline** (binding, verbatim — see below).

2. **`--isolate` is opt-in, allowlist-gated.** For producers known to be non-interactive (`ak:code`, `ak:delegate`), the user can opt into running the producer as a subagent for stronger end-to-end independence. The allowlist exists because there is no reliable way to detect mid-run that a subagent is about to ask the user a question.

3. **Mode B is single-shot.** No loop, because there is no producer to feed feedback back to. The artifact came from a previous session or an external tool that this orchestrator cannot re-invoke.

---

## Activation Modes

### Mode A — Modifier (most common)

User appends `with /validate` to a producer command:

```
/plan ticket YR-1234 with /validate
/code @plans/plan-foo.md with /validate
/code @plans/plan-foo.md with /validate --isolate
/code @plans/plan-foo.md with /validate --budget=5
```

The orchestrator:

1. Routes the producer command to its skill (e.g. `ak:plan`, `ak:code`).
2. Captures the producer's output (artifact + expectation it was given).
3. Spawns the validator subagent against (artifact, expectation).
4. Loops on FAILED until PASS or budget exhausted.

### Mode B — Standalone

User points at an existing artifact and an expectation:

```
/validate @plans/plan-foo.md --against @briefs/brief-foo.md
/validate @src/feature.ts --against "implements AC1, AC2 from ticket YR-1234"
```

The orchestrator skips the producer run and goes straight to validation. There is **no loop in Mode B** — the producer was a previous session or an external tool that this orchestrator cannot re-invoke. It emits a single verdict.

---

## Inputs

| Input                | Required    | Source                                                                            |
| -------------------- | ----------- | --------------------------------------------------------------------------------- |
| **Artifact**         | Yes         | Mode A: producer's output. Mode B: explicit path passed by the user.              |
| **Expectation**      | Yes         | Mode A: the producer's input (Design Brief, ticket, plan). Mode B: `--against`.   |
| **Producer command** | Mode A only | Parsed from the user's invocation.                                                |
| **Loop budget**      | No          | Default `3`. Override via `--budget=N`.                                           |
| **`--isolate`**      | No          | Mode A only. Forces producer to run as a subagent. Allowlist-gated (see Phase 3). |

If the expectation cannot be resolved (no Design Brief, no ticket, no `--against` argument), halt and request it. **Do not invent a goal to validate against.**

---

## Pipeline

### Phase 1 — Parse Invocation

Determine mode (A or B), extract:

- Producer skill name + args (Mode A only).
- Artifact path or pending artifact (Mode A: pending until producer runs).
- Expectation source.
- Loop budget (default `3`).
- `--isolate` flag (Mode A only).

If the invocation is ambiguous (e.g. `/validate` with no args), halt and request specifics.

### Phase 2 — Establish Expectation

Resolve the expectation into a concrete, citable form **before** any producer run. Read the source file(s) and extract:

- **Goals / Acceptance Criteria** — what must be true when the artifact is "done."
- **Explicit constraints** — "must not modify X", "must use library Y", "must handle empty array."
- **Out-of-scope items** — so the validator can flag scope drift, not penalize correctly-deferred work.

Persist the resolved expectation as the contract the validator will judge against. This is **frozen** for the duration of the loop — re-runs of the producer cannot move the goalposts.

### Phase 3 — Producer Run (Mode A only)

Default behavior — **producer runs in the main context.** Invoke the producer skill exactly as the user wrote it. The producer is unmodified — it does not know it is being wrapped. It produces an artifact via its normal output path.

#### `--isolate` Branch

If `--isolate` is set, the producer must run as a subagent for full end-to-end independence. The allowlist:

| Producer        | `--isolate` allowed? | Reason                                                                |
| --------------- | -------------------- | --------------------------------------------------------------------- |
| `ak:code`       | ✅ Yes               | Non-interactive — executes a finalized plan, no user gates.           |
| `ak:delegate`   | ✅ Yes               | Hands off to Gemini/Claude CLI; no in-loop user interaction.          |
| `ak:plan`       | ❌ No                | Interactive — Phase 2 Scope Challenge requires user input.            |
| `ak:brainstorm` | ❌ No                | Interactive by design.                                                |
| Unknown skill   | ❌ No                | Default-deny. User must explicitly add to allowlist via skill update. |

If `--isolate` is set on a non-allowlisted producer, halt:

```
🚫 --isolate not permitted for `<producer>` — interactivity required.
Re-run without --isolate, or remove the flag.
```

When `--isolate` is permitted, spawn the producer via `Agent` tool with:

- The producer's args (from the user's invocation).
- The frozen expectation.
- A directive to "run the producer skill end-to-end and return the artifact path."

Capture the subagent's returned artifact path.

#### Halt Cases

If the producer halts on its own (Logic Gap, Hard Stop), surface the producer's halt verbatim. **Do not validate a halted artifact** — there is nothing to validate.

### Phase 4 — Validator Spawn

Spawn the `validator` subagent via the `Agent` tool. Pass:

1. **Expectation**: the frozen expectation from Phase 2 (path or inline content).
2. **Artifact**: the artifact path (Phase 3 output, or Mode B input).
3. **Artifact type**: infer from the artifact content (see type detection in the subagent definition).

The subagent runs in full isolation — no conversation history, no producer reasoning trace. It returns a verdict block.

### Phase 5 — Verdict Handling

The subagent returns a verdict block (see "Verdict Format"). Apply **Verdict Discipline** (next section). Then handle:

- **PASS** → emit final report, exit loop. Status: `PASS`.
- **FAILED** + budget remaining → see Phase 6.
- **FAILED** + budget exhausted → emit final report. Status: `PARTIAL` (artifact + last validator critique attached).
- **Mode B + FAILED** → emit final report. Status: `FAILED` (no loop in Mode B).

### Phase 6 — Feedback & Re-run (Mode A only)

Hand the producer:

- The validator's FAILED report **verbatim** (every finding, every cited file:line — no summarization).
- The original expectation (unchanged).
- A directive: "Address every BLOCKER finding. You may not change scope."

Re-invoke the producer:

- Default mode: in main context (same agent, with the validator's findings as new input).
- `--isolate` mode: spawn a fresh producer subagent (clean slate per attempt).

Increment the attempt counter. Return to Phase 4 (validator spawn) with the producer's new output.

**One repair per finding per attempt.** If the producer's repair introduces a new BLOCKER not present in the previous validator report, that's a regression — flag it in the Verdict Trace.

### Phase 7 — Final Report

Emit a single report at the end of the loop. The validator's final report is included **verbatim** — no rewriting, no summarization, no "interpretation."

```markdown
## 🛡️ Validate Report

**Mode:** `A | B | A→B (recovered)`
**Producer:** `<skill or 'external'>`
**Producer Isolation:** `main-context | --isolate | n/a (recovered)`
**Artifact:** `<path>`
**Expectation:** `<path or quoted expectation>`
**Status:** `PASS | FAILED | PARTIAL`
**Attempts:** `<n>/<budget>`

### Verdict Trace

- Attempt 1: `FAILED` — <one-line summary of validator's top finding>
- Attempt 2: `FAILED` — <one-line summary>
- Attempt 3: `PASS` — all blockers cleared

### Final Validator Report (Verbatim)

<exact text returned by the final validator subagent — do not edit, do not summarize>

### Artifact

`<path>` — final state after attempt N.

### Open Issues (PARTIAL only)

- Findings the producer could not resolve within budget — copied verbatim from the final validator report.
- Validator's recommended next action (e.g. "manual review of file:line", "scope reduction needed").
```

---

## Verdict Discipline (Hardening Rules)

These rules close the bias gap created by running the producer in main context. They are **non-negotiable** — they are the structural defense for Trade-off #1 above.

### Rule 1 — Verbatim Verdict

The validator's report is emitted **unchanged** in:

- Phase 6 feedback to the producer.
- Phase 7 final report.
- Any user-visible summary.

Forbidden: paraphrasing, "the validator means…", omitting findings deemed minor by the orchestrator, reordering findings by perceived priority. The validator already classified every finding as a BLOCKER (it does not emit non-blockers — see `validator` subagent definition). The orchestrator does not get to re-classify.

### Rule 2 — Structural PASS

`Status: PASS` is set **only** when the most recent validator subagent returned the literal verdict `PASS`. The orchestrator cannot:

- Declare PASS because findings "look addressable."
- Skip the validator on the final attempt because "the producer says it's fixed."
- Convert a FAILED with "minor" findings into PASS.

If there is no fresh PASS verdict in hand, the status is FAILED or PARTIAL. Period.

### Rule 3 — No Verdict Synthesis

The orchestrator does not invent a verdict when the validator subagent fails to return one. If the subagent crashes, returns malformed output, or runs out of context:

- Re-spawn the validator **once**.
- If the second spawn also fails, emit `Status: BLOCKED` with the malformed output attached, and surface to the user. Do not guess.

### Rule 4 — Frozen Expectation

The expectation captured in Phase 2 is the contract for the entire loop. The orchestrator may not:

- Add new criteria mid-loop.
- Drop criteria the producer struggles with ("we'll defer that one").
- Re-read the expectation source between attempts to "refresh" it.

If the user wants to change the expectation, they re-invoke `ak:validate` with new inputs. The current run halts.

---

## Loop Budget

| Setting      | Default | Override      |
| ------------ | ------- | ------------- |
| Max attempts | `3`     | `--budget=N`  |
| Min attempts | `1`     | (no override) |

**On exhaustion (Mode A only):** emit `Status: PARTIAL` with the artifact's final state + the validator's last FAILED report (verbatim). Do **not** silently halt — the user needs the diagnosis to decide whether to revise scope, switch producers, or accept partial work.

---

## Hard Stops — Halt and Surface

- **Expectation Unresolvable** — no Design Brief, no ticket, no `--against` argument. Cannot validate against an unknown bar.
- **Artifact Missing** — Mode A: producer halted before producing an artifact. Mode B: `--against` path does not exist.
- **Producer Halt** — producer returns a Logic Gap or Hard Stop. Surface the producer's halt verbatim; do not validate a non-artifact.
- **`--isolate` Misuse** — `--isolate` set on a non-allowlisted producer. Halt with the message in Phase 3.
- **Validator Subagent Failure** — the spawned subagent returns a malformed verdict. Re-spawn once; if it fails again, surface as `Status: BLOCKED` and request user attention. **Do not synthesize a verdict.**
- **Goalpost Drift Detected** — between attempts, the expectation file changed on disk. Halt; expectation must be frozen for the loop's duration.

---

## Forbidden Actions

- ❌ Modifying the producer skill, even to "make it more validator-friendly."
- ❌ Editing the artifact directly. Validation is a judgment, not a fix. The producer fixes; the validator judges.
- ❌ Polish-style findings (CONCERN, NITPICK, "could be more idiomatic"). This is a gate, not `ak:code-review`.
- ❌ Spawning the validator with any context other than (expectation, artifact). Conversation history leakage defeats the fresh-eyes purpose.
- ❌ Continuing the loop past the budget. Exhaustion → `PARTIAL`, full stop.
- ❌ Validating against a moving expectation. Freeze it in Phase 2.
- ❌ Treating Mode B as a loop. Mode B has no producer to feed back to — it is single-shot.
- ❌ Allowing `--isolate` on interactive producers. Allowlist-gated only.

---

## Interplay With Other Skills

- **Producer skills** (`ak:plan`, `ak:code`, `ak:brainstorm`, `ak:delegate`) — untouched by this skill. They never need to know they are being wrapped.
- **`ak:code-review`** — runs _after_ `ak:validate` passes, when the user wants polish review. Validator catches "wrong"; code-review catches "could be better."
- **`ak:code-refactor` / `ak:code-simplify`** — same as code-review: post-validate quality work, not part of this loop.
- **`unit-testing`** (sub-skill) — already triggered inside `ak:code` when `hasUnitTests` and `useUnitTests` are both true. Validator does not re-trigger it; it just runs the test script and reads the result.
