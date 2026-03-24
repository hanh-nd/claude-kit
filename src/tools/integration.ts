/**
 * Integration Tools - GitHub, Bitbucket, Jira
 * Tools 14, 15, 16, 17, 18, 19
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import { commandExists, safeAcli, safeBkt, safeGh, sanitize } from './security.js';

// Zod schemas for GitHub CLI responses (MEDIUM 3: Validate JSON)
const PrDetailSchema = z.object({
  title: z.string(),
  body: z.string().nullable(),
  state: z.string(),
  author: z.object({ login: z.string() }),
  labels: z.array(z.object({ name: z.string() })),
  changedFiles: z.number(),
  additions: z.number(),
  deletions: z.number(),
});

// MEDIUM 2: Jira ticket schema for runtime validation
// ADF (Atlassian Document Format) can have many nested content types
// We use a more permissive schema that accepts any ADF structure
const AdfContentSchema = z
  .object({
    type: z.string().optional(),
    content: z.array(z.unknown()).optional(),
    text: z.string().optional(),
  })
  .passthrough();

const JiraFieldsSchema = z.object({
  summary: z.string(),
  status: z.object({ name: z.string() }).optional(),
  priority: z.object({ name: z.string() }).optional(),
  assignee: z.object({ displayName: z.string() }).nullable().optional(),
  reporter: z.object({ displayName: z.string() }).nullable().optional(),
  issuetype: z.object({ name: z.string() }).optional(),
  // Handle both plain string and ADF (Atlassian Document Format) structures
  description: z
    .union([
      z.string(),
      z
        .object({
          type: z.string().optional(),
          version: z.number().optional(),
          content: z.array(AdfContentSchema).optional(),
        })
        .passthrough(), // Accept any additional ADF fields
    ])
    .nullable()
    .optional(),
  labels: z.array(z.string()).optional(),
});

const JiraTicketSchema = z.object({
  errorMessages: z.array(z.string()).optional(),
  fields: JiraFieldsSchema,
});

/**
 * Extract plain text from ADF (Atlassian Document Format) content
 * Recursively walks the content tree to find text nodes
 */
function extractAdfText(adf: Record<string, unknown> | null | undefined): string {
  if (!adf || typeof adf !== 'object') return 'No description';

  const content = adf.content as Array<Record<string, unknown>> | undefined;
  if (!content || !Array.isArray(content)) return 'No description';

  const textParts: string[] = [];

  function extractText(nodes: Array<Record<string, unknown>>): void {
    for (const node of nodes) {
      if (typeof node.text === 'string') {
        textParts.push(node.text);
      }
      if (Array.isArray(node.content)) {
        extractText(node.content as Array<Record<string, unknown>>);
      }
    }
  }

  extractText(content);
  return textParts.join(' ') || 'No description';
}

// Note: IssueDetailSchema reserved for future kit_github_get_issue tool

/**
 * Helper: Get GitHub PR data
 */
async function getGitHubPr(prNumber: number, action: 'view' | 'diff' = 'view', repo?: string) {
  if (!commandExists('gh')) {
    throw new Error('❌ GitHub CLI (gh) not installed. Install with: brew install gh');
  }

  if (action === 'diff') {
    const diffArgs = ['pr', 'diff', String(prNumber)];
    if (repo) diffArgs.push('--repo', sanitize(repo));
    const diff = safeGh(diffArgs);
    return `### Diff\n\`\`\`diff\n${diff.slice(0, 5000)}${diff.length > 5000 ? '\n... (truncated)' : ''}\n\`\`\``;
  }

  const prArgs = [
    'pr',
    'view',
    String(prNumber),
    '--json',
    'title,body,state,author,labels,changedFiles,additions,deletions',
  ];

  if (repo) prArgs.push('--repo', sanitize(repo));
  const prInfo = safeGh(prArgs);

  const parseResult = PrDetailSchema.safeParse(JSON.parse(prInfo));
  if (!parseResult.success) {
    throw new Error(`❌ Failed to parse PR data: ${parseResult.error.message}`);
  }
  const pr = parseResult.data;
  const output = `## PR #${prNumber}: ${pr.title}

**State:** ${pr.state}
**Author:** ${pr.author.login}
**Labels:** ${pr.labels.map((l) => l.name).join(', ') || 'none'}
**Changes:** +${pr.additions} / -${pr.deletions} (${pr.changedFiles} files)

### Description
${pr.body || 'No description'}`;

  return output;
}

