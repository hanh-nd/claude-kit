---
description: "Execute a specified workflow by following its state machine. Usage: /workflow <workflowId> <task>"
---

# ⚙️ SYSTEM: INITIATE GENERIC WORKFLOW STATE-MACHINE

**Target Input:** $ARGUMENTS

## 1. PARSING THE COMMAND

The input contains the workflow ID followed by the task.
1. **Identify Workflow:** The first word is the `workflowId`.
2. **Identify Task:** The rest of the input is the `task` or `objective`.

## 2. THE LIFECYCLE PROTOCOL (MANDATORY)

You MUST follow these exact steps to transition between phases:

1. **BOOTSTRAP:** Call `kit_get_next_phase(currentPhase: workflowId)` to get the initial phase transition.
2. **CONTEXT:**
   - If the task is a file path, read it.
3. **PROTOCOL FOR PHASE_TRANSITION (MANDATORY):**
   - When you receive a `PHASE_TRANSITION` payload:
     1. **Adopt Identity:** If `Agent Content` is NOT `[UNCHANGED]`, you MUST immediately adopt that persona and follow its constraints.
     2. **Parallel Skills:** Call `kit_load_skill` for ALL skills listed in the `Skills` array in a SINGLE turn using parallel tool calls.
     3. **Action:** Execute the `Instructions` provided in the payload using your newly adopted agent and skills.
4. **TRANSITION (The Loop):**
   - When the phase's objective is met, call `kit_get_next_phase` with your progress and your `currentPhase` (format: `[workflowId]:[phase]`).
   - Immediately follow the **PROTOCOL FOR PHASE_TRANSITION** upon response.
   - Continue until the transition response indicates no more phases (`Next Phase: null` or no `Next Phase` field).

## 3. ZERO-DEFECT POLICY
Every turn must produce valid, high-quality output with zero syntax errors.
