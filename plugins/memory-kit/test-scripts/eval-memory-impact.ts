#!/usr/bin/env node

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { main } from '../scripts/wiki-inject-context.js';
import { copyCompiledWiki, resolveDogfoodWikiRoot } from './dogfood-fixture.js';
import type { WikiInjectStdin } from '@types';

type ImpactCategory = 'skill' | 'architecture' | 'workflow' | 'negative';

interface ImpactCase {
  id: string;
  category: ImpactCategory;
  description: string;
  input: WikiInjectStdin;
  expectedSlug: string | null;
}

const CASES: ImpactCase[] = [
  {
    id: 'skill-01',
    category: 'skill',
    description: 'Opening the plan skill should recall its WBS contract and menu behavior.',
    input: { tool_name: 'Read', tool_input: { file_path: '/repo/skills/plan/SKILL.md' }, session_id: 'impact-skill-01' },
    expectedSlug: 'ak-plan-skill',
  },
  {
    id: 'skill-02',
    category: 'skill',
    description: 'Opening the code-review skill should recall evidence-backed review rules.',
    input: { tool_name: 'Read', tool_input: { file_path: '/repo/skills/code-review/SKILL.md' }, session_id: 'impact-skill-02' },
    expectedSlug: 'ak-code-review-skill',
  },
  {
    id: 'skill-03',
    category: 'skill',
    description: 'Opening the ticket skill should recall Jira integration context.',
    input: { tool_name: 'Read', tool_input: { file_path: '/repo/skills/ticket/SKILL.md' }, session_id: 'impact-skill-03' },
    expectedSlug: 'jira-integration',
  },
  {
    id: 'skill-04',
    category: 'skill',
    description: 'Opening the wiki skill should recall the project wiki system.',
    input: { tool_name: 'Read', tool_input: { file_path: '/repo/skills/wiki/SKILL.md' }, session_id: 'impact-skill-04' },
    expectedSlug: 'llm-wiki',
  },
  {
    id: 'skill-05',
    category: 'skill',
    description: 'Planning parallel execution should recall the skill vs subagent framework.',
    input: { tool_name: 'Edit', tool_input: { file_path: '/repo/skills/plan/SKILL.md', new_string: 'add Parallel agents execution option with subagent batching' }, session_id: 'impact-skill-05' },
    expectedSlug: 'skill-vs-subagent-decision',
  },
  {
    id: 'architecture-01',
    category: 'architecture',
    description: 'Editing credential resolution should recall the centralized credentials utility.',
    input: { tool_name: 'Edit', tool_input: { file_path: '/repo/src/utils/credentials.ts', new_string: 'resolve KIT_PROFILE before reading ~/.claude/credentials' }, session_id: 'impact-architecture-01' },
    expectedSlug: 'credentials-utility',
  },
  {
    id: 'architecture-02',
    category: 'architecture',
    description: 'Editing Jira tooling should recall ADF parsing and credential requirements.',
    input: { tool_name: 'Edit', tool_input: { file_path: '/repo/src/tools/integration.ts', new_string: 'preserve Atlassian Document Format tables in ticket markdown' }, session_id: 'impact-architecture-02' },
    expectedSlug: 'jira-integration',
  },
  {
    id: 'architecture-03',
    category: 'architecture',
    description: 'Editing the hook injector should recall unified context injection.',
    input: { tool_name: 'Edit', tool_input: { file_path: '/repo/scripts/inject-agent-instructions.js', new_string: 'inject docs/instruction.md and wiki compiled index at startup' }, session_id: 'impact-architecture-03' },
    expectedSlug: 'unified-context-injection',
  },
  {
    id: 'architecture-04',
    category: 'architecture',
    description: 'Changing security validation should recall hardening decisions.',
    input: { tool_name: 'Edit', tool_input: { file_path: '/repo/src/tools/security.ts', new_string: 'validate workspace boundary and forbidden path segments case-insensitively' }, session_id: 'impact-architecture-04' },
    expectedSlug: 'security-hardening',
  },
  {
    id: 'architecture-05',
    category: 'architecture',
    description: 'Opening the core server should recall the agent-kit architecture map.',
    input: { tool_name: 'Read', tool_input: { file_path: '/repo/src/kit-server.ts' }, session_id: 'impact-architecture-05' },
    expectedSlug: 'agent-kit-core',
  },
  {
    id: 'workflow-01',
    category: 'workflow',
    description: 'Working on clear hooks should recall the session continuity pattern.',
    input: { tool_name: 'Edit', tool_input: { file_path: '/repo/hooks/hooks.json', new_string: 'wire SessionEnd clear export and SessionStart clear reinject hooks' }, session_id: 'impact-workflow-01' },
    expectedSlug: 'clear-hooks',
  },
  {
    id: 'workflow-02',
    category: 'workflow',
    description: 'Adding no-op hook behavior should recall the fail-open pattern.',
    input: { tool_name: 'Edit', tool_input: { file_path: '/repo/scripts/wiki-inbox-append.js', new_string: 'on file I/O error call noOp and process.exit(0)' }, session_id: 'impact-workflow-02' },
    expectedSlug: 'fail-open-pattern',
  },
  {
    id: 'workflow-03',
    category: 'workflow',
    description: 'Opening marketplace metadata should recall registry-based plugin discovery.',
    input: { tool_name: 'Read', tool_input: { file_path: '/repo/.claude-plugin/marketplace.json' }, session_id: 'impact-workflow-03' },
    expectedSlug: 'registry-pattern',
  },
  {
    id: 'workflow-04',
    category: 'workflow',
    description: 'Editing a plugin package should recall isolated polyglot workspaces.',
    input: { tool_name: 'Edit', tool_input: { file_path: '/repo/plugins/agent-kit/package.json', new_string: 'keep each plugin self-contained with independent build scripts' }, session_id: 'impact-workflow-04' },
    expectedSlug: 'polyglot-monorepo-pattern',
  },
  {
    id: 'workflow-05',
    category: 'workflow',
    description: 'Changing context-loading docs should recall automated mandatory context loading.',
    input: { tool_name: 'Edit', tool_input: { file_path: '/repo/docs/instruction.md', new_string: 'load project.md and wiki compiled index automatically at session start' }, session_id: 'impact-workflow-05' },
    expectedSlug: 'mandatory-context-loading',
  },
  {
    id: 'workflow-06',
    category: 'workflow',
    description: 'Editing README wiki docs should recall the README wiki documentation entity.',
    input: { tool_name: 'Edit', tool_input: { file_path: '/repo/README.md', new_string: 'document the /wiki compile workflow and compiled index' }, session_id: 'impact-workflow-06' },
    expectedSlug: 'readme-wiki-docs',
  },
  {
    id: 'negative-01',
    category: 'negative',
    description: 'Trivial shell command should not inject project memory.',
    input: { tool_name: 'Bash', tool_input: { command: 'git status' }, session_id: 'impact-negative-01' },
    expectedSlug: null,
  },
  {
    id: 'negative-02',
    category: 'negative',
    description: 'Unanchored spreadsheet read should not inject project memory.',
    input: { tool_name: 'Read', tool_input: { file_path: '/repo/reports/finance.xlsx' }, session_id: 'impact-negative-02' },
    expectedSlug: null,
  },
  {
    id: 'negative-03',
    category: 'negative',
    description: 'Prompt-only todo content should not inject through the PreToolUse hook.',
    input: { tool_name: 'TodoWrite', tool_input: { content: 'remember to use the plan skill contract' }, session_id: 'impact-negative-03' },
    expectedSlug: null,
  },
  {
    id: 'negative-04',
    category: 'negative',
    description: 'Unsupported binary asset path should not inject project memory.',
    input: { tool_name: 'Read', tool_input: { file_path: '/repo/assets/logo.png' }, session_id: 'impact-negative-04' },
    expectedSlug: null,
  },
];

