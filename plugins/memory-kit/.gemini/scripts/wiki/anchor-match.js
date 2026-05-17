import * as path from 'node:path';
export function isPathAnchor(anchor) {
    return anchor.includes('/') || anchor.startsWith('/');
}
export function countPathPrefixMatches(queryPaths, anchors) {
    const pathAnchors = anchors.filter(isPathAnchor);
    let count = 0;
    for (const queryPath of queryPaths) {
        const base = path.basename(queryPath);
        for (const anchor of pathAnchors) {
            const anchorBase = path.basename(anchor);
            if (queryPath.endsWith(anchor) || anchor.endsWith(base) || base === anchorBase) {
                count++;
                break;
            }
        }
    }
    return count;
}
export function countSymbolMatches(querySymbols, anchors) {
    const symbolAnchors = anchors.filter((a) => !isPathAnchor(a)).map((a) => a.toLowerCase());
    let count = 0;
    for (const symbol of querySymbols) {
        if (symbolAnchors.includes(symbol.toLowerCase())) {
            count++;
        }
    }
    return count;
}
