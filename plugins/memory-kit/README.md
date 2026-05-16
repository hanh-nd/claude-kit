# Memory-Kit

**Memory Kit** — persistent context and knowledge base for AI Agents. It maintains a compounding, local knowledge wiki that accumulates architectural decisions, feature history, patterns, and edge cases across sessions.

## What It Does

Unlike conversation memory (which resets), the wiki survives compaction, restarts, and new sessions — it is the long-term institutional memory of your project.

### Commands

Memory Kit ships the wiki workflows as a skill. In Claude Code, invoke it as a slash command such as `/wiki ...`. In Codex or Gemini, ask the agent to use the wiki skill, for example: `Use wiki compile`.

| Command                          | Description                                                           |
| -------------------------------- | --------------------------------------------------------------------- |
| `/wiki` or `/wiki compile` | Ingest raw inbox + conversation exports → build/update wiki pages     |
| `/wiki query {question}`      | Search the wiki and synthesize a cited answer                         |
| `/wiki lint`                  | Health-check: broken links, orphan pages, contradictions, stale inbox |

---

### How It's Auto-Populated (Hooks)

You don't need to manually feed the wiki all the time. Four hooks keep it fed and ready automatically:

- **PostToolUse (kit-wiki-inbox)** — every `kit_save_handoff` call is automatically logged to `.agent-kit/wiki/raw/inbox.md`
- **PreCompact / SessionEnd (export-history)** — before `/compact` discards context or when a session ends, the full session transcript is exported to `.agent-kit/wiki/raw/`
- **SessionStart / PostCompact (inject-wiki-instructions)** — re-injects the compiled wiki index and preferences as system context so the very next turn has full project knowledge
- **PreToolUse (wiki-inject-context)** — automatically identifies terms in a tool call and injects relevant compiled wiki pages dynamically before the tool runs

### Directory Structure

```
.agent-kit/wiki/
├── raw/
│   ├── inbox.md          # Auto-appended by PostToolUse hook (handoff logs)
│   └── conv_*.md         # Exported by PreCompact/SessionEnd hook
├── compiled/
│   └── *.md              # Structured wiki pages built by /wiki compile
└── archive/
    └── *.md              # Old raw files moved here after compilation
```

---

## Installation

Memory-Kit is distributed alongside Agent-Kit or separately.

Claude Code:

```bash
claude plugin marketplace add https://github.com/hanh-nd/agent-kit
claude plugin install memory-kit
```

Codex:

```bash
codex plugin marketplace add https://github.com/hanh-nd/agent-kit.git
codex
/plugins # then choose memory-kit
```

For Codex hooks, add this to `~/.codex/config.toml`:

```toml
[features]
plugin_hooks = true
```

---

## Development

```bash
# Build once
npm run build
```

The hooks are in `scripts/`. The wiki skill is in `skills/`; `npm run build:plugin` generates provider-safe copies into `.claude/skills/`, `.codex/skills/`, and `.gemini/skills/`.

---

## Requirements

- Node.js 18+
- Claude Code, Codex, or Gemini CLI