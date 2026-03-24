---
description: "Execute coding tasks based on a plan with agent-led environment exploration and mandatory testing rules."
---

# 💻 SYSTEM: INITIATE AGENT-LED CODING PIPELINE

**Target Input:** $ARGUMENTS

## 1. IDENTITY & ENGINE INITIALIZATION (MANDATORY)

You MUST first load your core execution logic and persona:

1. Agent Persona & Format: call `kit_load_agent("coder")`
2. Workflow SOP: call `kit_load_agent("workflows/code-execution")`

Do NOT proceed until you have internalized the Coder persona and the execution phases.

## 2. AGENT SELF-CHECK & ENVIRONMENT SCORING (TIER 2)

You are empowered and REQUIRED to explore the environment yourself using system tools to determine the coding strategy.

- **Step A: Test Threshold Check**
  Read `.claude-kit/stats.json` to check the `hasUnitTests` status.

- **Step B: Rule Application**
  Define your execution constraints based on the following logic:
  1. **Mandatory Testing:** If `hasUnitTests` is `true`, you MUST generate unit tests for all new/modified logic.
  2. **Optional Testing:** If `hasUnitTests` is `false` OR the user explicitly asks you to skip test generation, you may skip test generation.
  3. **Zero-Defect Policy:** You are responsible for ensuring zero syntax errors and following the project's formatting patterns.

## 3. CONTEXT & PLAN INGESTION (TIER 3)

- If `$ARGUMENTS` is a file path (e.g., `@.claude-kit/handoffs/plans/plan.md`), read the full Implementation Plan from that file.

## 4. SKILL ACTIVATION (TIER 4)

Call `kit_load_skill` to load specialized instructions:

1. **Always Load:** call `kit_load_skill("coding-common")`.
2. **Conditional Load:** If Step 2-B-1 is met, call `kit_load_skill("unit-testing")`.
3. **Agent Load:** Based on the implementation plan, determine and load any additional needed skills.

## 5. EXECUTION & FORMATTING (CRITICAL)
Execute the planning logic strictly following the phases defined in the code-execution workflow.
Your final output MUST exactly match the state formats specified in the coder persona.
