# Agent-Kit

**Super Engineer** — a team of specialized AI agents for software development. Brainstorm ideas, plan implementations, write code, and review PRs using a structured multi-agent workflow.

## What It Does

### Commands

Agent Kit ships these workflows as skills. In Claude Code, invoke them as slash commands such as `/plan ...`. In Codex or Gemini, ask the agent to use Agent Kit or the named skill, for example: `Use Agent Kit plan for this change`.

| Skill / Command                  | Description                                                        |
| -------------------------------- | ------------------------------------------------------------------ |
| `/brainstorm [idea]`             | Turn a raw idea into an engineer-ready design brief                |
| `/scenario [artifact]`           | Stress-test requirements, plans, tickets, or reviews for risks     |
| `/clarify <file or task>`        | Resolve requirement gaps using codebase evidence                   |
| `/plan [file or idea]`           | Create a detailed implementation blueprint                         |
| `/investigate [issue]`           | Trace bugs, errors, or unexpected behavior to root cause           |
| `/code [plan or report]`         | Implement from a WBS plan or investigation report                  |
| `/test [intent]`                 | Add or update focused tests after implementation intent exists     |
| `/code-review [diff or target]`  | Review diffs, PRs, or commits with evidence-backed findings        |
| `/e2e-review [diff or target]`   | Review diffs, PRs, or commits with evidence-backed findings        |
| `/review [base]`                 | Review local staged and unstaged changes                           |
| `/review-pr [PR URL]`            | Fetch PR/Jira context, check out the branch, and run code review   |
| `/code-simplify [target]`        | Improve readability without changing behavior or public shape      |
| `/code-refactor [target]`        | Analyze structural refactors and produce a refactor proposal       |
| `/validate [artifact]`           | Validate artifacts directly or by appending `with /validate`       |
| `/research [topic]`              | Produce source-backed technical research                           |
| `/debate [subject]`              | Run adversarial validation of an analysis, review, or plan         |
| `/ticket [ID]`                   | Fetch a Jira ticket and route it into the planning pipeline        |
| `/init`                          | Extract project DNA for downstream coding and planning workflows   |
| `/delegate <agent> <task>`       | Delegate to Gemini, Claude, or Codex CLI with optional handoff     |
| `/wiki [compile\|query\|lint]`   | Maintain and query the persistent project knowledge wiki           |

---

## Wiki

The wiki is a persistent, compounding knowledge base that accumulates architectural decisions, feature history, patterns, and edge cases across sessions. Unlike conversation memory (which resets), the wiki survives compaction, restarts, and new sessions — it is the long-term institutional memory of your project.

### How It's Auto-Populated (Hooks)

You don't need to run the wiki manually. Five hooks keep it fed automatically:

- **PostToolUse** — every `kit_save_handoff` call is automatically logged to `.agent-kit/wiki/raw/inbox.md`
- **PreCompact** — before `/compact` discards context, the full session transcript is exported to `.agent-kit/wiki/raw/`
- **PostCompact** — after compaction, the wiki index is re-injected as context so the very next turn has full project knowledge
- **SessionEnd** — before session is cleared, the conversation transcript is exported to `.agent-kit/wiki/raw/`
- **SessionStart (clear)** — after `/clear` resets the session, the wiki index is re-injected so the fresh session starts with full project knowledge

### Operations

| Command                          | Description                                                           |
| -------------------------------- | --------------------------------------------------------------------- |
| `/wiki` or `/wiki compile` | Ingest raw inbox + conversation exports → build/update wiki pages     |
| `/wiki query {question}`      | Search the wiki and synthesize a cited answer                         |
| `/wiki lint`                  | Health-check: broken links, orphan pages, contradictions, stale inbox |

### Directory Structure

```
.agent-kit/wiki/
├── raw/
│   ├── inbox.md          # Auto-appended by PostToolUse hook (handoff logs)
│   └── conv_*.md         # Exported by PreCompact hook (conversation transcripts)
├── compiled/
│   └── *.md              # Structured wiki pages built by /wiki compile
└── archive/
    └── *.md              # Old raw files moved here after compilation
```

---

## Installation

### Option 1: Install via GitHub (Recommended)

Claude Code:

```bash
claude plugin marketplace add https://github.com/hanh-nd/agent-kit
claude plugin install agent-kit
```

Codex:

```bash
codex plugin marketplace add https://github.com/hanh-nd/agent-kit.git
codex
/plugins # then choose agent-kit
```

