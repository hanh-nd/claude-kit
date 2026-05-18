import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, test } from 'node:test';
import { acquireFileLock, releaseFileLock } from '../scripts/utils.js';

const tempDirs: string[] = [];

function makeTempDir(): string {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'memory-kit-utils-'));
  tempDirs.push(tempDir);
  return tempDir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const tempDir = tempDirs.pop();
    if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

describe('acquireFileLock / releaseFileLock', () => {
  test('acquire returns true and lock file is created; release removes it', async () => {
    const dir = makeTempDir();
    const lockPath = path.join(dir, 'test.lock');

    const acquired = await acquireFileLock(lockPath);
    assert.equal(acquired, true);
    assert.ok(fs.existsSync(lockPath), 'lock file must exist after acquire');

    releaseFileLock(lockPath);
    assert.ok(!fs.existsSync(lockPath), 'lock file must not exist after release');
  });

  test('second parallel acquire returns false within timeout when lock is held', async () => {
    const dir = makeTempDir();
    const lockPath = path.join(dir, 'test.lock');

    const first = await acquireFileLock(lockPath);
    assert.equal(first, true);

    // Second acquire should time out quickly — use short timeout
    const second = await acquireFileLock(lockPath, { retryMs: 20, timeoutMs: 100 });
    assert.equal(second, false);

    releaseFileLock(lockPath);
  });

  test('releaseFileLock on non-existent file does not throw', () => {
    const dir = makeTempDir();
    assert.doesNotThrow(() => releaseFileLock(path.join(dir, 'nonexistent.lock')));
  });
});
