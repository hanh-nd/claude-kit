## [2026-05-09] compile — PREFERENCES RECOMPILE
- Bundles: 4 | Conversations: 1
- Outcomes: D:4
- Negative knowledge: 2 anti-patterns → preferences | 2 rejections → preferences
- Updated: skill-authoring, code-review-standards
- Created: planning-contracts (preference), infrastructure-hooks (preference)
- Summary: Refined preferences to match the updated 3.2.0 wiki skill spec. Surfaced "behavioral contracts" as a standing rule to combat pseudocode bloat and formalized the "fail-open" policy for non-security hooks.

## [2026-05-09] compile — FULL RECOMPILATION
- Bundles: 19 | Conversations: 28
- Outcomes: A:3 B:0 C:1 D:2 E:0 F-routine:13 F-exploration:0
- Negative knowledge: 4 anti-patterns → preferences | 2 reality gaps → entities | 1 research → concepts
- Updated: llm-wiki, ak-code-review-skill, unified-context-injection
- Created: skill-authoring (preference), code-review-standards (preference), llm-eval-strategy (concept)
- F-routine (logged only): user-export-csv, rate-limit-redis, google-oauth2-integration, user-status-enum, logger-refactoring-pino (unimplemented application logic)

## [2026-05-09] compile
- Bundles: 1 | Conversations: 1
- Outcomes: A:1 B:0 C:1 D:0 E:0 F-routine:0 F-exploration:0
- Updated: unified-context-injection, mandatory-context-loading
- Created: (none)

## [2026-05-01] compile
- Bundles: 1 | Conversations: 5
- Outcomes: A:1 B:0 C:1 D:0 E:0 F-routine:2 F-exploration:0
- Updated: agent-kit-core, skill-vs-subagent-decision
- Created: (none)
- F-routine (logged only): cat chat session JSONL (blocked by path check), cat chat session (blocked by security hook)

## [2026-04-27] compile
- Bundles: 1 | Conversations: 2
- Outcomes: A:1 B:0 C:1 D:0 E:0 F-routine:0 F-exploration:0
- Updated: security-hardening
- Created: workspace-boundary-hardening (concept)

## [2026-04-27] compile
- Bundles: 1 | Conversations: 15
- Outcomes: A:0 B:2 C:1 D:0 E:0 F-routine:0 F-exploration:0
- Updated: (none)
- Created: multi-angle-protocol, ak-code-review-skill, multi-angle-protocol (concept)

## [2026-04-27] lint — noun-anchoring & consolidation pass
- Renamed work-tense anti-pattern entities to codebase nouns:
  - `ak-plan-behavioral-spec-redesign` → `ak-plan-skill`
  - `credential-manager-refactor` → `credentials-utility`
  - `jira-integration` → `jira-integration`
- Merged redundant feature entities into their corresponding concepts:
  - `mermaid-diagram-refactor` → `mermaid-as-standard`
  - `multi-angle-protocol` (entity) → `multi-angle-protocol` (concept)
  - `pipeline-skill-menus` → `post-save-menu-pattern`
  - `polyglot-marketplace-monorepo` → `polyglot-monorepo-pattern`
- Updated `index.md` with new counts and noun-tense summaries.
- Final state: 10 entities, 10 concepts.

## [2026-04-18] compile
- Inbox entries: 0 | Conversations: 0 | Handoff files scanned: 3 (polyglot marketplace)
- Updated: (none)
- Created: polyglot-marketplace-monorepo, registry-pattern, polyglot-monorepo-pattern

## [2026-04-12] compile
- Inbox entries: 0 | Conversations: 1 (conv-8a714d86)
- Updated: ak-plan-behavioral-spec-redesign
- Created: pipeline-skill-menus, skill-vs-subagent-decision, post-save-menu-pattern

## [2026-04-11] compile
- Inbox entries: 1 | Conversations: 0
- Updated: session-continuity-pattern
- Created: unified-context-injection, mandatory-context-loading

## [2026-04-11] lint — correction pass
- Restored: ak-plan-behavioral-spec-redesign (behavioral contract IS in skills/plan/SKILL.md:178-180 as "business rules" enforcement text, not _Must achieve: field name), credential-manager-refactor (landed at src/utils/credentials.ts, not separate credential-manager.ts), behavioral-contract-pattern concept
- Updated entity descriptions to reflect actual code locations vs. original design intent
- Final state: 8 entities, 4 concepts

## [2026-04-11] lint — code-grounded purge
- Verified all 16 entity + 5 concept pages against actual codebase
- Removed (no code anchor in this project): llm-eval-frameworks, yr-27987-pci-proxy, ak-plan-behavioral-spec-redesign, credential-manager-refactor, user-status-enum, google-oauth2-integration, logger-refactoring-pino, user-export-csv, rate-limit-redis (YourRentals client or unimplemented plans); behavioral-contract-pattern (pattern not in skills/plan/SKILL.md — still uses _Logic: format)
- Updated: fail-open-pattern (removed dead links), mermaid-as-standard (removed dead links)
- Remaining: 6 entities, 3 concepts — all grounded in actual src/, scripts/, skills/, or hooks/ files

## [2026-04-11] compile
- Inbox entries: 0 | Conversations: 0 | Handoff files scanned: 19 (direct from .agent-kit/handoffs/)
- Updated: clear-hooks, session-continuity-pattern
- Created: security-hardening, llm-eval-frameworks, yr-27987-pci-proxy, mermaid-diagram-refactor, ak-plan-behavioral-spec-redesign, credential-manager-refactor, user-status-enum, google-oauth2-integration, logger-refactoring-pino, jira-adf-to-markdown, llm-wiki, readme-wiki-docs, user-export-csv, rate-limit-redis, behavioral-contract-pattern, fail-open-pattern, mermaid-as-standard

## [2026-04-11] compile
- Inbox entries: 0 | Conversations: 4 (3 trivial, 1 substantive)
- Updated: (none — first compile)
- Created: clear-hooks, session-continuity-pattern
