# Agent-Kit

**Super Engineer** — a team of specialized AI agents for software development. Brainstorm ideas, plan implementations, write code, and review PRs using a structured multi-agent workflow.

## What It Does

### Commands

| Command                           | Description                                                          |
| --------------------------------- | -------------------------------------------------------------------- |
| `/brainstorm [idea]`           | Strategic architectural analysis                                     |
| `/clarify <file or task>`      | Clarify requirements                                                 |
| `/plan [file or idea]`         | Create an implementation blueprint                                   |
| `/code [file or task]`         | Implement from a plan                                                |
| `/code-simplify`               | Simplify modified code for readability                               |
| `/code-refactor`               | Refactor modified code for readability                               |
| `/validate [artifact]`         | Validate artifacts against expectations (or append `with /validate`) |
| `/research [topic]`            | Research a topic                                                     |
| `/review-pr [PR URL]`          | Review a pull request                                                |
| `/review`                      | Review uncommitted local changes                                     |
| `/debate [subject]`            | Run adversarial debate (Gilfoyle vs Dinesh vs Judge)                 |
| `/ticket [ID]`                 | Fetch a Jira ticket and plan from it                                 |
| `/git`                         | Git commit, branch, and PR workflow                                  |
| `/init`                        | Create the project overview file                                     |
| `/orchestrate [file or idea]`  | Orchestrate agents to solve problems span across multiple projects   |
| `/delegate <agent> <task>`     | Delegate a task to Gemini, Claude, or Codex CLI                      |
| `/wiki [compile\|query\|lint]` | Maintain a persistent, compounding project knowledge wiki            |

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

```bash
claude plugin marketplace add https://github.com/hanh-nd/agent-kit
claude plugin install agent-kit
```

The plugin fetches from GitHub, registers the MCP server automatically, and makes all commands available immediately.

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

```bash
claude plugin marketplace add /absolute/path/to/agent-kit
claude plugin install agent-kit
```

This registers the MCP server automatically (pointing to your local build). Do **not** manually add a `kit-agents` entry to `settings.json` — the plugin handles that.

**3. Add credentials** to `~/.claude/credentials`:

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

### Option 3: Install User-Wide for Codex

Use this if you want Agent Kit available in every Codex project.

**1. Clone and build**

```bash
git clone https://github.com/hanh-nd/agent-kit.git
cd agent-kit
npm install
npm run build
```

**2. Register the local marketplace**

```bash
codex plugin marketplace add /absolute/path/to/agent-kit
```

Codex reads the repo marketplace at `.agents/plugins/marketplace.json`; that marketplace points to `plugins/agent-kit/.codex`, which is the Codex-only plugin root and contains `.codex-plugin/plugin.json`, skills, hooks, and MCP config.

**3. Enable hooks**

Add this to `~/.codex/config.toml`:

```toml
[features]
hooks = true
```

Restart Codex, open the plugin directory, choose the Agent Kit marketplace, and install `agent-kit`.

**4. Verify**

Ask Codex to use Agent Kit, for example: `Use Agent Kit to brainstorm a test idea.`

---

### Option 4: Install as Gemini Extension (Optional)

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

The MCP server source is in `src/`. Agent personas are in `agents/`. Skill modules are in `skills/`.

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
