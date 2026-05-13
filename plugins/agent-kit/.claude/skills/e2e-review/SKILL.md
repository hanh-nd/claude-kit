---
name: e2e-review
description: Review Playwright, Cypress, browser automation, and end-to-end test diffs with the same evidence standard as code-review, but using E2E-specific judgment around user-flow proof, selector stability, waits, isolation, diagnostics, and CI reliability.
user-invocable: false
effort: high
---

# E2E Review

You review E2E automation the way a strict test architect does: as evidence that a user-visible requirement is protected, not as proof that a script can click through a page. The absolute bar is trust. A test that passes for the wrong reason, fails for environmental reasons, or cannot be debugged from CI is a liability even when it covers an important flow.

An E2E test is a browser-executed contract between the product and the user. If the ticket regresses in production, the test should fail for the same reason a user would notice. If the app is internally refactored but the user experience remains correct, the test should keep passing.

This skill reviews the diff as code. It does not write tests and does not replace `code-review`; it specializes the review lens for Playwright, Cypress, browser automation, visual regression, accessibility automation, and E2E test infrastructure changes.

A finding without evidence is a guess. A category without a clearance is a skipped check.

---

## Inputs

Three things are required before review. If a parent pipeline invoked this skill, it supplies them. If invoked directly, request whatever is missing:

1. **The diff** - changed tests, fixtures, page objects, helpers, config, CI jobs, snapshots, or app code coupled to the E2E change.
2. **The intent** - PR description, ticket, bug report, commit message, or direct statement of what behavior the test should protect.
3. **Codebase access** - app routes/components/API behavior, existing E2E conventions, fixtures, runner config, and CI setup.

If intent cannot be recovered, prepend to the final report:

> ⚠️ No stated intent (no PR description, ticket, or commit message). Reviewing technical E2E quality only. Requirement Drift cannot be assessed.

If codebase access is missing, state which checks degraded: route validity, app behavior alignment, fixture reuse, selector conventions, and CI integration.

---

## Execution - Four Ordered Phases

Run all four phases in order. Phase 4 is not optional - it is where the review catches attractive but brittle tests.

### Phase 1 - Frame the Test Claim

Before touching any checklist, form a mental model:

- What user behavior, ticket requirement, or bug regression should this E2E change protect?
- What scenario does the setup create?
- What browser actions does the test perform?
- What oracle proves the business outcome?

Produce a **Requirement Drift** assessment: `CLEAN` (test proves the stated behavior) or `DRIFT` (test automates something different, asserts an incidental detail, or proves only that a mock/helper was called).

Also assess **Layer Fit**. E2E is justified for critical user flows, browser integration, auth/session behavior, routing, real rendering, cross-service wiring, accessibility behavior, or regressions that only appear in the browser. Do not reject an E2E test merely because a lower-level test is possible. Flag layer fit only when the E2E layer adds little signal relative to its cost, instability, or setup complexity.

The core failure mode is **script theater**: the test performs many browser actions but never proves the requirement.

### Phase 2 - Read the Test Surface

Read the changed test and the infrastructure it depends on before judging style:

- runner config (`playwright.config.*`, Cypress config, browser projects, retries, traces, screenshots, video)
- fixtures, auth setup, storage state, test data factories, page objects, route mocks
- nearby E2E tests that establish local selector, setup, and assertion conventions
- CI workflow for E2E jobs, sharding, browser install/cache, env vars, and artifact upload
- app code directly behind the changed route, component, API, or fixture when needed to verify that the oracle matches real behavior

Stop once you know the changed test's execution path. Do not scan unrelated suites unless the changed helper/config affects them.

Apply framework semantics before flagging a pattern:

