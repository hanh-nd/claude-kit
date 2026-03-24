---
name: code-review-pipeline
description: Strict state machine enforcing Jira-alignment, scope drift detection, and a 2-pass review structure before final reporting.
version: 2.0.0
---

# 🛤️ Workflow: Code Review Pipeline SOP v2

You MUST execute the review process strictly sequentially. Do not generate the final report until all phases are complete.

## Phase 1: Context Ingestion & Scope Drift Detection

- **Objective:** Understand _what_ is being built and _why_, before looking at _how_.
- **Action:** 1. Read the Jira ticket description or PR summary provided in the context. 2. Run the `diff` to analyze the files changed.
- **Decision Gate:** - Compare the actual code changes against the Jira ticket intent.
  - Identify **Scope Drift**: Are there new features, unrelated refactors, or massive architecture changes not requested in the ticket?
  - Identify **Missing Requirements**: Did they skip a core acceptance criteria from the ticket?
- **Persistence:** Store the "Scope Check" result in memory for the final report.

## Phase 2: Macro Review (Design & Complexity)

- **Objective:** Evaluate the forest before the trees.
- **Action:** Analyze the overall architectural choices.
  - Does this PR introduce new complexity that isn't justified?
  - Are models/services interacting correctly?
  - Is there over-engineering? (e.g., adding 3 new abstractions for a simple CRUD task).
- **Rule:** If the design is fundamentally flawed, record this as a **BLOCKER** and proceed to Phase 3 with a strict lens.

## Phase 3: Micro Review - Pass 1 (CRITICAL)

- **Objective:** Hunt for system-breaking bugs.
- **Action:** Scan the diff specifically for Pass 1 Checklist items:
  - **SQL & Data Safety:** Direct DB writes bypassing validations, SQL string interpolation.
  - **Race Conditions:** Check-then-set patterns, lack of atomic operations.
  - **LLM/Trust Boundaries:** Unvalidated output from LLMs or external APIs being executed or persisted.
  - **Enum/Completeness:** Did they add a new status but forget to handle it in existing switch statements?
- **Classification:** Every finding here must be logged as a **BLOCKER**.

## Phase 4: Micro Review - Pass 2 (INFORMATIONAL)

- **Objective:** Enforce codebase health, readability, and test parity.
- **Action:** Scan the diff for Pass 2 Checklist items:
  - **Test Gaps:** New logic paths without corresponding unit/integration tests.
  - **Side Effects:** Hidden state mutations in seemingly pure functions.
  - **Dead Code:** Unused variables, lingering `console.log` or debug statements.
  - **Clean Code:** Magic numbers, poor naming conventions, bloated controllers.
- **Classification:** Findings here are logged as **CONCERNS** (if tests are missing) or **NITPICKS** (for style/naming).

## Phase 5: Report Generation & Handoff

- **Objective:** Deliver the final actionable verdict to the developer.
- **Action:** Synthesize findings from Phase 1 to 4.
- **Constraint:** Format the output STRICTLY matching the `Final PR Review Report` state defined in the `code-reviewer` persona.
  - If there is at least one BLOCKER, the Verdict MUST be `REQUEST CHANGES`.
  - If there are only NITPICKS, the Verdict can be `APPROVE` with comments.
- **Handoff:** Conclude the review. No further code generation is allowed unless the user explicitly requests a code patch for a specific finding.
