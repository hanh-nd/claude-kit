# agent-kit

**Super Engineer** — a team of specialized AI agents for software development. Brainstorm ideas, plan implementations, write code, and review PRs using a structured multi-agent workflow powered by Claude Code.

## What It Does

agent-kit gives Claude Code a team of four specialized agents:

| Agent            | Role                                             |
| ---------------- | ------------------------------------------------ |
| **Brainstormer** | Trade-off analysis, system design, YAGNI defense |
| **Planner**      | Detailed, actionable implementation blueprints   |
| **Coder**        | Clean, production-ready code                     |
| **Reviewer**     | Deep technical audits and requirement alignment  |

### Commands

| Command                       | Description                             |
| ----------------------------- | --------------------------------------- |
| `/ak:brainstorm [idea]`       | Strategic architectural analysis        |
| `/ak:plan [file or idea]`     | Create an implementation blueprint      |
| `/ak:code [file or task]`     | Implement from a plan                   |
| `/ak:review-pr [PR URL]`      | Review a pull request                   |
| `/ak:review-changes`          | Review uncommitted local changes        |
| `/ak:ticket [ID]`             | Work from a Jira/GitHub ticket          |
| `/ak:do [task]`               | Route a task through the full pipeline  |
| `/ak:git`                     | Git commit, branch, and PR workflow     |
| `/ak:workflow`                | Resume or check workflow state          |
| `/ak:kit-setup`               | Configure integrations (GitHub, Jira)   |
| `/ak:delegate <agent> <task>` | Delegate a task to Gemini or Claude CLI |

---

## Installation

### Option 1: Install via GitHub (Recommended)

> Requires Claude Code with plugin support.

```bash
claude plugin install hanh-nd/agent-kit
```

This fetches the plugin from GitHub, installs it to Claude Code's plugin cache, and registers the MCP server automatically using `${CLAUDE_PLUGIN_ROOT}` — no manual path configuration needed.

After installation, the commands are available immediately in any Claude Code session:

```
/ak:brainstorm redesign the auth system
/ak:plan implement user notifications
```

To update to the latest version:

```bash
claude plugin update agent-kit
```

To uninstall:

```bash
claude plugin uninstall agent-kit
```

---

### Option 2: Clone and Install Locally

Use this if you want to modify the plugin or develop against it.

**1. Clone the repository**

```bash
git clone https://github.com/hanh-nd/agent-kit.git
cd agent-kit
```

**2. Install dependencies and build**

```bash
npm install
npm run build
```

This compiles the TypeScript MCP server into a self-contained bundle at `dist/kit-server.js`.

**3. Register the MCP server with Claude Code**

Add the following to your Claude Code user settings (`~/.claude/settings.json`):

```json
{
  "mcpServers": {
    "kit-agents": {
      "command": "node",
      "args": ["/absolute/path/to/agent-kit/dist/kit-server.js"]
    }
  }
}
```

Replace `/absolute/path/to/agent-kit` with the actual path where you cloned the repo.

**4. Load the plugin commands**

Add the plugin directory to Claude Code so it picks up the `commands/` and `CLAUDE.md`:

```bash
claude plugin marketplace add /absolute/path/to/agent-kit
claude plugin install agent-kit
```

**5. Verify installation**

Start a Claude Code session and run:

```
/ak:brainstorm test idea
```

You should see the Brainstormer agent activate and begin the interactive session.

---

## Development

```bash
# Build once
npm run build

# Watch mode (rebuilds on file changes)
npm run dev
```

The MCP server source is in `src/`. Agent personas are in `agents/`. Skill modules are in `skills/`.

---

## Requirements

- Node.js 18+
- Claude Code (latest)
