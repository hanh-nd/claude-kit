export function applyStrongSignalGate(hits) {
    return hits.filter((h) => h.breakdown.strongSignal);
}
export function applyThresholdGate(hits, minScore) {
    return hits.filter((h) => h.score >= minScore);
}
export function applyMarginGate(hits, marginRatio) {
    if (hits.length < 2)
        return hits;
    if (hits[0].score / hits[1].score < marginRatio)
        return [];
    // hits[0] clearly leads hits[1]; return all — injectMaxResults (capped at 2) bounds the final count downstream
    return hits;
}
