#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pluginRoot = path.resolve(__dirname, '..');
const sourceRoot = path.join(pluginRoot, 'skills');

const targets = {
  claude: {
    root: path.join(pluginRoot, '.claude', 'skills'),
    includeKeys: [
      'name',
      'description',
      'when_to_use',
      'argument-hint',
      'arguments',
      'disable-model-invocation',
      'user-invocable',
      'allowed-tools',
      'model',
      'effort',
      'context',
      'agent',
      'hooks',
      'paths',
      'shell',
    ],
  },
  codex: {
    root: path.join(pluginRoot, '.codex', 'skills'),
    includeKeys: ['name', 'description'],
  },
  gemini: {
    root: path.join(pluginRoot, '.gemini', 'skills'),
    includeKeys: ['name', 'description', 'model'],
  },
};

const requiredKeys = ['name', 'description'];

function walkFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return walkFiles(fullPath);
    return fullPath;
  });
}

function splitFrontmatter(content, filePath) {
  if (!content.startsWith('---\n')) {
    throw new Error(`${filePath} is missing YAML frontmatter`);
  }

  const end = content.indexOf('\n---', 4);
  if (end === -1) {
    throw new Error(`${filePath} has unterminated YAML frontmatter`);
  }

  return {
    yaml: content.slice(4, end),
    body: content.slice(end + 4).replace(/^\n/, ''),
  };
}

function parseTopLevelChunks(yaml) {
  const lines = yaml.replace(/\n$/, '').split('\n');
  const chunks = new Map();
  let currentKey = null;
  let currentLines = [];

  for (const line of lines) {
    const match = line.match(/^([A-Za-z0-9_-]+):(?:\s.*)?$/);
    if (match) {
      if (currentKey) chunks.set(currentKey, currentLines);
      currentKey = match[1];
      currentLines = [line];
      continue;
    }

    if (!currentKey && line.trim()) {
      throw new Error(`Unsupported frontmatter line before first key: ${line}`);
    }

    if (currentKey) currentLines.push(line);
  }

  if (currentKey) chunks.set(currentKey, currentLines);
  return chunks;
}

function stripProviderIndent(lines) {
  return lines.map((line) => (line.startsWith('    ') ? line.slice(4) : line));
}

function parseProviderChunks(providerLines) {
  const providers = {};
  if (!providerLines) return providers;

  let currentProvider = null;
  let currentKey = null;
  let currentLines = [];

  function flushKey() {
    if (currentProvider && currentKey) {
      providers[currentProvider][currentKey] = stripProviderIndent(currentLines);
    }
    currentKey = null;
    currentLines = [];
  }

  for (const line of providerLines.slice(1)) {
    const providerMatch = line.match(/^  ([A-Za-z0-9_-]+):\s*$/);
    if (providerMatch) {
      flushKey();
      currentProvider = providerMatch[1];
      providers[currentProvider] = {};
      continue;
    }

    const fieldMatch = line.match(/^    ([A-Za-z0-9_-]+):(?:\s.*)?$/);
    if (fieldMatch && currentProvider) {
      flushKey();
      currentKey = fieldMatch[1];
      currentLines = [line];
      continue;
    }

    if (currentKey && (line.startsWith('      ') || !line.trim())) {
      currentLines.push(line);
      continue;
    }

    if (line.trim()) {
      throw new Error(`Unsupported providers frontmatter line: ${line}`);
    }
  }

  flushKey();
  return providers;
}

function buildFrontmatter(yaml, targetName, targetConfig) {
  const chunks = parseTopLevelChunks(yaml);
  const providers = parseProviderChunks(chunks.get('providers'));
  const overrides = providers[targetName] ?? {};
  const overrideChunks = new Map(Object.entries(overrides));
  const output = [];

  for (const key of targetConfig.includeKeys) {
    const lines = overrideChunks.get(key) ?? chunks.get(key);
    if (lines) output.push(...lines);
  }

  for (const required of requiredKeys) {
    if (!chunks.has(required) && !overrideChunks.has(required)) {
      throw new Error(`Missing required frontmatter field: ${required}`);
    }
  }

  return `---\n${output.join('\n')}\n---\n`;
}

function copyTree(source, destination, targetName, targetConfig) {
  fs.rmSync(destination, { recursive: true, force: true });
  fs.mkdirSync(destination, { recursive: true });

  for (const filePath of walkFiles(source)) {
    const relative = path.relative(source, filePath);
    const outputPath = path.join(destination, relative);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });

    if (path.basename(filePath) !== 'SKILL.md') {
      fs.copyFileSync(filePath, outputPath);
      continue;
    }

    const content = fs.readFileSync(filePath, 'utf8');
    const { yaml, body } = splitFrontmatter(content, filePath);
    const frontmatter = buildFrontmatter(yaml, targetName, targetConfig);
    fs.writeFileSync(outputPath, `${frontmatter}${body}`, 'utf8');
  }
}

function validateTarget(targetName, targetRoot, includeKeys) {
  for (const filePath of walkFiles(targetRoot).filter((file) => path.basename(file) === 'SKILL.md')) {
    const { yaml } = splitFrontmatter(fs.readFileSync(filePath, 'utf8'), filePath);
    for (const key of parseTopLevelChunks(yaml).keys()) {
      if (!includeKeys.includes(key)) {
        throw new Error(`${path.relative(pluginRoot, filePath)} contains unsupported ${targetName} key: ${key}`);
      }
    }
  }
}

if (!fs.existsSync(sourceRoot)) {
  throw new Error(`Missing skills source directory: ${sourceRoot}`);
}

for (const [targetName, targetConfig] of Object.entries(targets)) {
  copyTree(sourceRoot, targetConfig.root, targetName, targetConfig);
  validateTarget(targetName, targetConfig.root, targetConfig.includeKeys);
}

console.log(`Built skills for ${Object.keys(targets).join(', ')}`);
