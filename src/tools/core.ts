/**
 * Core Tools - Project context, handoff, and artifact management
 * Extracted from kit-server.ts for better modularity
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as fs from 'fs';
import * as path from 'path';
import { z } from 'zod';

import { getExtensionRoot } from '../utils.js';
import { DEFAULT_EXTENSIONS } from './config.js';

/**
 * Register core tools with MCP server
 */
export function registerCoreTools(server: McpServer): void {
  // ═══════════════════════════════════════════════════════════════
  // TOOL: GET EXTENSION INFO
  // ═══════════════════════════════════════════════════════════════
  server.tool(
    'kit_get_extension_info',
    'Get information about the claude-kit extension, including absolute paths to agents, skills, commands, and scripts',
    {},
    async () => {
      try {
        const root = getExtensionRoot();
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  extensionRoot: root,
                  agentsDir: path.join(root, 'agents'),
                  skillsDir: path.join(root, 'skills'),
                  commandsDir: path.join(root, 'commands'),
                  scriptsDir: path.join(root, 'scripts'),
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error getting extension info: ${error}` }],
        };
      }
    }
  );

  // ═══════════════════════════════════════════════════════════════
  // TOOL: GET COMMAND PROMPT
  // Returns the prompt content from a command .toml file
  // Used by /do to delegate to the correct command workflow
  // ═══════════════════════════════════════════════════════════════
  server.tool(
    'kit_get_command_prompt',
    "Get the prompt/workflow of a claude-kit command by name. Use this to understand and follow a command's workflow.",
    {
      command: z.string().describe('Command name without slash, e.g. "review-pr", "plan", "code"'),
    },
    async ({ command }) => {
      try {
        const extensionRoot = getExtensionRoot();
        const commandsDir = path.join(extensionRoot, 'commands');

        // Sanitize command name
        const safeName = command.replace(/[^a-zA-Z0-9-_]/g, '');
        const filePath = path.join(commandsDir, `${safeName}.md`);

        if (!fs.existsSync(filePath)) {
          // List available commands
          const available = fs
            .readdirSync(commandsDir)
            .filter((f) => f.endsWith('.md'))
            .map((f) => f.replace('.md', ''))
            .sort();

          return {
            content: [
              {
                type: 'text' as const,
                text: `❌ Command "${command}" not found.\n\nAvailable commands:\n${available.map((c) => `  /${c}`).join('\n')}`,
              },
            ],
          };
        }

        let content = fs.readFileSync(filePath, 'utf8');

        // Rewrite relative paths to absolute paths for agents, skills, and scripts
        // Matches: agents/*.md, skills/*/SKILL.md, scripts/*.js
        const agentsPath = path.join(extensionRoot, 'agents');
        const skillsPath = path.join(extensionRoot, 'skills');
        const scriptsPath = path.join(extensionRoot, 'scripts');

        // Replace `agents/`, `skills/`, and `scripts/` when they appear as start of path in prompt
        content = content.replace(/(`?)agents\//g, `$1${agentsPath}${path.sep}`);
        content = content.replace(/(`?)skills\//g, `$1${skillsPath}${path.sep}`);
        content = content.replace(/(`?)scripts\//g, `$1${scriptsPath}${path.sep}`);

        return {
          content: [
            {
              type: 'text' as const,
              text: content,
            },
          ],
        };
      } catch (error) {
        return { content: [{ type: 'text' as const, text: `Error reading command: ${error}` }] };
      }
    }
  );

  // ═══════════════════════════════════════════════════════════════
  // TOOL: LOAD SKILL
  // Replaces Gemini CLI's built-in activate_skill for Claude Code
  // ═══════════════════════════════════════════════════════════════
  server.tool(
    'kit_load_skill',
    'Load a skill module to activate specialized instructions. Returns the full SKILL.md content. Use instead of activate_skill.',
    {
      skillName: z
        .string()
        .describe('Skill name, e.g. "coding-common", "unit-testing", "code-review", "security", "debug"'),
    },
    async ({ skillName }) => {
      try {
        const extensionRoot = getExtensionRoot();
        const safeName = skillName.replace(/[^a-zA-Z0-9-_]/g, '');
        const skillPath = path.join(extensionRoot, 'skills', safeName, 'SKILL.md');

        if (!fs.existsSync(skillPath)) {
          const available = fs
            .readdirSync(path.join(extensionRoot, 'skills'))
            .filter((f) => fs.statSync(path.join(extensionRoot, 'skills', f)).isDirectory())
            .sort();
          return {
            content: [
              {
                type: 'text' as const,
                text: `❌ Skill "${skillName}" not found.\n\nAvailable skills:\n${available.map((s) => `  ${s}`).join('\n')}`,
              },
            ],
          };
        }

        const content = fs.readFileSync(skillPath, 'utf8');
        return { content: [{ type: 'text' as const, text: content }] };
      } catch (error) {
        return { content: [{ type: 'text' as const, text: `Error loading skill: ${error}` }] };
      }
    }
  );

  // ═══════════════════════════════════════════════════════════════
  // TOOL: LOAD AGENT
  // Replaces read_file("agents/X.md") calls in commands
  // ═══════════════════════════════════════════════════════════════
  server.tool(
    'kit_load_agent',
    'Load an agent persona or workflow pipeline markdown file. Use "coder", "planner", "brainstormer", "code-reviewer", or "workflows/code-execution" etc.',
    {
      name: z
        .string()
        .describe(
          'Agent name (e.g. "coder", "planner") or workflow path (e.g. "workflows/code-execution", "workflows/planning-pipeline")'
        ),
    },
    async ({ name }) => {
      try {
        const extensionRoot = getExtensionRoot();
        // Sanitize: allow letters, numbers, hyphens, underscores, and forward slash for workflow paths
        const safeName = name.replace(/[^a-zA-Z0-9-_/]/g, '');
        const agentPath = path.join(extensionRoot, 'agents', `${safeName}.md`);

        if (!fs.existsSync(agentPath)) {
          return {
            content: [{ type: 'text' as const, text: `❌ Agent/workflow file not found: agents/${safeName}.md` }],
          };
        }

        const content = fs.readFileSync(agentPath, 'utf8');
        return { content: [{ type: 'text' as const, text: content }] };
      } catch (error) {
        return { content: [{ type: 'text' as const, text: `Error loading agent: ${error}` }] };
      }
    }
  );
}

// Export DEFAULT_EXTENSIONS for backward compatibility
export { DEFAULT_EXTENSIONS };
