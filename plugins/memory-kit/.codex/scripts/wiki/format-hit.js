import * as path from 'path';
const MAX_CHARS = 1500;
function buildFooter(slug) {
    return `(If this contradicts the code you can see, trust the code. Cite as [[${slug}]].)`;
}
function buildDisplayPath(hitPath, projectRoot) {
    if (!projectRoot)
        return hitPath;
    try {
        return path.relative(projectRoot, hitPath);
    }
    catch {
        return hitPath;
    }
}
function buildSnippet(parts) {
    return parts.join('\n');
}
export function formatHit(hit, opts = {}) {
    const { projectRoot } = opts;
    const { slug, page } = hit;
    const footer = buildFooter(slug);
    const displayPath = buildDisplayPath(page.path, projectRoot);
    if (page.category === 'inbox') {
        const lines = [`[WIKI HIT-INBOX] ${slug}`, `See handoff: ${displayPath}`];
        if (page.summary)
            lines.push(`Summary: ${page.summary}`);
        lines.push(footer);
        const candidate = lines.join('\n');
        return candidate.length <= MAX_CHARS ? candidate : candidate.slice(0, MAX_CHARS - footer.length - 1) + '\n' + footer;
    }
    return buildFullHit(slug, page, displayPath, footer);
}
function buildFullHit(slug, page, displayPath, footer) {
    const statusPart = page.status ?? 'unknown';
    const updatedPart = page.updated ? `updated ${page.updated}` : 'no date';
    const header = `[WIKI HIT] ${slug} (${statusPart}, ${updatedPart})`;
    const annotatesLine = page.anchors.length > 0 ? `Annotates: ${page.anchors[0]}` : null;
    let keyDecisionBullets = page.keyDecisions.slice(0, 3);
    let edgeCaseBullets = page.edgeCases.slice(0, 2);
    function assembleLines() {
        const lines = [header];
        if (annotatesLine)
            lines.push(annotatesLine);
        if (page.summary) {
            lines.push('');
            lines.push(`Summary: ${page.summary}`);
        }
        if (keyDecisionBullets.length > 0) {
            lines.push('');
            lines.push('Key Decisions:');
            for (const bullet of keyDecisionBullets)
                lines.push(`- ${bullet}`);
        }
        if (edgeCaseBullets.length > 0) {
            lines.push('');
            lines.push('Edge Cases:');
            for (const bullet of edgeCaseBullets)
                lines.push(`- ${bullet}`);
        }
        lines.push('');
        lines.push(`Read for full context: ${displayPath}`);
        lines.push(footer);
        return lines;
    }
    let snippet = buildSnippet(assembleLines());
    if (snippet.length <= MAX_CHARS)
        return snippet;
    // Truncate keyDecisions tail first
    while (keyDecisionBullets.length > 0 && buildSnippet(assembleLines()).length > MAX_CHARS) {
        keyDecisionBullets = keyDecisionBullets.slice(0, -1);
    }
    snippet = buildSnippet(assembleLines());
    if (snippet.length <= MAX_CHARS)
        return snippet;
    // Truncate edgeCases tail
    while (edgeCaseBullets.length > 0 && buildSnippet(assembleLines()).length > MAX_CHARS) {
        edgeCaseBullets = edgeCaseBullets.slice(0, -1);
    }
    snippet = buildSnippet(assembleLines());
    if (snippet.length <= MAX_CHARS)
        return snippet;
    // Truncate summary — but never remove footer
    const footerLine = `\nRead for full context: ${displayPath}\n${footer}`;
    const fixed = [header, annotatesLine].filter(Boolean).join('\n');
    const availableForSummary = MAX_CHARS - fixed.length - footerLine.length - '\n\nSummary: '.length;
    const truncatedSummary = page.summary ? page.summary.slice(0, Math.max(0, availableForSummary)) : '';
    const lines = [header];
    if (annotatesLine)
        lines.push(annotatesLine);
    if (truncatedSummary) {
        lines.push('');
        lines.push(`Summary: ${truncatedSummary}`);
    }
    lines.push('');
    lines.push(`Read for full context: ${displayPath}`);
    lines.push(footer);
    return buildSnippet(lines);
}
