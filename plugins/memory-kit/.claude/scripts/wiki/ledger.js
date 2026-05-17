import * as fs from 'fs';
import * as path from 'path';
function isRecord(value) {
    return typeof value === 'object' && value !== null;
}
function isStringRecord(value) {
    if (!isRecord(value))
        return false;
    return Object.values(value).every((entry) => typeof entry === 'string');
}
function buildFallbackSessionId() {
    return `pid-${process.pid}-${Date.now()}`;
}
export function readLedger(ledgerPath, sessionId) {
    const effectiveSessionId = sessionId || buildFallbackSessionId();
    try {
        const raw = fs.readFileSync(ledgerPath, 'utf8');
        const parsed = JSON.parse(raw);
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
    }
    catch {
        return { sessionId: effectiveSessionId, startedAt: new Date().toISOString(), injected: {} };
    }
}
export function wasInjected(ledger, slug) {
    return Object.prototype.hasOwnProperty.call(ledger.injected, slug);
}
export function markInjected(ledger, slug) {
    return {
        ...ledger,
        injected: { ...ledger.injected, [slug]: new Date().toISOString() },
    };
}
export function writeLedger(ledgerPath, ledger) {
    const dir = path.dirname(ledgerPath);
    fs.mkdirSync(dir, { recursive: true });
    const tmpPath = `${ledgerPath}.tmp.${process.pid}`;
    fs.writeFileSync(tmpPath, JSON.stringify(ledger, null, 2), 'utf8');
    fs.renameSync(tmpPath, ledgerPath);
}
