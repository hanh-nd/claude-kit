/**
 * Agent Delegation Tools - Invoke external agent CLIs (Gemini, Claude)
 * Supports handoff file injection and automatic fallback
 */

import { execFileSync } from 'child_process';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as fs from 'fs';
import * as path from 'path';
import { z } from 'zod';

import { getWorkspaceRoot } from '../utils.js';
import { commandExists, validatePath } from './security.js';

// Configurable timeout via environment variable (default: 5 minutes)
const AGENT_TIMEOUT = parseInt(process.env.KIT_AGENT_TIMEOUT || '300000', 10);

/**
 * Register agent delegation tools with MCP server
 */
export function registerAgentTools(server: McpServer): void {
  // ═══════════════════════════════════════════════════════════════
  // TOOL: TRIGGER AGENT
  // Delegates a task to an external agent CLI (gemini or claude).
  // Auto-detects if task is a file path and reads it as context.
  // Falls back to the alternate agent if requested one is missing.
  // ═══════════════════════════════════════════════════════════════
  server.tool(
    'kit_trigger_agent',
    'Delegate a task to an external agent CLI (gemini or claude). The task can be a direct message or a path to a handoff file (.agent-kit/handoffs/plans/plan-xyz.md). Falls back to the other agent CLI if the requested one is not installed.',
    {
      agent: z.enum(['gemini', 'claude']).describe('The agent CLI to invoke: "gemini" or "claude"'),
      task: z
        .string()
        .describe(
          'Task message or path to a handoff file (e.g., ".agent-kit/handoffs/plans/plan-xyz.md")',
        ),
    },
    async ({ agent, task }) => {
      try {
        const workspaceRoot = getWorkspaceRoot();

        // Detect if task is a file path — resolve and read if it exists
        let prompt = task;
        const resolvedTask = path.resolve(workspaceRoot, task);
        if (fs.existsSync(resolvedTask) && fs.statSync(resolvedTask).isFile()) {
          try {
            validatePath(task, workspaceRoot);
            prompt = fs.readFileSync(resolvedTask, 'utf-8');
          } catch (err) {
            return {
              content: [{ type: 'text' as const, text: `Error reading task file: ${err}` }],
            };
          }
        }

        // Determine which agent to use — fallback if requested not available
        let usedAgent = agent;
        let fallbackReason: string | undefined;

        if (!commandExists(agent)) {
          const fallback = agent === 'gemini' ? 'claude' : 'gemini';
          if (commandExists(fallback)) {
            usedAgent = fallback as 'gemini' | 'claude';
            fallbackReason = `${agent} CLI not installed, fell back to ${fallback}`;
          } else {
            const installHint =
              agent === 'gemini'
                ? 'Install Gemini CLI: https://github.com/google-gemini/gemini-cli'
                : 'Install Claude CLI: npm install -g @anthropic-ai/claude-code';
            return {
              content: [
                {
                  type: 'text' as const,
                  text: JSON.stringify(
                    {
                      agent,
                      status: 'error',
                      output: '',
                      error: `Neither ${agent} nor the fallback agent CLI is installed. ${installHint}`,
                    },
                    null,
                    2,
                  ),
                },
              ],
            };
          }
        }

        // Execute the agent CLI with the prompt
        const output = execFileSync(usedAgent, ['-p', prompt], {
          encoding: 'utf8',
          timeout: AGENT_TIMEOUT,
          maxBuffer: 10 * 1024 * 1024, // 10MB
          cwd: workspaceRoot,
        });

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  agent: usedAgent,
                  status: fallbackReason ? 'fallback' : 'success',
                  output,
                  ...(fallbackReason && { fallback_reason: fallbackReason }),
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  agent,
                  status: 'error',
                  output: '',
                  error: msg,
                },
                null,
                2,
              ),
            },
          ],
        };
      }
    },
  );
}
