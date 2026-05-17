# Agent Kit MCP Server

This package contains the Agent Kit MCP server used by the Agent Kit plugin manifests.

## Install

```bash
npm install -g @hanhnd/agent-kit
```

Or run it without a global install:

```bash
npx -y @hanhnd/agent-kit@latest
```

## MCP Configuration

Claude Code and Codex plugin manifests already use this package:

```json
{
  "kit-agents": {
    "command": "npx",
    "args": ["-y", "@hanhnd/agent-kit@latest"]
  }
}
```

## Development

From the repository root:

```bash
npm install
npm run build --workspace @hanhnd/agent-kit
```

From this directory:

```bash
npm run build
```

The source lives in `src/` and the published binary is `dist/kit-server.js`.

## Publishing

Publish the MCP package from the repository root:

```bash
npm run publish:mcp
```

That script runs `npm publish --workspace @hanhnd/agent-kit`, so npm publishes this `mcp/` package instead of the plugin bundle under `plugins/agent-kit`.
