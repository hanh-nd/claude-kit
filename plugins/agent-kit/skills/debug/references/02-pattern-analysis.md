---
name: pattern-analysis
description: Common debugging patterns and architectural smells.
version: 1.0.0
---

# Debugging Cognitive Patterns

When analyzing a bug during Phase 2, check if the symptoms match these known failure modes.

| Pattern                  | Signature                                                           | Where to look                                                |
| :----------------------- | :------------------------------------------------------------------ | :----------------------------------------------------------- |
| **Race condition**       | Intermittent, timing-dependent failures                             | Concurrent access to shared state                            |
| **Nil/null propagation** | `NoMethodError`, `TypeError`, `Cannot read properties of undefined` | Missing guards on optional values, unvalidated API responses |
| **State corruption**     | Inconsistent data, partial updates                                  | Transactions, callbacks, lifecycle hooks                     |
| **Integration failure**  | Timeout, unexpected response structure                              | External API calls, service boundaries, network layers       |
| **Configuration drift**  | Works locally, fails in staging/prod                                | Env vars, feature flags, DB migrations                       |
| **Stale cache**          | Shows old data, fixes on cache clear                                | Redis, CDN, browser cache, Turbo/hydration issues            |

## Recurring Bugs

If the bug occurs in a file that has been patched multiple times recently for similar issues, flag it. Recurring bugs are an architectural smell indicating the abstraction is wrong, not just the logic.
