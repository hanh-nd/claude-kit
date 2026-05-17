# Mandatory Context Loading

> Last updated: 2026-05-09 | Seen in: 1 features

## What It Is

A core behavioral rule for agent-kit that **previously** required agents to proactively read `.agent-kit/project.md` and `.agent-kit/wiki/compiled/index.md` before executing any task. This is now handled automatically by the [[unified-context-injection]] hook.

## Why We Use It

This rule was established to shift responsibility for context loading from infrastructure to the agent. While the manual requirement is now retired in favor of automated injection (to further reduce agent effort and potential for skipping), the principle of "Mandatory Context" remains: no agent should operate without grounding in the current project DNA and wiki index.

## Where Applied

- [[unified-context-injection]] — This entity now automates the loading that was previously a manual agent instruction.

## Contradictions / Open Questions

- **Superseded:** This pattern has been effectively superseded by "Automated Context Injection" within the [[unified-context-injection]] framework.
