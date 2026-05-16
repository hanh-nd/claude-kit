import * as fs from 'fs';
import * as path from 'path';
import { parsePage } from './parse-page.js';
const COMPILED_CATEGORIES = ['entities', 'concepts', 'glossary', 'preferences'];
export function loadAllPages(wikiRoot) {
    const pages = [];
    for (const category of COMPILED_CATEGORIES) {
        const dir = path.join(wikiRoot, 'compiled', category);
        let entries;
        try {
            entries = fs.readdirSync(dir);
        }
        catch {
            continue;
        }
        for (const entry of entries) {
            if (!entry.endsWith('.md'))
                continue;
            const absPath = path.join(dir, entry);
            const page = parsePage(absPath);
            if (page)
                pages.push(page);
        }
    }
    if (pages.length === 0) {
        const inboxPath = path.join(wikiRoot, 'raw', 'inbox.md');
        const inboxPage = parsePage(inboxPath);
        if (inboxPage)
            pages.push(inboxPage);
    }
    return pages;
}
