---
name: brainstorm-pipeline
description: Strict, multi-phase state machine that guides the user from raw idea to a hyper-specific, engineer-ready requirements document.
version: 2.0.0
---

# 🛤️ Workflow: Brainstorm Pipeline SOP

You MUST execute this brainstorming process strictly sequentially. Do not rush to solutions before understanding the problem and exploring the boundaries.

## Phase 1: Context Ingestion & Premise Challenge

- **Objective:** Understand the "Why" and the "Status Quo".
- **Action:** Read provided context, previous files, or user prompts. Output **State 1**.
- **Questions to ask:**
  1. What is the specific pain point? (Desperate Specificity)
  2. What happens if we do nothing? (Status Quo)
  3. Is there existing code/infrastructure we can leverage?
- **Gate:** Do not proceed to Phase 2 until the user clearly defines the core problem and agrees on the premise.

## Phase 2: The 10x Expansion vs. Minimum Wedge Drill

- **Objective:** Stretch the idea to its maximum potential, then compress it to its most actionable form.
- **Action:** Output **State 1**. Present the "10-Star Vision" (Scope Expansion) alongside the "Narrowest Wedge" (Scope Reduction).
- **Questions to ask:**
  1. Do we build the Minimum Viable version for speed, or do we invest in the 10x Architecture now?
  2. What is the "Delight factor" (What makes the user say "whoa")?
- **Gate:** The user MUST make a decision on the scope mode (Expansion, Selective, or Minimum Wedge). Lock the scope.

## Phase 3: Architectural Alternatives Generation

- **Objective:** Propose concrete ways to build the locked scope.
- **Action:** Present exactly 2 to 3 distinct implementation approaches using the `AskUserQuestion` format.
  - _Approach A (Minimal):_ Quickest time-to-market, leverages existing tools heavily.
  - _Approach B (Ideal):_ Scalable, robust, "boring by default" technology.
  - _Approach C (Creative):_ A lateral thinking approach (if applicable).
- **Gate:** User must explicitly choose one approach.

## Phase 4: Paranoia & Boundaries Mapping

- **Objective:** Map the shadow paths. Ideas are easy; handling failures is hard.
- **Action:** Analyze the chosen approach. What happens on `nil`? What happens on `timeout`? What happens on `empty state`? What features are tempting but dangerous to include right now?
- **Output:** Define the strict "NOT in scope" list.

## Phase 5: Handoff & Requirement Generation

- **Objective:** Consolidate all decisions into a single source of truth for engineering.
- **Action:** Transition to **State 2: Engineer-Ready PRD & HLD**.
- **Constraint:** Ensure the document is brutally clear. The ASCII diagram must exist. The Failure Modes table must be populated based on Phase 4.
- **Persistence:** Save the finalized decision, including the ASCII diagram and reasoning, to `.agent-kit/handoffs/brainstorms/brainstorm-[timestamp]-[slug].md`.
- **Handoff:** Request explicit user approval ("Approve") before ending the pipeline. This output will serve as the perfect input for `/plan` or a `planner` agent.
