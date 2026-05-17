# Agent-Kit Core Architecture

> Last updated: 2026-05-01 | Sources: 2 | Status: active

## Summary

The foundational MCP server and modular tool registration layer for agent-kit. It defines the core loop of tool execution, security enforcement, and external agent orchestration.

## Lifecycle

complete

## Key Decisions

- **Modular Tool Registration:** Tools are logically grouped into `core`, `agent`, and `integration` modules, registered in `kit-server.ts`. This separation allows for cleaner maintenance and independent scaling of tool sets.
- **Stateless MCP Server:** Built using `@modelcontextprotocol/sdk`, the server provides a standard, stateless interface for AI agents to interact with the local system and external APIs.
- **Path-Level Security:** Centralized in `src/tools/security.ts`, every tool that interacts with the filesystem is wrapped in mandatory path validation (`validatePath`) and forbidden pattern checking.
- **Sanitized Delegation:** External agent delegation (`kit_trigger_agent`) in `src/tools/agent.ts` uses environment variable filtering (`SAFE_ENV_VARS`) and output sanitization to prevent sensitive credential leakage.
- **Rich Context Parsing:** Includes robust Jira ADF to Markdown conversion (`src/utils/parser.ts`), ensuring complex structured data from Atlassian is readable and actionable for LLMs.
- **Handoff Persistence:** Implements a unified handoff system (`kit_save_handoff` in `src/tools/core.ts`) to preserve task context (brainstorms, plans, tickets) across independent tool calls and agent sessions.

## Directory Mapping

- `src/kit-server.ts`: Server entry point and stdio transport setup.
- `src/tools/core.ts`: Project info and handoff persistence tools.
- `src/tools/agent.ts`: Orchestration of external agents (Gemini/Claude CLI).
- `src/tools/integration.ts`: Jira and Bitbucket PR tool implementations.
- `src/tools/security.ts`: Path-level security and validation utilities.
- `src/tools/config.ts`: Configuration constants, forbidden patterns, and environment allowlists.
- `src/utils/parser.ts`: Jira ADF to Markdown and text parsing utilities.
- `src/utils/utils.ts`: Workspace root resolution and common utility functions.

## Edge Cases & Risks

- **Security Sync:** Forbidden patterns in `config.ts` must be manually kept in sync with those in `hooks/constants.js`.
- **Statelessness:** Since the MCP server is stateless, all cross-turn context must be explicitly persisted via the handoff system or the project wiki.

## Related

- [[security-hardening]] — Implementation of the security layer.
- [[credential-manager-refactor]] — Centralized credential resolution in utils.
- [[llm-wiki]] — The system that persists project-level knowledge.
- [[fail-open-pattern]] — Core infrastructure design principle for resilience.
- [[jira-adf-to-markdown]] — The logic for rich description parsing.
- [[skill-vs-subagent-decision]] — The framework for deciding between skills and subagents.

## Events

- 2026-05-01 — research — Analyzed skill architecture for subagent extraction; decided to stick with generalist agents reading skill files rather than creating new dedicated subagent types. — [[research-extract-sub-agent]]
- 2026-04-18 — brainstorm — Initial architecture map and tool registration patterns.
