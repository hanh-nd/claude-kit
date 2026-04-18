---
name: ak:code-refactor
description: Perform structural refactoring on a code component — question the current design, reshape signatures, remove obsolete abstractions, collapse leaky layers, and delete clearly dead code — while preserving reachable behavior. Use this skill whenever the user asks to refactor, restructure, clean up, modernize, untangle, rethink, or "make better" an existing component, module, file, directory, or diff — especially when they mention legacy code, tech debt, messy code, leaky abstractions, wrong design, or code that "needs a rethink." Use it even when the user just says "refactor this" without further detail. This skill is distinct from `code-simplifier`: `code-simplifier` works within the existing structure (extract, dedupe, rename, preserve signatures); `code-refactor` questions the structure itself (change signatures, reshape call sites, challenge the design premise). Prefer this skill whenever the refactor target might involve a wrong design choice, not just messy expression of a correct one.
---

## Core thesis

**Reachable behavior is preserved. Structure is negotiable. The design premise itself is on the table.**

This skill does not find things to clean up. It asks whether the current shape of a component is the right shape, and proposes structural changes when it isn't. Surface-level smells are treated as evidence, not as the thing to fix.

The skill's primary failure mode is **bottom-up cataloguing**: listing four symptoms, proposing four independent fixes, and missing that all four trace back to one upstream design decision. Guard against this above all else. Premise-first diagnosis is what makes this skill different from `code-simplifier`, not "being bolder."

## Relationship to code-simplifier

These skills are orthogonal, not a spectrum.

- `code-simplifier` operates **within** the current structure. Accept the design, improve the expression. Signatures preserved, call sites untouched.
- `code-refactor` operates **on** the current structure. Question the design, reshape it if wrong. Signatures negotiable, call sites reshape atomically.

A piece of code can need either, both, or neither. They do not interpolate.

If a user request is fundamentally about code expression (long method, unclear variable names, dedup within a function, style), route to `code-simplifier`. If it involves questioning whether the current decomposition is right, this skill applies.

## When to use

- "Refactor this component / module / file / directory / diff"
- "Clean up / restructure / modernize / untangle / rethink this code"
- "This signature is wrong" / "too many parameters" / "this name lies"
- "This abstraction leaks" / "why is X taking Y as a parameter"
- "Collapse these wrapper layers" / "merge these similar functions"
- "Remove the old X now that Y is done"
- User points at code and asks "is this design right?" or "what's wrong with this?"

## When NOT to use

- **Pure style / within-function dedup / extraction that preserves signatures** → use `code-simplifier`.
- **Full rewrites** → this is not a rewrite skill. Say so and stop.
- **Adding features** → refactor first (separate run), then add features.
- **Performance work** → behavior preservation is the contract; perf changes can break it.
- **Bug fixing** → if the "bug" is existing behavior, changing it violates the contract.

## Prerequisites

1. **Topological boundary.** The user specifies what to look at as paths, globs, files, or a specific diff — not as semantic domains. Legacy code bleeds across semantic lines. If the user gives a semantic boundary ("the billing domain"), translate it to paths and confirm.

2. **Awareness of test coverage.** Note whether tests exist for the boundary. Tests are the verification mechanism for behavior preservation — their presence or absence changes the confidence tier of every proposal, not whether the skill runs.

3. **codebase-dna artifact (optional).** If available, read it — it provides component context that prevents hallucinated call relationships. If not, read files directly during Phase 1.

4. **Feature-flag evidence (only if flag cleanup is in scope).** The user must explicitly state "Flag X is retired" or "fully rolled out as of [date]." Never infer flag state from config files — flag state lives in production.

## The five phases

### Phase 1 — Survey

Build a map of the component. For each key symbol in the boundary:

- What does it do (one sentence)?
- Who calls it?
- Who does it call?
- What external surfaces does it expose (exports, HTTP handlers, event listeners, schemas, reflection targets)?

Use deterministic tools where available (`rg`, `grep`, language servers, `tsc`, `ts-prune`, `knip`, `vulture`, `gopls`) to find callers — do not rely on naming conventions. If no tools are available, read files.

Phase 1's output is an internal map. Do not present it unless asked.

### Phase 2 — Diagnose (premise-first)

**Step 2.0 — Premise check. Do this before anything else.**

Ask: _what is this component trying to accomplish, and is the current shape the right way to accomplish it?_

Then, before listing individual issues, force this question: _are there multiple symptoms in this boundary that trace back to one upstream design decision?_

Examples of the pattern to look for:

