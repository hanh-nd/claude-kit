import * as assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { readLedger, wasInjected, markInjected, writeLedger } from '../../scripts/wiki/ledger.js';

function makeTmpDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ledger-test-'));
  return { dir, cleanup: () => fs.rmSync(dir, { recursive: true, force: true }) };
}

describe('readLedger', () => {
  test('returns empty ledger for missing file', () => {
    const ledger = readLedger('/nonexistent/path/injected.json', 'session-abc');
    assert.equal(ledger.sessionId, 'session-abc');
    assert.deepEqual(ledger.injected, {});
  });

  test('returns empty ledger for corrupt file (C6)', () => {
    const { dir, cleanup } = makeTmpDir();
    const ledgerPath = path.join(dir, 'injected.json');
    fs.writeFileSync(ledgerPath, 'not json{{{{', 'utf8');
    try {
      const ledger = readLedger(ledgerPath, 'session-abc');
      assert.deepEqual(ledger.injected, {});
    } finally {
      cleanup();
    }
  });

  test('returns fresh ledger when session_id differs', () => {
    const { dir, cleanup } = makeTmpDir();
    const ledgerPath = path.join(dir, 'injected.json');
    const existingLedger = {
      sessionId: 'old-session',
      startedAt: new Date().toISOString(),
      injected: { 'auth-service': '2025-01-01T00:00:00Z' },
    };
    fs.writeFileSync(ledgerPath, JSON.stringify(existingLedger), 'utf8');
    try {
      const ledger = readLedger(ledgerPath, 'new-session');
      assert.equal(ledger.sessionId, 'new-session');
      assert.deepEqual(ledger.injected, {});
    } finally {
      cleanup();
    }
  });

  test('restores existing ledger when session_id matches', () => {
    const { dir, cleanup } = makeTmpDir();
    const ledgerPath = path.join(dir, 'injected.json');
    const existingLedger = {
      sessionId: 'my-session',
      startedAt: '2025-01-01T00:00:00Z',
      injected: { 'auth-service': '2025-01-01T00:00:00Z' },
    };
    fs.writeFileSync(ledgerPath, JSON.stringify(existingLedger), 'utf8');
    try {
      const ledger = readLedger(ledgerPath, 'my-session');
      assert.ok(wasInjected(ledger, 'auth-service'));
    } finally {
      cleanup();
    }
  });

  test('uses fallback session id when sessionId is null (C17)', () => {
    const ledger = readLedger('/nonexistent/injected.json', null);
    assert.ok(ledger.sessionId.startsWith('pid-'));
  });
});

describe('wasInjected', () => {
  test('returns false when key not in ledger', () => {
    const ledger = { sessionId: 'sess', startedAt: '', injected: {} };
    assert.equal(wasInjected(ledger, 'auth-service'), false);
  });

  test('returns true when key is in ledger', () => {
    const ledger = { sessionId: 'sess', startedAt: '', injected: { 'auth-service': '2025-01-01T00:00:00Z' } };
    assert.equal(wasInjected(ledger, 'auth-service'), true);
  });
});

describe('markInjected', () => {
  test('adds new key to injected map', () => {
    const ledger = { sessionId: 'sess', startedAt: '', injected: {} };
    const updated = markInjected(ledger, 'auth-service');
    assert.ok(wasInjected(updated, 'auth-service'));
  });

  test('does not mutate original ledger', () => {
    const ledger = { sessionId: 'sess', startedAt: '', injected: {} };
    markInjected(ledger, 'auth-service');
    assert.deepEqual(ledger.injected, {});
  });
});

describe('writeLedger', () => {
  test('creates ledger file with correct content (C9)', () => {
    const { dir, cleanup } = makeTmpDir();
    const ledgerPath = path.join(dir, 'injected.json');
    const ledger = { sessionId: 'sess', startedAt: '2025-01-01T00:00:00Z', injected: { 'auth-service': '2025-01-01T00:00:00Z' } };
    try {
      writeLedger(ledgerPath, ledger);
      const saved = JSON.parse(fs.readFileSync(ledgerPath, 'utf8'));
      assert.ok('auth-service' in saved.injected);
    } finally {
      cleanup();
    }
  });

  test('creates parent directory lazily', () => {
    const { dir, cleanup } = makeTmpDir();
    const ledgerPath = path.join(dir, 'nested', 'deep', 'injected.json');
    const ledger = { sessionId: 'sess', startedAt: '2025-01-01T00:00:00Z', injected: {} };
    try {
      writeLedger(ledgerPath, ledger);
      assert.ok(fs.existsSync(ledgerPath));
    } finally {
      cleanup();
    }
  });

  test('written file is always valid JSON (C10)', () => {
    const { dir, cleanup } = makeTmpDir();
    const ledgerPath = path.join(dir, 'injected.json');
    try {
      for (let i = 0; i < 5; i++) {
        const ledger = { sessionId: 'sess', startedAt: '2025-01-01T00:00:00Z', injected: { [`slug-${i}`]: new Date().toISOString() } };
        writeLedger(ledgerPath, ledger);
      }
      const content = fs.readFileSync(ledgerPath, 'utf8');
      assert.doesNotThrow(() => JSON.parse(content));
    } finally {
      cleanup();
    }
  });
});
