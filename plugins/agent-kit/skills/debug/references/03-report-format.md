---
name: report-format
description: Standard Operating Procedure for generating context-aware, style-compliant unit tests.
version: 1.0.0
---

# Verification & Output Report

Upon completing Phase 5, you MUST output the following structured report exactly as formatted below. Do not deviate.

```markdown
DEBUG REPORT
════════════════════════════════════════
Symptom: [Clear description of what the user/system originally observed]
Root cause: [Precise explanation of what was actually wrong mechanically]
Fix: [Description of what was changed, including file:line references]
Evidence: [Paste test output or reproduction attempt showing the fix works]
Regression test: [file:line reference of the newly written regression test]
Related: [Any related TODOS.md items, prior bugs, or architectural notes]
Status: `[DONE | DONE_WITH_CONCERNS | BLOCKED]`
════════════════════════════════════════
```

## Status Definitions

- **DONE:** Root cause found, minimal fix applied, regression test written, all tests pass.
- **DONE_WITH_CONCERNS:** Fixed, but cannot fully verify locally (e.g., intermittent bug, requires staging environment).
- **BLOCKED:** Root cause remains unclear after investigation (e.g., hit the 3-strike rule), requires human escalation.
