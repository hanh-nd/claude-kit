#!/usr/bin/env node
import * as fs from 'fs';
import * as path from 'path';
import { KIT_PATH } from './constants.js';
import { noOp, runWhenInvoked } from './utils.js';
const HANDOFF_TYPES = [
    'brainstorm',
    'clarification',
    'plan',
    'ticket',
    'research',
    'scenario',
    'investigation',
];
const TICKET_ID_PATTERN = /\b[A-Z][A-Z0-9]+-\d+\b/;
function normalizeHandoffType(type) {
    if (!HANDOFF_TYPES.includes(type))
        throw new Error(`Unsupported handoff type: ${type}`);
    return type;
}
function sanitizeFeatureSlug(value) {
    return value
        .replace(/[^a-zA-Z0-9-_]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .toLowerCase();
}
function findTicketId(value) {
    return value.match(TICKET_ID_PATTERN)?.[0].toLowerCase() ?? null;
}
function contentSlugCandidate(content) {
    const heading = content
        .split(/\r?\n/)
        .map((line) => line.replace(/^#+\s*/, '').trim())
        .find((line) => line.length > 0);
    return heading ?? content.replace(/\s+/g, ' ').trim().slice(0, 80);
}
function deriveFeatureSlug({ slug, content }) {
    const requestedTicketSlug = findTicketId(slug);
    if (requestedTicketSlug)
        return requestedTicketSlug;
    const requestedSlug = sanitizeFeatureSlug(slug);
    if (requestedSlug)
        return requestedSlug;
    const contentTicketSlug = findTicketId(content);
    if (contentTicketSlug)
        return contentTicketSlug;
    return (sanitizeFeatureSlug(contentSlugCandidate(content)) ||
        'untitled-handoff');
}
function isRecord(value) {
    return typeof value === 'object' && value !== null;
}
/**
 * Build a structured inbox entry from a kit_save_handoff tool call.
 * Returns null if required fields (type, slug) are missing.
 */
export function buildInboxEntry(toolInput) {
    if (!toolInput?.type || !toolInput?.slug)
        return null;
    const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, '');
    const { type, slug, content = '' } = toolInput;
    let filePath = '';
    try {
        const canonicalType = normalizeHandoffType(type);
        const featureSlug = deriveFeatureSlug({ slug, content });
        const newPath = path.join(KIT_PATH, 'handoffs', featureSlug, `${canonicalType}.md`);
        if (fs.existsSync(newPath)) {
            filePath = newPath;
        }
    }
    catch {
        // fail-open
    }
    let summary = '';
    const headingMatch = content.match(/^## (.+)$/m);
    if (headingMatch) {
        summary = headingMatch[1].trim();
    }
    else {
        summary = content.replace(/\s+/g, ' ').trim().slice(0, 100);
    }
    const lines = [
        `## [${timestamp}] handoff | ${type}-${slug}`,
        `- type: ${type}`,
        `- slug: ${slug}`,
    ];
    if (filePath)
        lines.push(`- path: ${filePath}`);
    if (summary)
        lines.push(`- summary: ${summary}`);
    return lines.join('\n');
}
runWhenInvoked(import.meta.url, async () => {
    const raw = await new Promise((resolve) => {
        let data = '';
        process.stdin.on('data', (chunk) => (data += chunk));
        process.stdin.on('end', () => resolve(data));
    });
    let input;
    try {
        const parsed = JSON.parse(raw);
        if (!isRecord(parsed) || typeof parsed.tool_name !== 'string' || !isRecord(parsed.tool_input)) {
            noOp();
            return;
        }
        input = {
            tool_name: parsed.tool_name,
            tool_input: {
                type: typeof parsed.tool_input.type === 'string' ? parsed.tool_input.type : undefined,
                slug: typeof parsed.tool_input.slug === 'string' ? parsed.tool_input.slug : undefined,
                content: typeof parsed.tool_input.content === 'string' ? parsed.tool_input.content : undefined,
            },
        };
    }
    catch {
        noOp();
        return;
    }
    if (!input.tool_name || !input.tool_name.includes('kit_save_handoff')) {
        noOp();
        return;
    }
    const entry = buildInboxEntry(input.tool_input);
    if (!entry) {
        noOp();
        return;
    }
    const response = {};
    try {
        const inboxPath = path.join(KIT_PATH, 'wiki', 'raw', 'inbox.md');
        fs.appendFileSync(inboxPath, '\n' + entry + '\n', 'utf8');
        const content = fs.readFileSync(inboxPath, 'utf8');
        const entryCount = (content.match(/^## \[/gm) || []).length;
        if (entryCount > 10) {
            response.systemMessage = `⚠️ Wiki Inbox has more than 10 entries. Please run \`/wiki compile\` to organize them.`;
        }
    }
    catch {
        // Fail-open
    }
    console.log(JSON.stringify(response));
});