- Four places duplicate the same transform → **one upstream decision** (a helper doesn't exist, or the helper is in the wrong module) causes all four.
- A class takes a dependency it never uses directly, just to pass it down → **one upstream decision** (the dependency is injected at the wrong layer) causes the leak.
- Two code paths do similar work with different patterns → **one upstream decision** (an API shape) forces the divergence.
- A parameter is threaded through four layers → **one upstream decision** (state lives in the wrong place) causes the threading.

When you find a root-cause decision, propose **reversing that decision** as the primary refactor. Individual symptom-fixes become either unnecessary or trivial consequences. Do not catalogue the symptoms separately — list them as _consequences_ of the root cause.

If no single upstream decision explains multiple symptoms, then — and only then — fall back to cataloguing individual issues.

**Step 2.1 — Individual structural issues (only after the premise check).**

Look for these categories, but only list items that survive premise-check (i.e., are not already absorbed by a root-cause refactor):

_Signature problems:_

- Name lies about what the function does
- Parameters unused at all call sites
- Parameter order confusing or inconsistent with siblings
- Boolean flag parameter that splits the function into two different behaviors
- Return type leaks implementation detail the caller shouldn't know about

_Shape problems:_

- Wrapper that adds nothing (forwards arguments with no transformation)
- Abstraction introduced for flexibility that never materialized
- Near-duplicate functions serving the same domain purpose
- A function doing two unrelated things
- Parameter threaded through layers to reach one usage site
- Dependency injected into a class that never uses it directly

_Dead code:_

- Exported symbol with zero callers (static language only)
- Branch behind a condition that cannot be true (retired feature flag, user-confirmed)
- Unused import, unreachable code after `return`/`throw`

**Do not flag:**

- "Old-looking" style — that's `code-simplifier`'s job
- Long functions without signature problems — that's `code-simplifier`'s job
- "Could use a design pattern here" — speculative abstractions are the #1 refactor failure mode
- Defensive code without evidence of unreachability

**"Nothing meaningful to refactor" is a valid diagnosis.** A refactor skill that always finds something is a vandal. If the premise is sound and no structural issues survive, say so directly in Phase 3.

### Phase 3 — Propose

The proposal's shape depends on what Phase 2 found.

**If Phase 2 found a root-cause decision:** lead with prose, not a table. Explain the upstream decision, why it's wrong, what the reversal looks like, and how the downstream symptoms become free consequences. Example shape:

> The 2nd parameter on `createPublicBooking` is the wrong abstraction. Encryption is a test-setup concern and doesn't belong in the booking service. If you push the encrypted card into the payload at the call site, three things happen for free: the duplicated transform disappears, the VCC/regular inconsistency disappears (both use the same pattern), and the `apiEverVault` constructor leak in management services disappears (the service no longer needs to build encrypted payloads internally).
>
> Proposed change: remove the 2nd parameter from `createPublicBooking`, `createChangeBooking`, `cancelBooking`, and `createHopperBooking`. Call sites pass `creditCard: { ...encryptedCard.cardToken, isEncrypted: true }` in the payload directly. Optionally, add `FinanceService.toEncryptedCardPayload(res, extra?)` as a one-liner to cover the VCC case with `chargeableAmount`.

This is reviewer voice — a senior engineer explaining the real fix, not a cataloguer producing a severity matrix.

**If Phase 2 found a bag of independent issues:** list them, each with a confidence tier. Tables are appropriate here. Example shape:

| Change                                            | Files touched            | Confidence | Why                                                 |
| ------------------------------------------------- | ------------------------ | ---------- | --------------------------------------------------- |
| Remove unused `retryCount` param from `fetchUser` | `user.ts` + 7 call sites | HIGH       | Static, tool-confirmed zero usage                   |
| Collapse `getUserData` wrapper around `fetchUser` | `user.ts` + 3 call sites | MEDIUM     | Wrapper adds no transformation                      |
| Delete `legacyAuthFallback` function              | `auth.ts`                | LOW        | Exported, dynamic language, unprovable reachability |

**Confidence tiers:**

- **HIGH**: static language + deterministic tool confirms + tests cover the surface
- **MEDIUM**: some ambiguity — dynamic language, partial test coverage, or indirection
- **LOW**: speculative abstraction change, similar-looking-function merge, possible-reflection-target deletion. Always require explicit per-item sign-off.

**For every proposal**, state concrete numbers: "7 call sites," not "several." Vagueness is how silent drift starts.

**Halt at the end of Phase 3.** Do not move to apply without user approval. The handshake mechanism is the invoker's choice — a chat message, a written plan file, a review comment — the skill just has to stop and wait.

### Phase 4 — Apply

Apply each approved change as a complete, atomic unit: the signature change and every call-site update together. Never leave the codebase in a half-refactored state between edits.

Order changes lowest-risk first. HIGH-risk changes (param removal, reorder, type change on widely-called functions) are applied one at a time, not batched.

**Tests, if they exist, are the verification mechanism.** After each atomic change, run them. If they pass, continue. If they fail, revert _that change_ and log it — do not proceed to the next change on top of a failed one, and do not attempt to "fix" the failing tests. A failing test on a supposedly behavior-preserving refactor is a signal the refactor wasn't actually behavior-preserving. Surface it, don't paper over it.

If tests don't exist, the Phase 3 plan review was the verification — and the confidence tiers should have been lower accordingly.

How commits, branches, or revert mechanics work is the invoker's concern. The skill produces correct code transitions; the execution environment (local branch, PR, staging, CI) handles persistence and rollback.

### Phase 5 — Report

Produce a terse, factual report:

- What was applied
- What was skipped and why (including reverts from failed tests)
- Anything flagged UNCERTAIN and left alone, with enough context for the user to decide manually
- Suggested follow-ups, if any (e.g., "after this refactor, `code-simplifier` could now dedupe within `processOrder`")

No self-congratulation. The report is an audit trail.

## Refactor categories

**Will do (within behavior preservation):**

- Rename when the current name lies
- Add, remove, reorder parameters; change return types (atomic call-site updates)
- Split a function doing two things into two honest functions
- Merge near-duplicate functions serving the same domain purpose
- Collapse wrappers that add nothing
- Inline single-use helpers that hurt readability
- Delete provably-dead code (static language, tool-confirmed)
- Delete likely-dead code with user-stated evidence (retired flag, etc.)
- Push state up or down the call stack to where it belongs
- Replace boolean-flag parameter with two distinct functions
- **Reverse an upstream design decision that caused multiple downstream symptoms** (this is the skill's highest-value move)

**Will not do:**

- Delete UNCERTAIN code (no _visible_ references but dynamic dispatch possible)
- Introduce speculative abstractions not demanded by 3+ concrete use cases
- Extract, dedup, rename within a function on live code — that's `code-simplifier`
- Modify tests to make them pass a refactored signature
- Change behavior on any live code path, even if current behavior seems wrong
- Touch code behind reflection, `eval`, `getattr`, `method_missing`, decorator metaprogramming, codegen
- Apply without the Phase 3 approval checkpoint

## Hard stops — require explicit per-item sign-off

Halt at Phase 3 and flag these. General "looks good" approval is insufficient.

- Public package exports
- HTTP route handlers, webhook callbacks, event listeners, message consumers
- Database schemas, migration files, ORM model fields mapped to columns
- Cross-service contracts: message schemas, event payloads, gRPC/protobuf
- Reflection targets, dynamic dispatch, codegen inputs
- Feature flags without user-provided rollout evidence
- Anything the user marks "do not touch"

## Language confidence tiers

**Static (TypeScript, Go, Rust, Kotlin, Java, Swift, C#):** dead-code and signature-refactor claims can reach HIGH when the language server confirms.

**Dynamic (JS without TS, Python, Ruby):** no symbol reachable from outside a module exceeds MEDIUM. Exported symbols default to UNCERTAIN — never deleted without the user explicitly saying "I've confirmed X is dead."

## Common pitfalls

1. **Cataloguer voice when reviewer voice is needed.** If Phase 2 found a root cause, Phase 3 must lead with prose that names the wrong decision and its reversal. Tables are for bags of independent changes, not root-cause refactors. Producing a severity matrix when the real answer is "the 2nd parameter shouldn't exist" is the exact failure this skill is designed to avoid.

2. **Speculative abstraction.** "I could extract this into a strategy pattern" → almost always wrong. Only propose new abstractions when 3+ concrete uses demand it.

3. **Pattern-matching on syntax, not semantics.** Two functions that look similar may serve different domain purposes. Merging them creates a god-function with a boolean flag.

4. **"Unused" that isn't.** A function with no static callers may be reached via DI containers, route registries, plugin loaders, reflection. UNCERTAIN, never deleted.

5. **Defensive-code removal.** A null check that "seems unnecessary" often catches a real production edge case. Require evidence of unreachability, not aesthetic judgment.

6. **Feature-flag removal from config.** Never infer state from `config.yaml` or `launchdarkly.json`. Only remove when the user explicitly states the flag is retired.

7. **Scope creep during apply.** If Phase 4 reveals a new issue not in the plan, do not silently fix it. Log it for the report and surface it for a separate run.