function extractAdditionalContext(result: Awaited<ReturnType<typeof main>>): string | null {
  if ('hookSpecificOutput' in result && result.hookSpecificOutput) {
    return result.hookSpecificOutput.additionalContext;
  }
  return null;
}

async function runEval(): Promise<void> {
  const sourceWikiRoot = resolveDogfoodWikiRoot();
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'memory-impact-eval-'));
  const wikiRoot = path.join(tmpDir, '.agent-kit', 'wiki');
  copyCompiledWiki(sourceWikiRoot, wikiRoot);

  const stats = new Map<ImpactCategory, { passed: number; total: number }>();
  const failures: string[] = [];

  try {
    for (const testCase of CASES) {
      const result = await main(testCase.input, {
        wikiRoot,
        settings: {
          wiki: {
            injectMinScore: 1.0,
            injectMarginRatio: 1.0,
            injectMaxResults: 1,
          },
        },
      });
      const context = extractAdditionalContext(result);
      const passed = testCase.expectedSlug === null
        ? context === null
        : context !== null && context.includes(`[WIKI HIT] ${testCase.expectedSlug}`);

      const categoryStats = stats.get(testCase.category) ?? { passed: 0, total: 0 };
      categoryStats.total += 1;
      if (passed) categoryStats.passed += 1;
      stats.set(testCase.category, categoryStats);

      if (!passed) {
        const actual = context?.match(/\[WIKI HIT(?:-INBOX)?\] ([^\s]+)/)?.[1] ?? 'none';
        failures.push(`${testCase.id}: expected ${testCase.expectedSlug ?? 'no injection'}, got ${actual} — ${testCase.description}`);
      }
    }
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }

  console.log('\nMemory Impact Eval Results:');
  console.log(`  corpus     ${sourceWikiRoot}`);
  let totalPassed = 0;
  let total = 0;
  for (const category of ['skill', 'architecture', 'workflow', 'negative'] as ImpactCategory[]) {
    const categoryStats = stats.get(category) ?? { passed: 0, total: 0 };
    totalPassed += categoryStats.passed;
    total += categoryStats.total;
    const percent = categoryStats.total === 0 ? 100 : (categoryStats.passed / categoryStats.total) * 100;
    console.log(`  ${category.padEnd(12)} ${percent.toFixed(1)}% (${categoryStats.passed}/${categoryStats.total})`);
  }
  console.log(`  ${'overall'.padEnd(12)} ${((totalPassed / total) * 100).toFixed(1)}% (${totalPassed}/${total})`);

  if (failures.length > 0) {
    console.error('\nFailed cases:');
    for (const failure of failures) {
      console.error(`  - ${failure}`);
    }
    if (process.argv.includes('--strict')) {
      process.exit(1);
    }
    console.log('\nWARN: impact gaps found. Re-run with --strict to fail on gaps.');
    return;
  }

  console.log('\nPASS: all memory impact cases met expected recall behavior');
}

runEval().catch((error) => {
  console.error('Memory impact eval failed:', error);
  process.exit(1);
});
