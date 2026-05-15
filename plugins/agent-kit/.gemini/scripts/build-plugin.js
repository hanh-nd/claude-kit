#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pluginRoot = path.resolve(__dirname, '..');

const sharedBundleDirs = ['agents', 'docs', 'scripts'];
const requiredSkillKeys = ['name', 'description'];

const providers = {
  claude: {
    root: path.join(pluginRoot, '.claude'),
    skillKeys: [
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
    root: path.join(pluginRoot, '.codex'),
    skillKeys: ['name', 'description'],
  },
  gemini: {
    root: path.join(pluginRoot, '.gemini'),
    skillKeys: ['name', 'description', 'model'],
  },
};

function walkEntries(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return [fullPath, ...walkEntries(fullPath)];
    return [fullPath];
  });
}

function walkFiles(dir) {
  return walkEntries(dir).filter((entryPath) => fs.lstatSync(entryPath).isFile());
}

function materializeTree(source, destination) {
  if (!fs.existsSync(source)) {
    throw new Error(`Missing source directory: ${source}`);
  }

  fs.rmSync(destination, { recursive: true, force: true });
  fs.cpSync(source, destination, { recursive: true, errorOnExist: false, force: true });
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
  const providerChunks = {};
  if (!providerLines) return providerChunks;

  let currentProvider = null;
  let currentKey = null;
  let currentLines = [];

  function flushKey() {
    if (currentProvider && currentKey) {
      providerChunks[currentProvider][currentKey] = stripProviderIndent(currentLines);
    }
    currentKey = null;
    currentLines = [];
  }

  for (const line of providerLines.slice(1)) {
    const providerMatch = line.match(/^  ([A-Za-z0-9_-]+):\s*$/);
    if (providerMatch) {
      flushKey();
      currentProvider = providerMatch[1];
      providerChunks[currentProvider] = {};
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
  return providerChunks;
}

function buildSkillFrontmatter(yaml, providerName, skillKeys) {
  const chunks = parseTopLevelChunks(yaml);
  const providerChunks = parseProviderChunks(chunks.get('providers'));
  const overrides = new Map(Object.entries(providerChunks[providerName] ?? {}));
  const output = [];

  for (const key of skillKeys) {
    const lines = overrides.get(key) ?? chunks.get(key);
    if (lines) output.push(...lines);
  }

  for (const required of requiredSkillKeys) {
    if (!chunks.has(required) && !overrides.has(required)) {
      throw new Error(`Missing required frontmatter field: ${required}`);
    }
  }

  return `---\n${output.join('\n')}\n---\n`;
}

function buildProviderSkills(source, destination, providerName, skillKeys) {
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
    const frontmatter = buildSkillFrontmatter(yaml, providerName, skillKeys);
    fs.writeFileSync(outputPath, `${frontmatter}${body}`, 'utf8');
  }
}

function validateProviderSkills(providerName, targetRoot, skillKeys) {
  for (const filePath of walkFiles(targetRoot).filter((file) => path.basename(file) === 'SKILL.md')) {
    const { yaml } = splitFrontmatter(fs.readFileSync(filePath, 'utf8'), filePath);
    for (const key of parseTopLevelChunks(yaml).keys()) {
      if (!skillKeys.includes(key)) {
        throw new Error(`${path.relative(pluginRoot, filePath)} contains unsupported ${providerName} key: ${key}`);
      }
    }
  }
}

function buildSkills() {
  const source = path.join(pluginRoot, 'skills');
  if (!fs.existsSync(source)) {
    throw new Error(`Missing skills source directory: ${source}`);
  }

  for (const [providerName, provider] of Object.entries(providers)) {
    const destination = path.join(provider.root, 'skills');
    buildProviderSkills(source, destination, providerName, provider.skillKeys);
    validateProviderSkills(providerName, destination, provider.skillKeys);
  }

  console.log(`Built skills for ${Object.keys(providers).join(', ')}`);
}

function buildSharedBundles() {
  for (const [providerName, provider] of Object.entries(providers)) {
    for (const dirName of sharedBundleDirs) {
      materializeTree(
        path.join(pluginRoot, dirName),
        path.join(provider.root, dirName),
      );
    }
  }

  console.log(
    `Built shared provider directories for ${Object.keys(providers).join(', ')}: ${sharedBundleDirs.join(', ')}`,
  );
}

buildSkills();
buildSharedBundles();
