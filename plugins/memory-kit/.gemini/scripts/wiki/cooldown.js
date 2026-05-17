import * as fs from 'node:fs';
import { atomicWriteJSON } from './atomic-write.js';
function isRecord(value) {
    return typeof value === 'object' && value !== null;
}
function isCooldownEntry(value) {
    if (!isRecord(value))
        return false;
    return (typeof value.lastInjectedAt === 'string' &&
        typeof value.lastQueryHash === 'string' &&
        typeof value.lastPageMtimeMs === 'number');
}
// Retain entries for this many multiples of the cooldown window before evicting from disk.
// Keeps the file stable between restarts without triggering spurious re-injection.
const PRUNE_RETENTION_MULTIPLIER = 7;
export function readCooldown(cooldownPath, cooldownHours, now = Date.now()) {
    const empty = { schemaVersion: 1, entries: {} };
    try {
        const raw = fs.readFileSync(cooldownPath, 'utf8');
        const parsed = JSON.parse(raw);
        if (!isRecord(parsed) || parsed.schemaVersion !== 1 || !isRecord(parsed.entries)) {
            return empty;
        }
        const pruneWindowMs = cooldownHours * PRUNE_RETENTION_MULTIPLIER * 3_600_000;
        const pruned = {};
        for (const [slug, entry] of Object.entries(parsed.entries)) {
            if (!isCooldownEntry(entry))
                continue;
            const age = now - Date.parse(entry.lastInjectedAt);
            if (age <= pruneWindowMs) {
                pruned[slug] = entry;
            }
        }
        return { schemaVersion: 1, entries: pruned };
    }
    catch {
        return empty;
    }
}
export function isOnCooldown(ledger, slug, currentMtimeMs, cooldownHours, now = Date.now()) {
    const entry = ledger.entries[slug];
    if (!entry)
        return false;
    const windowMs = cooldownHours * 3_600_000;
    const age = now - Date.parse(entry.lastInjectedAt);
    if (age >= windowMs)
        return false;
    // Page mtime advanced past lastPageMtimeMs → allow re-injection
    if (currentMtimeMs > entry.lastPageMtimeMs)
        return false;
    return true;
}
export function markCooldown(ledger, slug, qHash, pageMtimeMs, now = Date.now()) {
    const entry = {
        lastInjectedAt: new Date(now).toISOString(),
        lastQueryHash: qHash,
        lastPageMtimeMs: pageMtimeMs,
    };
    return {
        ...ledger,
        entries: { ...ledger.entries, [slug]: entry },
    };
}
export function writeCooldown(cooldownPath, ledger) {
    try {
        atomicWriteJSON(cooldownPath, ledger);
    }
    catch {
        // Silently degrade on filesystem error
    }
}
