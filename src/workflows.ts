import dedent from 'dedent';

import { Workflow, Workflows } from './tools/config.js';

const CODE_WORKFLOW: Workflow = {
  initial: 'PLAN_ANALYSIS',
  agent: 'coder',
  states: {
    PLAN_ANALYSIS: {
      instructions: dedent`
        1. **Mandate:** You must understand the target and the constraints.
        2. **Action:** Read the 'Target Input' (Implementation Plan). If the input is a file path, use 'read_file' to ingest its content.
      `,
      next: 'EXECUTION_AND_TESTING',
      skills: [],
    },
    EXECUTION_AND_TESTING: {
      instructions: dedent`
        1. **Mandate:** You must now implement the changes defined in the 'Implementation Plan'.
        2. **Execution:**
          - For each file listed in the plan, use 'read_file' to get the current content.
          - Apply the necessary modifications (additions, deletions, replacements).
          - Use 'write_file' to save the updated content.
        3. **Constraint:** Do not invent new files or change file paths unless explicitly required by the plan.
        4. **Testing:**
          - Decide whether to create unit tests based on '.claude-kit/stats.json' (hasUnitTests).
          - If hasUnitTests is true, create or update '.test' or '.spec' files for the modified logic, covering primary paths and edge cases.
      `,
      next: 'VALIDATION_AND_HANDOFF',
      skills: ['coding-common'],
    },
    VALIDATION_AND_HANDOFF: {
      instructions: dedent`
        1. **Self-Check:** Review the generated code for syntax errors, missing imports, or logic gaps.
          - You MUST rely on the project's standard task runners with auto-fix priority (e.g., 'npm run lint', 'yarn test', 'make lint').
          - FORBIDDEN: DO NOT attempt to guess or directly invoke underlying binary tools (like eslint, prettier, gulp, webpack, etc.).
          - FORBIDDEN: DO NOT reverse-engineer or inspect build configuration files (e.g., webpack.config, gulpfile, settings.json) to understand how the project compiles.
        2. **Synthesis:** Confirm if the Plan is 100% complete or if certain parts were blocked.
        3. **Formatting:** Structure the entire output strictly according to the 'Output Format'.
        4. **Persistence:** If required, save modified files or provide instructions for the user to apply the diff.
      `,
      next: null,
      skills: [],
    },
  },
};

const BRAINSTORM_WORKFLOW: Workflow = {
  initial: 'CONTEXT_INGESTION',
  agent: 'brainstormer',
  states: {
    CONTEXT_INGESTION: {
      instructions: dedent`
        1. **Objective:** Understand the "Why" and the "Status Quo".
        2. **Action:** Read provided context, previous files, or user prompts. Output **State 1**.
        3. **Questions to ask:**
          - What is the specific pain point? (Desperate Specificity)
          - What happens if we do nothing? (Status Quo)
          - Is there existing code/infrastructure we can leverage?
        4. **Gate:** Do not proceed to the next phase until the user clearly defines the core problem and agrees on the premise.
      `,
      next: 'EXPANSION_VS_MINIMUM',
      skills: [],
    },
    EXPANSION_VS_MINIMUM: {
      instructions: dedent`
        1. **Objective:** Stretch the idea to its maximum potential, then compress it to its most actionable form.
        2. **Action:** Output **State 1**. Present the "10-Star Vision" (Scope Expansion) alongside the "Narrowest Wedge" (Scope Reduction).
        3. **Questions to ask:**
          - Do we build the Minimum Viable version for speed, or do we invest in the 10x Architecture now?
          - What is the "Delight factor" (What makes the user say "whoa")?
        4. **Gate:** The user MUST make a decision on the scope mode (Expansion, Selective, or Minimum Wedge). Lock the scope.
      `,
      next: 'ARCH_ALTERNATIVES',
      skills: [],
    },
    ARCH_ALTERNATIVES: {
      instructions: dedent`
        1. **Objective:** Propose concrete ways to build the locked scope.
        2. **Action:** Present exactly 2 to 3 distinct implementation approaches using the 'AskUserQuestion' format.
          - *Approach A (Minimal):* Quickest time-to-market, leverages existing tools heavily.
          - *Approach B (Ideal):* Scalable, robust, "boring by default" technology.
          - *Approach C (Creative):* A lateral thinking approach (if applicable).
        3. **Gate:** User must explicitly choose one approach.
      `,
      next: 'BOUNDARIES_MAPPING',
      skills: [],
    },
    BOUNDARIES_MAPPING: {
      instructions: dedent`
        1. **Objective:** Map the shadow paths. Ideas are easy; handling failures is hard.
        2. **Action:** Analyze the chosen approach. What happens on 'nil'? What happens on 'timeout'? What happens on 'empty state'? What features are tempting but dangerous to include right now?
        3. **Output:** Define the strict "NOT in scope" list.
      `,
      next: 'HANDOFF',
      skills: [],
    },
    HANDOFF: {
      instructions: dedent`
        1. **Objective:** Consolidate all decisions into a single source of truth for engineering.
        2. **Action:** Transition to **State 2: Engineer-Ready PRD & HLD**.
        3. **Constraint:** Ensure the document is brutally clear. The ASCII diagram must exist. The Failure Modes table must be populated based on the previous phase.
        4. **Persistence:** Save the finalized decision, including the ASCII diagram and reasoning, to '.claude-kit/handoffs/brainstorms/brainstorm-[timestamp]-[slug].md'.
        5. **Handoff:** Request explicit user approval ("Approve") before ending the pipeline.
      `,
      next: null,
      skills: [],
    },
  },
};

