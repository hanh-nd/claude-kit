# Jira Integration

> Last updated: 2026-04-27 | Sources: 2 | Status: complete

## Summary

Logic for interacting with the Atlassian Jira REST API, specifically fetching tickets and parsing Atlassian Document Format (ADF) to Markdown. Located in `src/tools/integration.ts`.

## Anchors

- Primary: `src/tools/integration.ts`
- Related: `skills/ticket/SKILL.md`

## Key Decisions

- **ADF to Markdown Parsing**: Replaced `extractAdfText()` with `adfToMarkdown()` to preserve tables, lists, headings, and links in ticket bodies. [[jira-adf-to-markdown]]
- **Credential Usage**: Uses centralized `getCredential` for `ATLASSIAN_CLOUD_ID`, `ATLASSIAN_USER_EMAIL`, and `ATLASSIAN_API_TOKEN`. [[credentials-utility]]

## Edge Cases & Risks

- **Parsing Complexity**: Tables and nested lists in ADF are complex; the parser is tested against representative Jira ticket payloads to ensure no data loss during conversion.

## Events

- 2026-04-11 — feature — Replaced ADF text extraction with full Markdown conversion in `kit_jira_get_ticket`. — [[jira-adf-to-markdown]]

## Related

- [[credentials-utility]] — Supplies the necessary API tokens and Cloud IDs.
