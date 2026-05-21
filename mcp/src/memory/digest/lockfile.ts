import * as fs from 'node:fs';
import { tryWriteFileExclusive } from '../../utils/files.js';
import { DIGEST_LOCKFILE_REL_PATH } from './constants.js';
import * as path from 'node:path';

function lockPath(workspaceRoot: string): string {
  return path.join(workspaceRoot, DIGEST_LOCKFILE_REL_PATH);
}

export function acquireDigestLock(workspaceRoot: string): boolean {
  const lock = lockPath(workspaceRoot);

  if (tryWriteFileExclusive(lock, JSON.stringify({ pid: process.pid }))) return true;

  // EEXIST: inspect existing lock
  let pid: number | undefined;
  try {
    const raw = fs.readFileSync(lock, 'utf8');
    pid = (JSON.parse(raw) as { pid: number }).pid;
  } catch {
    // unparseable → treat as stale
  }

  if (pid !== undefined) {
    try {
      process.kill(pid, 0);
      // process is alive → lock is held
      return false;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ESRCH') return false;
      // ESRCH → stale lock, fall through to reclaim
    }
  }

  // reclaim stale lock
  try {
    fs.unlinkSync(lock);
  } catch {
    // ignore if already gone
  }
  return tryWriteFileExclusive(lock, JSON.stringify({ pid: process.pid }));
}

export function releaseDigestLock(workspaceRoot: string): void {
  try {
    fs.unlinkSync(lockPath(workspaceRoot));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
  }
}
