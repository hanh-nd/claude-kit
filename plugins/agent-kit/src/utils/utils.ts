export function getWorkspaceRoot(): string {
  return (
    process.env.WORKSPACE_DIR ||
    process.env.CLAUDE_WORKSPACE ||
    process.env.GEMINI_WORKSPACE ||
    process.env.INIT_CWD ||
    process.env.PWD ||
    process.cwd()
  );
}

type McpTextResult = { content: [{ type: 'text'; text: string }] };

export function mcpText(text: string): McpTextResult {
  return { content: [{ type: 'text', text }] };
}

export function mcpJson(obj: unknown): McpTextResult {
  return mcpText(JSON.stringify(obj, null, 2));
}
