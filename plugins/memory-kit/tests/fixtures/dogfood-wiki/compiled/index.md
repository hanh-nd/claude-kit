# Project Wiki Index

> Last compiled: 2026-05-09 | 4 preferences | 12 concepts | 10 entities | 0 glossary

## 👤 Preferences (Always Apply)

- [Skill Authoring](preferences/index.md) — Explain the WHY behind instructions and use keyword-rich metadata | updated: 2026-05-09
- [Code Review Standards](preferences/index.md) — Never report findings from diff context alone; mandatory exploration required | updated: 2026-05-09
- [Implementation Planning](preferences/index.md) — Draft logic tasks as behavioral contracts, not pseudocode | updated: 2026-05-09
- [Infrastructure Hooks](preferences/index.md) — Infrastructure hooks must be fail-open (except security) | updated: 2026-05-09

## 🏛️ Concepts (Architectural Decisions & Patterns)

- [[llm-eval-strategy]](concepts/llm-eval-strategy.md) — Multi-tier A/B comparison using skill-creator evals and PromptFoo | updated: 2026-05-09
- [[mandatory-context-loading]](concepts/mandatory-context-loading.md) — Previously manual agent self-load requirement; now automated via unified-context-injection | updated: 2026-05-09
- [[skill-vs-subagent-decision]](concepts/skill-vs-subagent-decision.md) — 6-axis framework for skill vs. subagent; 3 MUST-subagent scenarios | updated: 2026-05-01
- [[workspace-boundary-hardening]](concepts/workspace-boundary-hardening.md) — Multi-layer enforcement of project root limits to prevent system-file access | seen in: 2 entities | updated: 2026-04-27
- [[multi-angle-protocol]](concepts/multi-angle-protocol.md) — Independent parallel sub-agents (lenses) to eliminate anchoring bias | seen in: 2 entities | updated: 2026-04-27
- [[post-save-menu-pattern]](concepts/post-save-menu-pattern.md) — Auto-save + action menu with freeform option, replacing approval gates | updated: 2026-04-27
...
- [[behavioral-contract-pattern]](concepts/behavioral-contract-pattern.md) — WBS tasks specify business rules (inputs, outputs, error cases) not pseudocode | updated: 2026-04-11

## 🧱 Entities (Codebase Nouns)

- [[unified-context-injection]](entities/unified-context-injection.md) — Consolidated hook for automated injection of instruction, preferences, index, and DNA | status: active | updated: 2026-05-09 | sources: 2
- [[llm-wiki]](entities/llm-wiki.md) — Project intelligence wiki system and automated lifecycle hooks | status: active | updated: 2026-05-09 | sources: 4
- [[ak-code-review-skill]](entities/ak-code-review-skill.md) — Rigorous code review skill with mandatory exploration rules | status: active | updated: 2026-05-09 | sources: 2
- [[agent-kit-core]](entities/agent-kit-core.md) — Foundational MCP server and modular tool registration architecture | status: active | updated: 2026-05-01 | sources: 2
- [[ak-plan-skill]](entities/ak-plan-skill.md) — Implementation blueprint (WBS) creation skill | status: active | updated: 2026-04-27 | sources: 2
- [[credentials-utility]](entities/credentials-utility.md) — Centralized credential resolution and INI parsing logic | status: active | updated: 2026-04-27 | sources: 1
- [[jira-integration]](entities/jira-integration.md) — Atlassian Jira REST API integration and ADF parsing | status: complete | updated: 2026-04-27 | sources: 2
- [[security-hardening]](entities/security-hardening.md) — 3-layer security: path blocking, validation hardening, sub-agent env sanitization | status: active | updated: 2026-04-18 | sources: 1
- [[readme-wiki-docs]](entities/readme-wiki-docs.md) — Documentation for the /ak:wiki skill in the project README | status: complete | updated: 2026-04-11 | sources: 1
- [[clear-hooks]](entities/clear-hooks.md) — Export/reinject hook pair specifically for the /clear command | status: active | updated: 2026-04-11 | sources: 1

## 📚 Glossary