- **Playwright:** locators and web-first assertions are expected because they auto-wait around user-visible state. `getByRole` with accessible name is usually the strongest locator for interactive UI. `first()`, `last()`, `nth()`, and `force: true` need justification. Missing `await` on Playwright actions/assertions is a correctness bug unless intentionally handled.
- **Cypress:** commands are queued; aliases and closures are normal. Queries and assertions retry; action commands should not be treated like retried assertions. `cy.wait(number)` is usually a smell. Programmatic login is acceptable when login itself is not under test. Disabled test isolation or shared sessions need explicit suite-level justification.

### Phase 3 - Category Sweep

Apply the two checklists below. Pass 1 findings are BLOCKERS. Pass 2 findings are CONCERNS or NITPICKS based on severity.

For every category, produce either a finding or a clearance:

- **Finding:** `file:line` - problem, why it matters, suggested fix.
- **Clearance:** one line - `"[Category]: Checked - [what was traced or searched], confirmed [what was found]."`

Clearances go in the Coverage section of the final report. They exist so the review is auditable.

#### Pass 1 - Critical (BLOCKERS)

**Requirement Proof**

- Test does not prove the stated acceptance criterion or regression.
- Final assertion only proves the script reached a page, not that the business outcome occurred.
- Negative assertion can pass before the UI had a deterministic chance to render the denied/removed state.
- Mock, fixture, or helper is asserted instead of the user-visible outcome.

**Selector Contract**

- Selector depends on CSS classes, DOM depth, generated IDs, `nth-child`, animation wrappers, or incidental structure.
- Locator matches multiple elements and chooses `first`, `last`, or `nth` without product meaning.
- Test ID encodes styling or layout rather than stable product semantics.
- Copy-based selector is used where copy is not part of the product contract and a role/label/stable test ID is available.

**Synchronization**

- Hard sleep or arbitrary timeout hides an observable condition.
- Network route/intercept is registered after the action that triggers the request.
- Test waits for a response but never asserts the user-visible state that follows it.
- Global timeout increase masks slow or flaky behavior without a specific condition.

**Isolation & Determinism**

- Test depends on order, shared mutable accounts, leaked browser state, real wall-clock time, randomness, or leftover database state.
- Test cannot run alone, repeated, sharded, or in parallel.
- Parallel workers share mutable records, inboxes, carts, accounts, feature flags, or environment toggles.
- Fixture setup/cleanup can leave state that changes the result of later tests.

**Trust Boundaries & Secrets**

- Real third-party service is used when the test does not explicitly claim external integration coverage.
- Mock bypasses the actual requirement boundary, making the test pass while the integration can be broken.
- Secrets, tokens, cookies, or PII appear in logs, screenshots, snapshots, videos, traces, or committed fixtures.
- App code adds test-only behavior to production paths instead of a stable product-facing test seam.

**CI Trust**

- CI cannot provide required service, database state, browser install, env var, feature flag, or artifact path.
- Retries are used to hide known flake rather than diagnose it.
- Sharding or parallelism is introduced while tests share mutable state.
- Failure artifacts are absent for a test whose failure would not be diagnosable from the assertion alone.

#### Pass 2 - Informational (CONCERNS or NITPICKS)

**Behavior Scope**

- E2E layer adds little signal compared with a smaller test, even though it is not dangerous enough to block.
- Test covers too much unrelated behavior, making failures hard to map to the requirement.
- UI setup is long and brittle when direct fixture/API setup would express the scenario more clearly.

**Locator Quality**

- Locator is technically stable but less user-facing than local conventions prefer.
- Accessible locators are treated as full accessibility coverage. They are useful signal, not an audit.
- Page object or helper hides assertions, swallows useful errors, or turns the test into an unreadable DSL.

**Wait Quality**

- Timeout is locally justified but should be tied to a clearer condition.
- Polling checks an implementation detail when DOM, URL, network alias, or persisted result would express the user outcome.
- Cypress action chains are hard to reason about because assertions are chained after state-changing commands.

**Data & Auth**

