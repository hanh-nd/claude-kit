# LLM Evaluation Strategy

> Last updated: 2026-05-09 | Seen in: 0 entities

## What It Is

A multi-tier approach to evaluating LLM output quality, focusing on blind A/B comparison and discriminating test cases to verify skill effectiveness.

The strategy recommends three tiers:
1. **Tier 1: Skill-Creator Evals (Native)** — Anthropic's native blind A/B comparator for "skill vs. no skill" testing.
2. **Tier 2: PromptFoo (Quantitative)** — local CLI matrix comparison for regression testing and rubric-based scoring.
3. **Tier 3: Langfuse (Production)** — live traffic monitoring and A/B split testing.

## Why We Use It

Ensures that adding or modifying a skill actually improves performance over baseline Claude. "Vibe-based" testing is insufficient for complex engineering skills. The strategy emphasizes **discriminating test cases** — prompts that baseline models genuinely fail on — to maximize the measurable impact of the skill.

## Key Decisions

- **Avoid Custom Systems**: Prefer Anthropic's official `skill-creator` evals or established OSS like `PromptFoo` over building a custom eval framework. [[brainstorm-llm-eval-frameworks-research]]
- **Blind A/B Comparator**: Use comparator agents to judge outputs without knowing the source configuration, eliminating subjective bias. [[brainstorm-llm-eval-frameworks-research]]
- **Fail-Mode Analysis**: Generate test cases by analyzing failure modes (e.g., netmonty's "skill-gap-finder" pattern) to ensure tests are challenging enough. [[brainstorm-llm-eval-frameworks-research]]

## Contradictions / Open Questions

- **Evaluation Cost**: LLM-as-judge calls can approach the cost of task inference at scale; must balance rubric depth with token budget.
