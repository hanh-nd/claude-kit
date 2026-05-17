import * as fs from 'node:fs';
import * as path from 'node:path';

const FIXED_DOGFOOD_WIKI_CANDIDATES = [
  path.join('tests', 'fixtures', 'dogfood-wiki'),
  path.join('plugins', 'memory-kit', 'tests', 'fixtures', 'dogfood-wiki'),
];

const DOGFOOD_FIXTURE_ENV_VAR = 'MEMORY_DOGFOOD_FIXTURE_ROOT';

export function resolveDogfoodWikiRoot(): string {
  const envRoot = process.env[DOGFOOD_FIXTURE_ENV_VAR];

  const candidates = [
    ...(envRoot ? [envRoot] : []),
    ...FIXED_DOGFOOD_WIKI_CANDIDATES,
  ].map((candidate) => path.resolve(process.cwd(), candidate));

  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, 'compiled'))) {
      return candidate;
    }
  }

  throw new Error(
    `Could not find fixed dogfood wiki fixture. Checked:\n${candidates.map((candidate) => `  - ${candidate}`).join('\n')}`,
  );
}

function shouldCopyFixturePath(sourcePath: string): boolean {
  return !sourcePath.split(path.sep).includes('.obsidian');
}

export function copyCompiledWiki(sourceWikiRoot: string, destinationWikiRoot: string): void {
  const sourceCompiled = path.join(sourceWikiRoot, 'compiled');
  const destinationCompiled = path.join(destinationWikiRoot, 'compiled');
  fs.mkdirSync(destinationWikiRoot, { recursive: true });
  fs.cpSync(sourceCompiled, destinationCompiled, {
    recursive: true,
    filter: shouldCopyFixturePath,
  });
}