/**
 * Helper: Get Bitbucket PR data
 */
async function getBitbucketPr(
  prId: number,
  action: 'view' | 'diff' = 'view',
  workspace?: string,
  repoSlug?: string,
  context?: string
) {
  if (!commandExists('bkt')) {
    throw new Error('❌ Bitbucket CLI (bkt) not installed.');
  }

  if (action === 'diff') {
    const diffArgs = ['pr', 'diff', String(prId)];
    if (workspace) diffArgs.push('--workspace', sanitize(workspace));
    if (repoSlug) diffArgs.push('--repo', sanitize(repoSlug));
    if (context) diffArgs.push('--context', sanitize(context));

    const diff = safeBkt(diffArgs);
    return `### Diff\n\`\`\`diff\n${diff.slice(0, 5000)}${diff.length > 5000 ? '\n... (truncated)' : ''}\n\`\`\``;
  }

  const viewArgs = ['pr', 'view', String(prId), '--json'];
  if (workspace) viewArgs.push('--workspace', sanitize(workspace));
  if (repoSlug) viewArgs.push('--repo', sanitize(repoSlug));
  if (context) viewArgs.push('--context', sanitize(context));

  const prInfo = safeBkt(viewArgs);
  const pr = JSON.parse(prInfo);

  const output = `## PR #${prId} Details\n\n\`\`\`json\n${JSON.stringify(pr, null, 2)}\n\`\`\``;

  return output;
}

