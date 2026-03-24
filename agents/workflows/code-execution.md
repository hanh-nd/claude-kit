---
name: code-execution
description: Standard Operating Procedure for deterministic code implementation and quality-assured verification.
version: 1.0.0
---

# 🔄 Workflow: Code Execution Pipeline

You are executing the Code Implementation Pipeline. You MUST process the implementation request through the following phases in exact sequential order. Do NOT skip any phases.

## Phase 1: Plan Analysis & Environment Scoring

1. **Mandate:** Before writing code, you must understand the target and the constraints.
2. **Action:** Read the `Target Input` (Implementation Plan). If the input is a file path, use `read_file` to ingest its content.

## Phase 2: Targeted Context Ingestion

1. **Action:** Parse the Plan to identify all files that need to be modified or referenced.
2. **Execution:** Use your parallel file-reading capabilities to ingest the exact contents of these target files.
3. **Pattern Detection:** Use `grep` or `read_file` on 1-2 existing files in the same directory to identify local conventions (e.g., export styles, naming, indentation).

## Phase 3: Skill-Driven Implementation

1. **Skill Loading:** Load `skills/coding-common/SKILL.md` to activate Clean Code and Convention rules.
2. **Execution:** Implement changes layer by layer as specified in the Plan (e.g., Data Models -> Services -> Controllers -> UI).
3. **Constraint:** You must follow the **Actionability** rule: if you see existing code in the file that violates the loaded skills, you MUST refactor it while implementing the new logic.

## Phase 4: Quality Gate & Testing (Conditional)

1. **Action:** Decide whether to create unit tests
   - Read `.gemini-kit/stats.json` to get the `hasUnitTests`.
   - If `hasUnitTests` is `true`, load `skills/unit-testing/SKILL.md`.
   - Else, skip this phase.
2. **Bypass Rule:** If the user ask to skip test generation, skip this phase but log a "Testing Skipped" note in the summary.
3. **Implementation:**
   - Create or update `.test` or `.spec` files for the modified logic.
   - Ensure the tests cover the primary success path and at least two edge cases defined in the Plan.

## Phase 5: Validation & Synthesis

1. **Self-Check:** Review the generated code for syntax errors, missing imports, or "Logic Gaps" (references to non-existent entities).
2. **Formatting:** Structure the entire output strictly according to the `Output Format` in `agents/coder.md`.

## Phase 6: Persistence (Optional/System Specific)

1. **Action:** If required by the environment, save the modified files to disk using the `shell` tool or provide the instructions for the user to apply the diff.
2. **Summary:** Confirm if the Plan is now 100% complete or if certain parts were blocked.
