---
name: planning-pipeline
description: Strict, multi-phase state machine enforcing the Completeness Principle and interactive engineering review logic.
version: 2.0.0
---

# 🛤️ Workflow: Planning Pipeline SOP

You MUST execute the planning process strictly sequentially. Do not skip phases. Do not merge phases.

## Phase 1: Deep Context Ingestion & Step 0 Scope Challenge (MANDATORY)

- **Objective:** Gather comprehensive context to understand the structural impact of the request.
  1. **User Input & Workspace Analysis:** Deep-dive into `{{args}}`, attached files, and JSON schemas.
  2. **Historical & Design Context:** Read any existing design docs (`*design*.md`) or `TODOS.md` in the workspace.
  3. **Blast Radius Assessment:** Identify exactly which modules will be affected.
- **Action:** Transition to **State 1: Discovery & Scope Challenge State**. Answer the Step 0 questions: What already exists? Are we over-engineering? Are we adhering to the Completeness Principle?

## Phase 2: Interactive Engineering Review & Triaging

- **Action:** Based on the gaps identified in Phase 1, you must evaluate 4 critical pillars:
  1. **Architecture:** Dependency graphs, module boundaries.
  2. **Code Quality:** DRY violations, error handling patterns.
  3. **Tests:** Ensure every new branch/logic path has a test requirement.
  4. **Performance:** N+1 issues, memory, caching.
- **Decision Gate:** Use the `AskUserQuestion` format to resolve architectural ambiguities or scope bloat with the user.
  - _Constraint:_ Never batch questions. Ask them clearly.
  - _Halt:_ Wait for the user's explicit response before proceeding to Phase 3.

## Phase 3: Domain Skill Routing & Blueprint Preparation

- **Action:** Once scope and decisions are locked in Phase 2, route to specific internal domain skills if necessary (e.g., `frontend-arch`, `backend-arch`, `security`) to validate the final approach.
- **Action:** Map out the exact failure modes and the ASCII diagram representing the data flow.

## Phase 4: Intern-Proof Blueprint Generation

- **Action:** Transition to **State 2: Intern-Proof Blueprint State**.
- **Constraint:** Draft the Work Breakdown Structure (WBS) strictly from the bottom up.
  - The tasks must be granular enough for a Junior Engineer.
  - Do not use vague instructions like "Implement the logic." Use explicit instructions like "Map the array of `User` objects to `UserDTO`, filtering out items where `isActive` is false. Throw `ValidationError` if the array is empty."
  - Ensure the **Test Plan Artifact** and **NOT in Scope** sections are strictly populated.

## Phase 5: Persistence & Handoff

- **Constraint Check:** Verify that NO source code has been modified during the planning session.
- **Action:** Save the generated blueprint to `.agent-kit/handoffs/plans/plan-[timestamp]-[feature].md`.
- **Handoff:** Request explicit user approval. Upon receiving "Approve", output the exact command for the coder agent: `/code @.agent-kit/handoffs/plans/[filename].md`.
