import * as fs from 'fs';
import * as path from 'path';
import type { WikiLedger } from '@types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isStringRecord(value: unknown): value is Record<string, string> {
  if (!isRecord(value)) return false;
  return Object.values(value).every((entry) => typeof entry === 'string');
}

function buildFallbackSessionId(): string {
  return `pid-${process.pid}-${Date.now()}`;
}

export function readLedger(ledgerPath: string, sessionId: string | null): WikiLedger {
  const effectiveSessionId = sessionId || buildFallbackSessionId();
  try {
    const raw = fs.readFileSync(ledgerPath, 'utf8');
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || typeof parsed.sessionId !== 'string') {
      return { sessionId: effectiveSessionId, startedAt: new Date().toISOString(), injected: {} };
    }
    if (parsed.sessionId !== effectiveSessionId) {
      return { sessionId: effectiveSessionId, startedAt: new Date().toISOString(), injected: {} };
    }
    return {
      sessionId: parsed.sessionId,
      startedAt: typeof parsed.startedAt === 'string' ? parsed.startedAt : new Date().toISOString(),
      injected: isStringRecord(parsed.injected) ? parsed.injected : {},
    };
  } catch {
    return { sessionId: effectiveSessionId, startedAt: new Date().toISOString(), injected: {} };
  }
}

export function wasInjected(ledger: WikiLedger, slug: string, queryHash: string): boolean {
  return Object.prototype.hasOwnProperty.call(ledger.injected, `${slug}:${queryHash}`);
}

export function markInjected(ledger: WikiLedger, slug: string, queryHash: string): WikiLedger {
  return {
    ...ledger,
    injected: { ...ledger.injected, [`${slug}:${queryHash}`]: new Date().toISOString() },
  };
}

export function writeLedger(ledgerPath: string, ledger: WikiLedger): void {
  const dir = path.dirname(ledgerPath);
  fs.mkdirSync(dir, { recursive: true });
  const tmpPath = `${ledgerPath}.tmp.${process.pid}`;
  fs.writeFileSync(tmpPath, JSON.stringify(ledger, null, 2), 'utf8');
  fs.renameSync(tmpPath, ledgerPath);
}