export function registerIntegrationTools(server: McpServer): void {
  // TOOL: DETECT PR PROVIDER
  server.tool(
    'kit_get_provider',
    'Detect git provider and PR metadata from URL or numeric ID',
    {
      input: z.string().describe('PR URL or Numeric ID'),
    },
    async ({ input }) => {
      try {
        let prId: number | undefined;
        let provider: 'github' | 'bitbucket' | undefined;
        let repo: string | undefined;
        let workspace: string | undefined;
        let repoSlug: string | undefined;

        // 1. Detect input type
        const githubMatch = input.match(/github\.com\/([^/]+\/[^/]+)\/pull\/(\d+)/);
        const bitbucketMatch = input.match(
          /bitbucket\.org\/([^/]+)\/([^/]+)\/pull-requests\/(\d+)/
        );
        const numericMatch = input.match(/^\d+$/);

        if (githubMatch) {
          provider = 'github';
          repo = githubMatch[1];
          prId = parseInt(githubMatch[2], 10);
        } else if (bitbucketMatch) {
          provider = 'bitbucket';
          workspace = bitbucketMatch[1];
          repoSlug = bitbucketMatch[2];
          prId = parseInt(bitbucketMatch[3], 10);
        } else if (numericMatch) {
          prId = parseInt(input, 10);
          // Detect provider from git remote
          const { safeGit } = await import('./security.js');
          let remoteUrl: string;
          try {
            remoteUrl = safeGit(['remote', 'get-url', 'origin']).trim();
          } catch (error) {
            throw new Error(
              `❌ Failed to identify git provider from local repository: ${error instanceof Error ? error.message : String(error)}`
            );
          }

          if (remoteUrl.includes('github.com')) {
            provider = 'github';
            const m = remoteUrl.match(/github\.com[:/]([^/]+\/[^/.]+)(\.git)?$/);
            if (m) repo = m[1];
          } else if (remoteUrl.includes('bitbucket.org')) {
            provider = 'bitbucket';
            const m = remoteUrl.match(/bitbucket\.org[:/]([^/]+)\/([^/.]+)(\.git)?$/);
            if (m) {
              workspace = m[1];
              repoSlug = m[2];
            }
          }
        }

        if (!provider || !prId) {
          throw new Error(`❌ Could not detect provider or PR ID from input: ${input}`);
        }

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({ provider, prId, repo, workspace, repoSlug }, null, 2),
            },
          ],
        };
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        return { content: [{ type: 'text' as const, text: `❌ Error: ${errorMsg}` }] };
      }
    }
  );

  // TOOL: GET PR DETAILS
  server.tool(
    'kit_get_pr',
    'Get PR details by provider and PR ID',
    {
      provider: z.enum(['github', 'bitbucket']),
      prId: z.number().int().positive().describe('PR ID or number'),
      repo: z.string().optional().describe('GitHub repo (owner/repo)'),
      workspace: z.string().optional().describe('Bitbucket workspace'),
      repoSlug: z.string().optional().describe('Bitbucket repo slug'),
    },
    async ({ provider, prId, repo, workspace, repoSlug }) => {
      try {
        let result: string;
        if (provider === 'github') {
          result = await getGitHubPr(prId, 'view', repo);
        } else {
          result = await getBitbucketPr(prId, 'view', workspace, repoSlug);
        }
        return { content: [{ type: 'text' as const, text: result }] };
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        return { content: [{ type: 'text' as const, text: `❌ Error: ${errorMsg}` }] };
      }
    }
  );

  // TOOL: GET PR DIFF
  server.tool(
    'kit_get_pr_diff',
    'Get Pull Request diff by provider and PR ID',
    {
      provider: z.enum(['github', 'bitbucket']),
      prId: z.number().int().positive().describe('PR ID or number'),
      repo: z.string().optional().describe('GitHub repo (owner/repo)'),
      workspace: z.string().optional().describe('Bitbucket workspace'),
      repoSlug: z.string().optional().describe('Bitbucket repo slug'),
    },
    async ({ provider, prId, repo, workspace, repoSlug }) => {
      try {
        let result: string;
        if (provider === 'github') {
          result = await getGitHubPr(prId, 'diff', repo);
        } else {
          result = await getBitbucketPr(prId, 'diff', workspace, repoSlug);
        }
        return { content: [{ type: 'text' as const, text: result }] };
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        return { content: [{ type: 'text' as const, text: `❌ Error: ${errorMsg}` }] };
      }
    }
  );

  // TOOL 16: JIRA GET TICKET
  server.tool(
    'kit_jira_get_ticket',
    'Get ticket details from Jira using Atlassian CLI (acli)',
    {
      ticketId: z.string().describe('Jira ticket ID (e.g., PROJ-123)'),
    },
    async ({ ticketId }) => {
      try {
        if (!commandExists('acli')) {
          return {
            content: [
              {
                type: 'text' as const,
                text: `❌ Atlassian CLI (acli) not installed.\n\nInstall it from:\nhttps://developer.atlassian.com/cloud/acli/guides/how-to-get-started/\n\nThen authenticate:\nacli jira auth login --web`,
              },
            ],
          };
        }

        const safeTicketId = ticketId.match(/^[A-Z]+-\d+$/)?.[0];
        if (!safeTicketId) {
          return {
            content: [
              {
                type: 'text' as const,
                text: `❌ Invalid ticket ID format: ${ticketId}\n\nExpected format: PROJ-123`,
              },
            ],
          };
        }

        const ticketInfo = safeAcli(['jira', 'workitem', 'view', safeTicketId, '--json']);
        const jsonData = JSON.parse(ticketInfo);
        const parseResult = JiraTicketSchema.safeParse(jsonData);
        if (!parseResult.success) {
          return {
            content: [
              {
                type: 'text' as const,
                text: `❌ Invalid Jira response format from acli: ${parseResult.error.message}`,
              },
            ],
          };
        }
        const ticket = parseResult.data;

        if (ticket.errorMessages && ticket.errorMessages.length > 0) {
          return {
            content: [
              {
                type: 'text' as const,
                text: `❌ Ticket not found: ${ticketId}\n\n${ticket.errorMessages.join('\n')}`,
              },
            ],
          };
        }

        const output = `## 🎫 ${ticketId}: ${ticket.fields.summary}

**Status:** ${ticket.fields.status?.name || 'Unknown'}
**Priority:** ${ticket.fields.priority?.name || 'None'}
**Assignee:** ${ticket.fields.assignee?.displayName || 'Unassigned'}
**Reporter:** ${ticket.fields.reporter?.displayName || 'Unknown'}
**Type:** ${ticket.fields.issuetype?.name || 'Unknown'}

### Description
${
  typeof ticket.fields.description === 'string'
    ? ticket.fields.description
    : extractAdfText(ticket.fields.description as Record<string, unknown>)
}

### Labels
${ticket.fields.labels?.join(', ') || 'None'}`;

        return { content: [{ type: 'text' as const, text: output }] };
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        return { content: [{ type: 'text' as const, text: `Error: ${errorMsg}` }] };
      }
    }
  );
}
