# Clear Hooks

> Last updated: 2026-04-11 | Sources: 1

## Summary

A pair of hooks that mirror the PreCompact/PostCompact behavior for `/clear`: the session transcript is exported before context is wiped, and the wiki index is re-injected into the fresh session immediately after.

## Lifecycle

complete

## Key Decisions

- Use `SessionEnd` with matcher `"clear"` to trigger `export-conversation-history.js` before `/clear` discards context — conv-2a97e119
- Use `SessionStart` with matcher `"clear"` to trigger `wiki-context-reinject.js` after `/clear` resets the session — conv-2a97e119
- Export script is shared with PreCompact (`export-conversation-history.js`); reinject script is shared with PostCompact (`wiki-context-reinject.js`) — no new scripts needed

## Edge Cases & Risks

- If the user runs `/clear` before the session has anything useful, an empty transcript is exported — harmless but generates a trivial conv-*.txt file

## Open Questions

- None currently

## Related

- [[session-continuity-pattern]] — this feature is a direct application of that pattern
- [[llm-wiki]] — clear-hooks is a sub-component of the broader wiki system; the export and reinject scripts are shared with the wiki infrastructure
- [[fail-open-pattern]] — if export fails, /clear still proceeds; wiki entry missed but user unblocked