const REVIEW_WORKFLOW: Workflow = {
  initial: 'CONTEXT_DRIFT',
  agent: 'reviewer',
  states: {
    CONTEXT_DRIFT: {
      instructions: dedent`
        1. **Objective:** Understand *what* is being built and *why*, before looking at *how*.
        2. **Action:** Read the Jira ticket description or PR summary provided in the context. Run the 'diff' to analyze the files changed.
        3. **Decision Gate:**
          - Compare the actual code changes against the Jira ticket intent.
          - Identify **Scope Drift**: Are there new features, unrelated refactors, or massive architecture changes not requested in the ticket?
          - Identify **Missing Requirements**: Did they skip a core acceptance criteria from the ticket?
        4. **Persistence:** Store the "Scope Check" result in memory for the final report.
      `,
      next: 'MACRO_REVIEW',
      skills: [],
    },
    MACRO_REVIEW: {
      instructions: dedent`
        1. **Objective:** Evaluate the forest before the trees.
        2. **Action:** Analyze the overall architectural choices.
          - Does this PR introduce new complexity that isn't justified?
          - Are models/services interacting correctly?
          - Is there over-engineering?
        3. **Rule:** If the design is fundamentally flawed, record this as a **BLOCKER** and proceed to the next phase with a strict lens.
      `,
      next: 'MICRO_BLOCKERS',
      skills: [],
    },
    MICRO_BLOCKERS: {
      instructions: dedent`
        1. **Objective:** Hunt for system-breaking bugs.
        2. **Action:** Scan the diff specifically for:
          - **SQL & Data Safety**: Direct DB writes bypassing validations, SQL string interpolation.
          - **Race Conditions**: Check-then-set patterns, lack of atomic operations.
          - **LLM/Trust Boundaries**: Unvalidated output from LLMs or external APIs being executed or persisted.
          - **Enum/Completeness**: Did they add a new status but forget to handle it in existing switch statements?
        3. **Classification:** Every finding here must be logged as a **BLOCKER**.
      `,
      next: 'MICRO_NITPICKS',
      skills: [],
    },
    MICRO_NITPICKS: {
      instructions: dedent`
        1. **Objective:** Enforce codebase health, readability, and test parity.
        2. **Action:** Scan the diff for:
          - **Test Gaps**: New logic paths without corresponding unit/integration tests.
          - **Side Effects**: Hidden state mutations in seemingly pure functions.
          - **Dead Code**: Unused variables, lingering 'console.log' or debug statements.
          - **Clean Code**: Magic numbers, poor naming conventions, bloated controllers.
        3. **Classification:** Findings here are logged as **CONCERNS** (if tests are missing) or **NITPICKS** (for style/naming).
      `,
      next: 'HANDOFF',
      skills: [],
    },
    HANDOFF: {
      instructions: dedent`
        1. **Objective:** Deliver the final actionable verdict to the developer.
        2. **Action:** Synthesize findings from previous phases.
        3. **Constraint:** Format the output STRICTLY matching the 'Final PR Review Report' state defined in the 'code-reviewer' persona.
          - If there is at least one BLOCKER, the Verdict MUST be 'REQUEST CHANGES'.
          - If there are only NITPICKS, the Verdict can be 'APPROVE' with comments.
        4. **Handoff:** Conclude the review. No further code generation is allowed unless the user explicitly requests a code patch.
      `,
      next: null,
      skills: [],
    },
  },
};