For Codex hooks, add this to `~/.codex/config.toml`:

```toml
[features]
plugin_hooks = true
```

**Add credentials** to `~/.claude/credentials` (like `~/.aws/credentials`):

```bash
touch ~/.claude/credentials && chmod 600 ~/.claude/credentials
```

```ini
[default]
ATLASSIAN_CLOUD_ID = your-atlassian-cloud-id
ATLASSIAN_USER_EMAIL = you@yourcompany.com
ATLASSIAN_API_TOKEN = your-atlassian-api-token
BITBUCKET_USER_EMAIL = you@yourcompany.com
BITBUCKET_API_TOKEN = your-atlassian-api-token
BITBUCKET_DEFAULT_WORKSPACE = your-default-workspace-slug
```

To use multiple profiles, add `[work]`, `[personal]`, etc. sections and set `KIT_PROFILE=work` in your environment.

To update: `claude plugin update agent-kit`
To uninstall: `claude plugin uninstall agent-kit`

---

### Option 2: Clone and Install Locally

Use this if you want to modify the plugin or develop against it.

**1. Clone and build**

```bash
git clone https://github.com/hanh-nd/agent-kit.git
cd agent-kit
npm install
npm run build
```

**2. Register the plugin**

Claude Code:

```bash
claude plugin marketplace add /absolute/path/to/agent-kit
claude plugin install agent-kit
```

Codex:

```bash
codex plugin marketplace add /absolute/path/to/agent-kit
codex
/plugins # then choose agent-kit
```

For Codex hooks, add this to `~/.codex/config.toml`:

```toml
[features]
plugin_hooks = true
```

**3. Add credentials** to `~/.claude/credentials` for MCP integrations:

```bash
touch ~/.claude/credentials && chmod 600 ~/.claude/credentials
```

```ini
[default]
ATLASSIAN_CLOUD_ID = your-atlassian-cloud-id
ATLASSIAN_USER_EMAIL = you@yourcompany.com
ATLASSIAN_API_TOKEN = your-atlassian-api-token
BITBUCKET_USER_EMAIL = you@yourcompany.com
BITBUCKET_API_TOKEN = your-atlassian-api-token
BITBUCKET_DEFAULT_WORKSPACE = your-default-workspace-slug
```

**4. Verify**

```
/brainstorm test idea
```

---

### Option 3: Install as Gemini Extension (Optional)

If you want to reuse the commands with [Gemini CLI](https://geminicli.com) (for `/delegate` to Gemini), install it using:

```bash
git clone https://github.com/hanh-nd/agent-kit.git
cd agent-kit/plugins/agent-kit
gemini extension link .gemini
```

---

## Development

```bash
# Build once
npm run build

# Watch mode (rebuilds on file changes)
npm run dev
```

The MCP server source is in `src/`. Agent personas are in `agents/`. Canonical skill modules are in `skills/`; `npm run build:skills` generates provider-safe copies into `.claude/skills/`, `.codex/skills/`, and `.gemini/skills/`.

---

## Requirements

- Node.js 18+
- Claude Code, Codex, or Gemini CLI

---

## Integrations

Credentials are stored in `~/.claude/credentials` (INI format). Keys can also be set as environment variables — env vars take priority (useful for CI/CD).

### Jira (via Atlassian REST API)

Used by `/ticket` and `/review-pr`.

| Key                    | Description                                                                                                                              |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `ATLASSIAN_CLOUD_ID`   | Your Atlassian Cloud ID — find it at [admin.atlassian.com](https://admin.atlassian.com) under your site settings                         |
| `ATLASSIAN_USER_EMAIL` | Your Atlassian account email                                                                                                             |
| `ATLASSIAN_API_TOKEN`  | API token — create at [id.atlassian.com/manage-profile/security/api-tokens](https://id.atlassian.com/manage-profile/security/api-tokens) |

### Bitbucket Cloud (via Bitbucket REST API)

Used by `/review-pr`.

| Key                           | Description                                                                                                                              |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `BITBUCKET_USER_EMAIL`        | Your Atlassian account email (same as Jira)                                                                                              |
| `BITBUCKET_API_TOKEN`         | API token — create at [id.atlassian.com/manage-profile/security/api-tokens](https://id.atlassian.com/manage-profile/security/api-tokens) |
| `BITBUCKET_DEFAULT_WORKSPACE` | Default workspace slug — used when passing a numeric PR ID without a `workspace` param                                                   |
