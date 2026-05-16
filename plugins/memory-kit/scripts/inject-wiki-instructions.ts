#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

import { noOp, runWhenInvoked } from './utils.js';

function readFile(filePath: string): string | null {
  try {
    const content = fs.readFileSync(filePath, 'utf8').trim();
    return content || null;
  } catch {
    return null;
  }
}

runWhenInvoked(import.meta.url, () => {
  const __filename = fileURLToPath(import.meta.url);
  const pluginRoot = path.dirname(path.dirname(__filename));

  const sections: string[] = [];

  const preferences = readFile(
    path.join(pluginRoot, '.agent-kit', 'wiki', 'compiled', 'preferences.md')
  );
  if (preferences) sections.push(preferences);

  const wikiIndex = readFile(
    path.join(pluginRoot, '.agent-kit', 'wiki', 'compiled', 'index.md')
  );
  if (wikiIndex) sections.push(wikiIndex);

  if (sections.length === 0) {
    noOp();
    return;
  }

  console.log(sections.join('\n\n---\n\n'));
  process.exit(0);
});
