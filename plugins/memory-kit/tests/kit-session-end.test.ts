import * as assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, test } from 'node:test';

const tempDirs: string[] = [];

function makeTempDir(): string {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'memory-kit-session-end-'));
  tempDirs.push(tempDir);
  return tempDir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const tempDir = tempDirs.pop();
    if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

describe('kit-session-end', () => {
  test('writes non-empty transcripts to wiki/raw conv markdown files only', () => {
    const projectDir = makeTempDir();
    const codexDir = path.join(projectDir, '.codex');
    const transcriptPath = path.join(codexDir, 'session.jsonl');
    const scriptPath = path.resolve('dist/scripts/kit-session-end.js');

    fs.mkdirSync(codexDir, { recursive: true });
    fs.writeFileSync(
      transcriptPath,
      [
        JSON.stringify({
          type: 'response_item',
          payload: {
            type: 'message',
            role: 'user',
            content: [{ type: 'input_text', input_text: 'Remember the wiki compile rule.' }],
          },
        }),
        JSON.stringify({
          type: 'response_item',
          payload: {
            type: 'message',
            role: 'assistant',
            content: [{ type: 'output_text', output_text: 'Use conv markdown files.' }],
          },
        }),
      ].join('\n'),
      'utf8',
    );

    const result = spawnSync(process.execPath, [scriptPath], {
      cwd: path.resolve('.'),
      env: {
        ...process.env,
        CODEX_PROJECT_DIR: projectDir,
      },
      input: JSON.stringify({ transcript_path: transcriptPath }),
      encoding: 'utf8',
    });

    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), '{}');

    const rawDir = path.join(projectDir, '.agent-kit', 'wiki', 'raw');
    const legacyMemoryDir = path.join(projectDir, '.agent-kit', 'memory');
    const rawFiles = fs.readdirSync(rawDir).filter((name) => /^conv_.*\.md$/.test(name));

    assert.equal(rawFiles.length, 1);
    const rawContent = fs.readFileSync(path.join(rawDir, rawFiles[0]), 'utf8');
    assert.match(rawContent, /Remember the wiki compile rule\./);
    assert.match(rawContent, /Use conv markdown files\./);
    assert.ok(!fs.existsSync(legacyMemoryDir), 'session end must not write to legacy memory dir');
  });
});
