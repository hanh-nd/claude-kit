import * as assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import {
  readCooldown,
  isOnCooldown,
  markCooldown,
  writeCooldown,
} from '../../scripts/wiki/cooldown.js';

function makeTmpDir(): { dir: string; cleanup: () => void } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cooldown-test-'));
  return { dir, cleanup: () => fs.rmSync(dir, { recursive: true, force: true }) };
}

const COOLDOWN_HOURS = 24;
const WINDOW_MS = COOLDOWN_HOURS * 3_600_000;

describe('readCooldown', () => {
  test('returns empty ledger for missing file', () => {
    const ledger = readCooldown('/nonexistent/cooldown.json', COOLDOWN_HOURS);
    assert.equal(ledger.schemaVersion, 1);
    assert.deepEqual(ledger.entries, {});
  });

  test('returns empty ledger for corrupt file', () => {
    const { dir, cleanup } = makeTmpDir();
    const cooldownPath = path.join(dir, 'cooldown.json');
    fs.writeFileSync(cooldownPath, 'not json{{{{', 'utf8');
    try {
      const ledger = readCooldown(cooldownPath, COOLDOWN_HOURS);
      assert.deepEqual(ledger.entries, {});
    } finally {
      cleanup();
    }
  });

  test('returns empty ledger for schemaVersion mismatch', () => {
    const { dir, cleanup } = makeTmpDir();
    const cooldownPath = path.join(dir, 'cooldown.json');
    fs.writeFileSync(cooldownPath, JSON.stringify({ schemaVersion: 2, entries: {} }), 'utf8');
    try {
      const ledger = readCooldown(cooldownPath, COOLDOWN_HOURS);
      assert.deepEqual(ledger.entries, {});
    } finally {
      cleanup();
    }
  });

  test('prunes entries older than 7× cooldownHours window', () => {
    const { dir, cleanup } = makeTmpDir();
    const cooldownPath = path.join(dir, 'cooldown.json');
    const now = Date.now();
    const oldTime = new Date(now - COOLDOWN_HOURS * 7 * 3_600_000 - 1000).toISOString();
    const recentTime = new Date(now - 1000).toISOString();
    const data = {
      schemaVersion: 1,
      entries: {
        'old-slug': { lastInjectedAt: oldTime, lastQueryHash: 'abc', lastPageMtimeMs: 1000 },
        'recent-slug': { lastInjectedAt: recentTime, lastQueryHash: 'def', lastPageMtimeMs: 1000 },
      },
    };
    fs.writeFileSync(cooldownPath, JSON.stringify(data), 'utf8');
    try {
      const ledger = readCooldown(cooldownPath, COOLDOWN_HOURS, now);
      assert.ok(!('old-slug' in ledger.entries), 'old entry should be pruned');
      assert.ok('recent-slug' in ledger.entries, 'recent entry should be kept');
    } finally {
      cleanup();
    }
  });
});

describe('isOnCooldown', () => {
  test('returns false when no entry exists', () => {
    const ledger = { schemaVersion: 1 as const, entries: {} };
    assert.equal(isOnCooldown(ledger, 'slug', 1000, COOLDOWN_HOURS), false);
  });

  test('returns true within cooldown window', () => {
    const now = Date.now();
    const ledger = {
      schemaVersion: 1 as const,
      entries: {
        'auth-slug': {
          lastInjectedAt: new Date(now - 1000).toISOString(),
          lastQueryHash: 'abc',
          lastPageMtimeMs: 1000,
        },
      },
    };
    assert.equal(isOnCooldown(ledger, 'auth-slug', 1000, COOLDOWN_HOURS, now), true);
  });

  test('returns false when outside cooldown window', () => {
    const now = Date.now();
    const pastTime = new Date(now - WINDOW_MS - 1000).toISOString();
    const ledger = {
      schemaVersion: 1 as const,
      entries: {
        'auth-slug': { lastInjectedAt: pastTime, lastQueryHash: 'abc', lastPageMtimeMs: 1000 },
      },
    };
    assert.equal(isOnCooldown(ledger, 'auth-slug', 1000, COOLDOWN_HOURS, now), false);
  });

  test('returns false when page mtime advanced past lastPageMtimeMs', () => {
    const now = Date.now();
    const ledger = {
      schemaVersion: 1 as const,
      entries: {
        'auth-slug': {
          lastInjectedAt: new Date(now - 1000).toISOString(),
          lastQueryHash: 'abc',
          lastPageMtimeMs: 1000,
        },
      },
    };
    // currentMtimeMs (2000) > lastPageMtimeMs (1000)
    assert.equal(isOnCooldown(ledger, 'auth-slug', 2000, COOLDOWN_HOURS, now), false);
  });
});

describe('markCooldown + writeCooldown roundtrip', () => {
  test('roundtrip persists and restores entry', () => {
    const { dir, cleanup } = makeTmpDir();
    const cooldownPath = path.join(dir, 'cooldown.json');
    try {
      const now = Date.now();
      let ledger = { schemaVersion: 1 as const, entries: {} };
      ledger = markCooldown(ledger, 'auth-slug', 'hash123', 5000, now);
      writeCooldown(cooldownPath, ledger);

      const restored = readCooldown(cooldownPath, COOLDOWN_HOURS, now);
      assert.ok('auth-slug' in restored.entries);
      assert.equal(restored.entries['auth-slug'].lastQueryHash, 'hash123');
      assert.equal(restored.entries['auth-slug'].lastPageMtimeMs, 5000);
    } finally {
      cleanup();
    }
  });

  test('concurrent writes produce valid JSON', () => {
    const { dir, cleanup } = makeTmpDir();
    const cooldownPath = path.join(dir, 'cooldown.json');
    try {
      const now = Date.now();
      let ledger1 = { schemaVersion: 1 as const, entries: {} };
      let ledger2 = { schemaVersion: 1 as const, entries: {} };
      ledger1 = markCooldown(ledger1, 'slug-1', 'hash1', 1000, now);
      ledger2 = markCooldown(ledger2, 'slug-2', 'hash2', 2000, now);

      // Both write — last wins but both are valid
      writeCooldown(cooldownPath, ledger1);
      writeCooldown(cooldownPath, ledger2);

      const content = fs.readFileSync(cooldownPath, 'utf8');
      assert.doesNotThrow(() => JSON.parse(content));
    } finally {
      cleanup();
    }
  });
});

describe('markCooldown', () => {
  test('is immutable — does not modify original ledger', () => {
    const ledger = { schemaVersion: 1 as const, entries: {} };
    markCooldown(ledger, 'slug', 'hash', 1000);
    assert.deepEqual(ledger.entries, {});
  });
});
