/**
 * Core Tools - Project context, handoff, and artifact management
 * Extracted from kit-server.ts for better modularity
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as fs from 'fs';
import * as path from 'path';
import { z } from 'zod';

import { getExtensionRoot, getWorkspaceRoot } from '../utils.js';
import { WORKFLOWS } from '../workflows.js';
import { Workflows } from './config.js';

/**
 * Resolve lifecycle configuration (Project > Extension)
 */
function getWorkflows(): Workflows {
  return WORKFLOWS;
}

/**
 * Register core tools with MCP server
 */
export function registrerOrchestrationTools(server: McpServer): void {
  // ═══════════════════════════════════════════════════════════════
  // TOOL: GET NEXT PHASE
  // Persists the rolling summary and returns transition instructions
  // ═══════════════════════════════════════════════════════════════
  server.tool(
    'kit_get_next_phase',
    'Persists the rolling summary and returns transition instructions. currentPhase format: "workflow:phase" (e.g., "code:ANALYSIS")',
    {
      summary: z.object({
        original_goal: z.string(),
        completed_tasks: z.array(z.string()),
        pending_tasks: z.array(z.string()),
        current_context_brief: z.string(),
      }),
      transitionTo: z
        .string()
        .optional()
        .describe('Force transition to a specific phase (e.g., "INGESTION")'),
      currentPhase: z.string().describe('The current workflow and phase (e.g., "code:ANALYSIS")'),
    },
    async ({ summary, transitionTo, currentPhase }) => {
      try {
        const [workflowId, phaseId] = currentPhase.split(':');
        if (!workflowId) {
          return {
            content: [
              {
                type: 'text' as const,
                text: '❌ Invalid currentPhase format. Use "workflowId" or "workflow:phase".',
              },
            ],
          };
        }

        const handoffDir = path.join(getWorkspaceRoot(), '.claude-kit', 'handoffs', 'active');
        const summaryPath = path.join(handoffDir, `${workflowId}-summary.md`);

        // 1. Ensure directory exists
        if (!fs.existsSync(handoffDir)) {
          fs.mkdirSync(handoffDir, { recursive: true });
        }

        // 2. Format Markdown
        const markdown = `
# 📝 Rolling Summary: ${workflowId.toUpperCase()} Workflow

## 🎯 Original Goal
${summary.original_goal}

## ✅ Completed Tasks
${summary.completed_tasks.map((t) => `- ${t}`).join('\n')}

## ⏳ Pending Tasks
${summary.pending_tasks.map((t) => `- ${t}`).join('\n')}

## 🧠 Current Context Brief
${summary.current_context_brief}

---
*Updated: ${new Date().toLocaleString()}*
`;

        // 3. Persist summary
        fs.writeFileSync(summaryPath, markdown, 'utf8');

        // 4. Resolve next state
        const workflows = getWorkflows();
        let nextPhaseId: string | null = null;

        if (workflows[workflowId]) {
          const workflow = workflows[workflowId];
          const currentState = phaseId ? workflow.states[phaseId] : null;

          // Handle bootstrap case: if phaseId is missing, fallback to initial
          if (!currentState) {
            nextPhaseId = transitionTo || workflow.initial;
          } else {
            nextPhaseId = transitionTo || currentState?.next || null;
          }

          if (nextPhaseId && !workflow.states[nextPhaseId]) {
            nextPhaseId = null;
          }
        }

        // 5. Persist machine-readable state
        const statePath = path.join(handoffDir, `${workflowId}-state.json`);
        const stateData = {
          workflowId,
          currentPhase: phaseId || 'START',
          nextPhase: nextPhaseId,
          summary,
          updatedAt: new Date().toISOString(),
        };
        fs.writeFileSync(statePath, JSON.stringify(stateData, null, 2), 'utf8');

        // 6. Return transition instructions
        if (!workflows[workflowId]) {
          return {
            content: [
              {
                type: 'text' as const,
                text: `✅ Summary persisted to ${summaryPath}.\n⚠️ Warning: Workflow "${workflowId}" not found in lifecycle.json.`,
              },
            ],
          };
        }

        const workflow = workflows[workflowId];
        if (!nextPhaseId || !workflow.states[nextPhaseId]) {
          return {
            content: [
              {
                type: 'text' as const,
                text: `✅ Summary persisted. Workflow: ${workflowId}, Phase: ${phaseId || 'START'}. No next phase defined.`,
              },
            ],
          };
        }

        const currentState = phaseId ? workflow.states[phaseId] : null;
        const nextState = workflow.states[nextPhaseId];
        const extensionRoot = getExtensionRoot();

        // Resolve agent content only if it changes
        const currentAgent = currentState?.agent || workflow.agent;
        const nextAgent = nextState.agent || workflow.agent;
        let agentContent = '[UNCHANGED]';

        if (nextAgent && nextAgent !== currentAgent) {
          const agentPath = path.join(extensionRoot, 'agents', nextAgent + '.md');
          if (fs.existsSync(agentPath)) {
            agentContent = fs.readFileSync(agentPath, 'utf8');
          } else {
            agentContent = `⚠️ Warning: Agent persona file not found at ${agentPath}`;
          }
        } else if (nextAgent && !currentState) {
          // First phase transition (bootstrap)
          const agentPath = path.join(extensionRoot, 'agents', nextAgent + '.md');
          if (fs.existsSync(agentPath)) {
            agentContent = fs.readFileSync(agentPath, 'utf8');
          }
        }

        const nextInstructions = `${nextState.instructions}\n\n**PHASE_STOP:** You MUST STOP immediately after completing the instructions above. Do not speculate, do not perform any "extra" work, and do not initiate the next phase. Summarize your progress and call 'kit_get_next_phase' to transition, or WAIT for user feedback if you need to ask_user or a gate is present.`;

        return {
          content: [
            {
              type: 'text' as const,
              text: `PHASE_TRANSITION:
Next Phase: ${workflowId}:${nextPhaseId}
Agent Content: ${agentContent}
Skills: ${JSON.stringify(nextState.skills || [])}
Instructions: ${nextInstructions}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error updating summary/transition: ${error}` }],
        };
      }
    }
  );
}
