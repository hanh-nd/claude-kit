const STATUS_BOOST = {
    active: 2,
    complete: 1,
    parked: 0.5,
    deprecated: 0,
};
const STATUS_SORT_PRIORITY = {
    active: 3,
    complete: 2,
    parked: 1,
    deprecated: 0,
};
const STALENESS_THRESHOLD_DAYS = 180;
function isStalePage(updated) {
    if (!updated)
        return false;
    const updatedMs = Date.parse(updated);
    if (isNaN(updatedMs))
        return false;
    return (Date.now() - updatedMs) / (1000 * 60 * 60 * 24) > STALENESS_THRESHOLD_DAYS;
}
function countTermMatches(terms, text) {
    if (!text || terms.length === 0)
        return 0;
    let count = 0;
    for (const term of terms) {
        if (text.includes(term))
            count++;
    }
    return count;
}
function scorePage(query, page) {
    const { terms } = query;
    if (terms.length === 0)
        return null;
    const slugText = page.slug.toLowerCase().replace(/[-_]/g, ' ');
    const filenameMatches = countTermMatches(terms, slugText);
    const headingText = [page.title, ...page.anchors].join(' ').toLowerCase();
    const headingMatches = countTermMatches(terms, headingText);
    const keyDecisionText = page.keyDecisions.join(' ').toLowerCase();
    const keyDecisionMatches = countTermMatches(terms, keyDecisionText);
    const bodyMatches = countTermMatches(terms, page.bodyText);
    const statusBoost = STATUS_BOOST[page.status || ''] ?? 0.5;
    const stalenessPenalty = isStalePage(page.updated) ? 1.0 : 0;
    const score = 4.0 * filenameMatches +
        3.0 * headingMatches +
        1.5 * keyDecisionMatches +
        1.0 * bodyMatches +
        statusBoost -
        stalenessPenalty;
    if (score <= 0)
        return null;
    return {
        slug: page.slug,
        category: page.category,
        path: page.path,
        score,
        breakdown: {
            filename: filenameMatches,
            heading: headingMatches,
            keyDecision: keyDecisionMatches,
            body: bodyMatches,
            status: statusBoost,
            staleness: stalenessPenalty,
        },
        page,
    };
}
function compareHits(a, b) {
    if (b.score !== a.score)
        return b.score - a.score;
    const aPriority = STATUS_SORT_PRIORITY[a.page.status || ''] ?? 1;
    const bPriority = STATUS_SORT_PRIORITY[b.page.status || ''] ?? 1;
    if (bPriority !== aPriority)
        return bPriority - aPriority;
    if (a.page.updated && b.page.updated)
        return b.page.updated.localeCompare(a.page.updated);
    if (a.page.updated)
        return -1;
    if (b.page.updated)
        return 1;
    return a.slug.localeCompare(b.slug);
}
export function scoreQuery(query, pages) {
    const hits = [];
    for (const page of pages) {
        const hit = scorePage(query, page);
        if (hit)
            hits.push(hit);
    }
    return hits.sort(compareHits);
}