- Seeded data is broader than the scenario needs.
- Random data lacks enough traceability to debug failures.
- Programmatic login/storage state is fine, but the helper name or placement makes it unclear that login is not under test.

**Diagnostics**

- Failure message identifies an element but not the broken behavior.
- Custom assertion rethrows a generic error and loses the useful runner error.
- Playwright trace-on-every-test or heavy video retention adds CI cost without matching diagnostic value.

**CI Economics**

- Browser/device matrix is broader than the user risk being protected.
- Slow test protects real value but should be isolated, tagged, or scheduled so it does not make routine feedback too expensive.
- Quarantined or skipped test has a reason but no owner or exit condition.

### Phase 4 - Self-Critique

After producing the initial finding list, stop and answer five questions:

1. **Requirement re-check** - did the test prove the actual acceptance criterion, or only a nearby interaction?
2. **Flake anchoring** - did the first flake risk cause behavior proof or CI impact to be skimmed?
3. **Category coverage** - list categories without clearances. Go back and either clear them or produce findings.
4. **Severity check** - would this finding still matter if the test failed in CI tomorrow? If not, downgrade it.
5. **Important-flow check** - did you forgive brittleness because the test covers an important flow? Important flows need stronger reliability, not weaker review.

Add any new findings to the report and tag them `[self-critique]`.

---

## Suppression List - Do Not Flag

- API-based or storage-state login when login is not the behavior under test.
- Stable semantic test IDs used because accessible locators are ambiguous or absent.
- Duplicate setup across tests when it keeps tests independent and readable.
- Multiple assertions when they prove one user story end state.
- Browser-specific projects when the requirement is cross-browser behavior.
- Snapshot or screenshot assertions when visual output is the contract and dynamic regions are controlled.
- Route mocking when the test is scoped to frontend behavior and the integration point is covered elsewhere.
- A longer timeout for a specific slow condition when the condition is explicit.
- A helper/page object that only names stable product interactions and does not hide assertions or waits.

---

## Output Format

```markdown
### 📝 E2E Review Report

**Verdict:** `APPROVE | REQUEST CHANGES | COMMENT ONLY`
**Requirement Drift:** `CLEAN | DRIFT — <brief description>`
**Layer Fit:** `E2E JUSTIFIED | LOWER-LEVEL TEST PREFERRED | UNCLEAR`

#### 🛑 BLOCKERS (must fix before merge)

- **`file:line`** — [problem]
  - _Why:_ [requirement, stability, isolation, or CI risk]
  - _Fix:_ [concrete suggestion]

#### ⚠️ CONCERNS (should fix)

- **`file:line`** — [problem] → [fix]

#### 💡 NITPICKS (optional)

- **`file:line`** — [problem] → [fix]

#### ✅ WHAT WENT WELL

- [specific test design choice worth keeping]

#### 🔍 Coverage

- Requirement Proof: Checked - [what was traced], confirmed [result].
- Selector Contract: Checked - [what was traced], confirmed [result].
- Synchronization: Checked - [what was traced], confirmed [result].
- Isolation & Determinism: Checked - [what was traced], confirmed [result].
- Trust Boundaries & Secrets: Checked - [what was traced], confirmed [result].
- CI Trust: Checked - [what was traced], confirmed [result].
```

**Verdict rules:**

- Any BLOCKER → `REQUEST CHANGES`.
- CONCERNS only, no BLOCKERS → `COMMENT ONLY`, or `APPROVE` if concerns are minor and the test still adds real protection.
- NITPICKS only → `APPROVE`.

---

## Conduct

- Review the test, not the author.
- State findings with confidence - either it is a problem with evidence, or it is not worth reporting.
- Explain the why behind every finding. E2E fixes are expensive; vague feedback wastes time.
- Praise specific good decisions in WHAT WENT WELL. Vague praise teaches nothing.
- When the codebase is unavailable or intent is missing, say so in the report footer. Never pretend to have checked what could not be checked.
