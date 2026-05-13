---
name: e2e-review
description: Review Playwright, Cypress, browser automation, and end-to-end test diffs with the same evidence standard as code-review, but using E2E-specific judgment around user-flow proof, selector stability, waits, isolation, diagnostics, and CI reliability.
---

# E2E Review

You review E2E automation as evidence that a ticket requirement or critical user workflow is protected. A test is not good because it automates clicks; it is good when it proves meaningful user-observable behavior while staying stable, isolated, diagnosable, and cheap enough to trust in CI.

This skill reviews the diff as code. It does not write tests and does not replace general `code-review`; it specializes the review lens for Playwright, Cypress, browser automation, visual regression, accessibility automation, and E2E test infrastructure changes.

---

## Inputs

Require the same contract as `code-review`:

1. **The diff** - changed tests, fixtures, page objects, helpers, config, CI jobs, snapshots, or app code coupled to the E2E change.
2. **The intent** - PR description, ticket requirement, bug report, commit message, or direct statement of what behavior the test should protect.
3. **Codebase access** - app routes/components/API behavior, existing test conventions, fixtures, Playwright/Cypress config, and CI setup.

If intent is missing, review technical test quality only and state that requirement proof cannot be assessed.

If codebase access is missing, state which checks degrade: route validity, app behavior alignment, fixture reuse, selector conventions, and CI integration.

---

## Execution - Five Phases

### Phase 1 - Frame the Requirement

Before checklist review, establish:

- What user behavior, ticket requirement, or bug regression should this E2E change protect?
- What does the diff actually exercise and assert?
- Do those match?

Flag **Requirement Drift** when the test automates a flow but does not prove the stated requirement, asserts an incidental implementation detail, or covers a different behavior than the ticket asks for.

Assess **Layer Fit**: E2E is justified for critical user flows, browser integration, auth/session behavior, routing, real rendering, cross-service wiring, accessibility behavior, or regressions that only appear in the browser. If the behavior can be proven more reliably at unit or small integration level, report a concern and recommend the lower layer.

### Phase 2 - Read the Test Surface

Read nearby E2E tests and shared test infrastructure before judging style:

- test runner config (`playwright.config.*`, Cypress config, browser projects, retries, traces, screenshots, video)
- fixtures, auth setup, storage state, test data factories, page objects, route mocks
- existing selector conventions and helper APIs
- CI workflow for E2E jobs, sharding, browser install/cache, artifact upload

Stop once you know local conventions and the changed test's execution path. Do not scan unrelated suites unless the changed helper/config affects them.

### Phase 3 - E2E Quality Sweep

For each category, produce a finding or a clearance with concrete evidence.

**Behavior Proof**

- Test name, actions, and assertions prove the stated user behavior.
- Assertions check observable outcomes: URL, visible text, accessible state, persisted result, network-visible consequence, or user-facing error.
- The test would fail if the requirement regressed, and would keep passing after a behavior-preserving refactor.

**Selector Stability**

- Prefer user-facing locators: role/name, label, placeholder, visible text, or stable test IDs when user-facing locators are not appropriate.
- Flag brittle selectors tied to DOM shape, CSS classes, generated IDs, nth-child, animation wrappers, or incidental copy.
- Test IDs are acceptable when they represent stable product semantics, not styling structure.

**Waits & Synchronization**

- Prefer Playwright/Cypress auto-waiting and assertion-driven waits.
- Flag hard sleeps, arbitrary timeouts, polling without a condition, or waiting for implementation internals when user-observable state is available.
- Network waits should be paired with the user action that triggers them and should not race with route registration.

**Isolation & Determinism**

- Each test can run alone, repeated, and in parallel.
- No dependency on test order, shared mutable accounts, leaked browser state, real third-party services, wall-clock time, randomness, or leftover database state unless explicitly controlled.
- Fixtures clean up after themselves or use unique data per worker/test.

**Data, Auth & Boundaries**

- Auth setup matches the behavior under test: API login/storage state is fine when login itself is not under test.
- Seeded data is minimal and expresses the scenario.
- External services are mocked or isolated unless the purpose is real integration.
- Secrets, tokens, cookies, and PII are not logged, snapshotted, or committed.

**Diagnostics**

- Failures leave enough evidence to debug: trace, screenshot, video, console/network logs, or CI artifacts when appropriate.
- Failure messages and assertions identify the broken behavior, not just "element not found."
- Visual snapshots are reviewed intentionally and avoid masking dynamic content.

**CI Economics**

- Runtime, browser matrix, retries, sharding, and artifact retention fit the value of the coverage.
- Retries are a diagnostic fallback, not a way to hide known flake.
- Quarantined or skipped tests include an owner, reason, and exit plan.

### Phase 4 - Self-Critique

Before finalizing:

1. Re-read the requirement with the test diff in hand. Did the test prove the actual acceptance criterion?
2. Check whether the first found flake risk caused you to skip behavior proof or CI impact.
3. List any E2E categories without clearances; go back and either clear them or create findings.

Tag new findings from this pass with `[self-critique]`.

### Phase 5 - Route Back When Needed

If the diff contains production code changes beyond testability seams, review those with `code-review` or explicitly state they were not covered by this E2E review.

If the problem is that the requirement is unclear, route to `clarify`. If the test strategy is missing for a larger feature, route to `plan` or `test`.

---

## Suppression List - Do Not Flag

- API-based login when login is not the behavior under test.
- Stable semantic test IDs used because accessible locators are ambiguous or absent.
- A longer timeout for genuinely slow external setup when the condition is explicit.
- Multiple assertions when they prove one user story end state.
- Browser-specific projects when the requirement is cross-browser behavior.
- Snapshot or screenshot assertions when visual output is the contract and dynamic regions are controlled.

---

## Output Format

```markdown
### E2E Review Report

**Verdict:** `APPROVE | REQUEST CHANGES | COMMENT ONLY`
**Requirement Drift:** `CLEAN | DRIFT - <brief description>`
**Layer Fit:** `E2E JUSTIFIED | LOWER-LEVEL TEST PREFERRED | UNCLEAR`

#### BLOCKERS
- **`file:line`** - [problem]
  - _Why:_ [requirement, stability, isolation, or CI risk]
  - _Fix:_ [concrete suggestion]

#### CONCERNS
- **`file:line`** - [problem] -> [fix]

#### NITPICKS
- **`file:line`** - [problem] -> [fix]

#### WHAT WENT WELL
- [specific test design choice worth keeping]

#### Coverage
- Behavior Proof: Checked - [what was traced], confirmed [result].
- Selector Stability: Checked - [what was traced], confirmed [result].
- Waits & Synchronization: Checked - [what was traced], confirmed [result].
- Isolation & Determinism: Checked - [what was traced], confirmed [result].
- Data, Auth & Boundaries: Checked - [what was traced], confirmed [result].
- Diagnostics: Checked - [what was traced], confirmed [result].
- CI Economics: Checked - [what was traced], confirmed [result].
```

**Verdict rules:**

- Any blocker that makes the test untrustworthy, non-deterministic, or unable to prove the requirement -> `REQUEST CHANGES`.
- Concerns only -> `COMMENT ONLY`, or `APPROVE` when risks are minor and the test still adds real protection.
- Nitpicks only -> `APPROVE`.

