function fnv1a32(str) {
    let hash = 2166136261;
    for (let i = 0; i < str.length; i++) {
        hash ^= str.charCodeAt(i);
        hash = (hash * 16777619) >>> 0;
    }
    return hash;
}
export function queryHash(q) {
    const canonical = [
        q.toolName,
        [...q.paths].sort().join(','),
        [...q.pathTokens].sort().join(','),
        [...q.symbols].sort().join(','),
        [...q.freeTextTokens].sort().join(','),
        [...q.terms].sort().join(','),
    ].join('|');
    return fnv1a32(canonical).toString(16).padStart(8, '0');
}
