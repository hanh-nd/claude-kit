import * as assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, test } from 'node:test';

const tempDirs: string[] = [];

function makeTempDir(): string {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'memory-kit-init-'));
  tempDirs.push(tempDir);
  return tempDir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const tempDir = tempDirs.pop();
    if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

describe('kit-init', () => {
  test('enables memory and creates wiki dirs without legacy daily memory files', () => {
    const projectDir = makeTempDir();
    const scriptPath = path.resolve('dist/scripts/kit-init.js');

    const result = spawnSync(process.execPath, [scriptPath], {
      cwd: path.resolve('.'),
      env: {
        ...process.env,
        CODEX_PROJECT_DIR: projectDir,
      },
      input: '{}',
      encoding: 'utf8',
    });

    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), '{}');

    const settingsPath = path.join(projectDir, '.agent-kit', 'settings.json');
    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8')) as {
      memory?: { enabled?: boolean };
    };

    assert.equal(settings.memory?.enabled, true);
    assert.ok(fs.existsSync(path.join(projectDir, '.agent-kit', 'wiki', 'raw')));
    assert.ok(fs.existsSync(path.join(projectDir, '.agent-kit', 'wiki', 'compiled')));
    assert.ok(fs.existsSync(path.join(projectDir, '.agent-kit', 'wiki', 'archive', 'conversations')));
    assert.ok(!fs.existsSync(path.join(projectDir, '.agent-kit', 'memory')));
  });

  test('does not inject SessionStart context even when compiled wiki exists', () => {
    const projectDir = makeTempDir();
    const scriptPath = path.resolve('dist/scripts/kit-init.js');
    const compiledDir = path.join(projectDir, '.agent-kit', 'wiki', 'compiled');

    fs.mkdirSync(compiledDir, { recursive: true });
    fs.writeFileSync(
      path.join(compiledDir, 'preferences.md'),
      '# Preferences\nAlways keep memory-kit startup context curated.',
      'utf8',
    );
    fs.writeFileSync(
      path.join(compiledDir, 'index.md'),
      '# Project Index\nMemory Kit stores compiled knowledge in wiki.',
      'utf8',
    );

    const result = spawnSync(process.execPath, [scriptPath], {
      cwd: path.resolve('.'),
      env: {
        ...process.env,
        CODEX_PROJECT_DIR: projectDir,
      },
      input: '{}',
      encoding: 'utf8',
    });

    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), {});
  });
});