const PLAN_WORKFLOW: Workflow = {
  initial: 'CONTEXT_SCOPE',
  agent: 'planner',
  states: {
    CONTEXT_SCOPE: {
      instructions: dedent`
        1. **Objective:** Gather comprehensive context to understand the structural impact of the request.
        2. **Action:**
          - Deep-dive into arguments, attached files, and JSON schemas.
          - Identify exactly which modules will be affected (Blast Radius Assessment).
          - Answer: What already exists? Are we over-engineering? Are we adhering to the Completeness Principle?
      `,
      next: 'ENG_REVIEW',
      skills: [],
    },
    ENG_REVIEW: {
      instructions: dedent`
        1. **Action:** Evaluate 4 critical pillars:
          - **Architecture**: Dependency graphs, module boundaries.
          - **Code Quality**: DRY violations, error handling patterns.
          - **Tests**: Ensure every new branch/logic path has a test requirement.
          - **Performance**: N+1 issues, memory, caching.
        2. **Decision Gate:** Use the 'ask_user' format to resolve architectural ambiguities or scope bloat.
        3. **Constraint:** Never batch questions. Wait for the user's explicit response before proceeding.
      `,
      next: 'SKILL_ROUTING',
      skills: [],
    },
    SKILL_ROUTING: {
      instructions: dedent`
        1. **Action:** Route to specific internal domain skills if necessary (e.g., 'frontend-arch', 'backend-arch', 'security') to validate the final approach.
        2. **Action:** Map out the exact failure modes and the ASCII diagram representing the data flow.
      `,
      next: 'BLUEPRINT_GEN',
      skills: [],
    },
    BLUEPRINT_GEN: {
      instructions: dedent`
        1. **Action:** Transition to 'Intern-Proof Blueprint State'.
        2. **Constraint:** Draft the Work Breakdown Structure (WBS) strictly from the bottom up.
          - Tasks must be granular enough for a Junior Engineer.
          - Use explicit instructions like "Map the array of 'User' objects to 'UserDTO'..."
        3. **Constraint:** Ensure the **Test Plan Artifact** and **NOT in Scope** sections are strictly populated.
      `,
      next: 'PERSISTENCE_HANDOFF',
      skills: [],
    },
    PERSISTENCE_HANDOFF: {
      instructions: dedent`
        1. **Constraint Check:** Verify that NO source code has been modified during the planning session.
        2. **Action:** Save the generated blueprint to '.claude-kit/handoffs/plans/plan-[timestamp]-[feature].md'.
        3. **Handoff:** Request explicit user approval. Upon receiving "Approve", output the exact command for the coder agent: '/code @.claude-kit/handoffs/plans/[filename].md'.
      `,
      next: null,
      skills: [],
    },
  },
};

const TICKET_WORKFLOW: Workflow = {
  initial: 'DATA_ACQUISITION',
  states: {
    DATA_ACQUISITION: {
      instructions: dedent`
        1. **Input Normalization:** Extract TICKET_ID (regex [A-Z]+-[0-9]+).
        2. **Fetch Data:** Use 'kit_jira_get_ticket' with the TICKET_ID to retrieve ticket details.
        3. **Persistence:** Save raw ticket data to '.claude-kit/handoffs/tickets/{{TICKET_ID}}.md'.
      `,
      next: 'HANDOFF',
      skills: [],
    },
    HANDOFF: {
      instructions: dedent`
        1. **Objective:** Output ONLY the Report using the template.
        2. **Template:**
          ### 🎟️ Ticket Report: {{TICKET_ID}}
          - **Type:** [Classified Intent or Incomplete Requirement]
          - **Summary:** [1-sentence technical summary]
          ---
          ### 🚀 Recommended Next Action
          /plan @.claude-kit/handoffs/tickets/{{TICKET_ID}}.md
      `,
      next: null,
      skills: [],
    },
  },
};

export const WORKFLOWS: Workflows = {
  brainstorm: BRAINSTORM_WORKFLOW,
  review: REVIEW_WORKFLOW,
  plan: PLAN_WORKFLOW,
  code: CODE_WORKFLOW,
  ticket: TICKET_WORKFLOW,
};
