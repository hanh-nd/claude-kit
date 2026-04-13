---
name: refactoring-standard
description: Rules for safely modifying existing code to improve structure without changing behavior.
version: 1.0.0
---

# 🛠️ Refactoring Standard (Legacy Improvement)

## 1. The Golden Rule: Idempotency

- **Behavior Preservation:** You MUST NOT change the external behavior of the code during a refactor.

## 2. Scope of Refactoring

- **Contextual Only:** You are only permitted to refactor code within the files identified in the current Plan.
- **Atomic Changes:** Do not mix logic features and refactoring in the same code block if it compromises readability.

## 3. Code Smell Detection & Action

If you encounter the following "smells" in the target files, you are authorized to refactor:

- **Long Method:** Break down functions longer than 30 lines into smaller, testable units.
- **Deep Nesting:** Flatten `if/else` structures using guard clauses.
- **Duplicate Logic:** Extract repeated logic into local utility functions.

## 4. Refactoring Pattern: Guard Clauses

```javascript
// BEFORE: Deeply nested
function processUser(user) {
  if (user) {
    if (user.isActive) {
      if (user.hasPermission) {
        // execute logic
      }
    }
  }
}

// AFTER: Refactored with Guard Clauses
function processUser(user) {
  if (!user || !user.isActive || !user.hasPermission) return;

  // execute logic
}
```

## 5. Safety Protocol

- **Logic Gaps:** If a refactor requires moving code to a new file that wasn't in the Plan, you MUST flag this as a "Structural Recommendation" instead of executing it blindly.
- **Transparency:** Clearly state what was refactored in the `Change Summary` section of your output.
