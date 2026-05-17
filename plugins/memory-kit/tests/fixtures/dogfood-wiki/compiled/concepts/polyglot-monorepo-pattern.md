# Polyglot Monorepo Pattern

> Last updated: 2026-04-27 | Seen in: 1 features

## What It Is

An architectural style where multiple independent projects, potentially written in different programming languages, are housed in a single repository and organized within isolated directories (e.g., `plugins/`).

## Why We Use It

Enables a unified developer experience and version control for a suite of related but technically diverse tools (like `agent-kit` in TS and `learning-kit` in Python). It avoids repo-per-tool sprawl while maintaining strict boundaries between different language ecosystems.

## Key Decisions

- **Registry Pattern**: Root-level `.claude-plugin/mcp.json` or equivalent acts as the discovery mechanism for the different tools. [[registry-pattern]]
- **Isolated Workspaces**: All plugin code (src, skills, package.json) resides in self-contained subdirectories (e.g., `plugins/{name}/`).
- **Independent Build/Run**: Each plugin is self-contained and builds itself to avoid a complex unified cross-language build system.

## Where Applied

- **Plugin Marketplace Architecture**: Used to house the agent-kit TS core and auxiliary plugins under a unified repository structure. [[polyglot-marketplace-monorepo]]

## Events

- 2026-04-18 — architectural — Established the polyglot monorepo structure for the plugin marketplace. — [[polyglot-marketplace-monorepo]]

## Contradictions / Open Questions

- **Shared Logic**: How to handle cross-language shared utilities or CI/CD logic without violating the isolation principle.
