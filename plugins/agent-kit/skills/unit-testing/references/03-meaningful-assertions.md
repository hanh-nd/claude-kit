# 🎯 Meaningful Assertions

A generated test must answer the question: "How do we prove this function actually did its job correctly?" Hitting a line of code for coverage is irrelevant if the outcome is not strictly verified.

## 🚫 Anti-Patterns (Avoid at all costs)

- `expect(result).toBeDefined();` (Too generic, proves nothing about the logic).
- `expect(true).toBe(true);` (Tautological garbage).
- Executing a function without any `expect` statements following it.

## ✅ The Gold Standard for Assertions

**1. Exact Payload Verification:**
When asserting that a function was called, do not just check _if_ it was called. Check _what_ it was called with using partial matching for resilience:

```typescript
expect(mockEmailService.send).toHaveBeenCalledWith(
  expect.objectContaining({
    to: 'user@test.com',
    subject: 'Welcome!', // Verify the actual business requirement
  })
);
```

**2. Strict Error Path Assertions:**
When testing a negative path (a function expected to throw), do not just assert that an error occurred. You MUST assert the exact error code or message.

```typescript
// BAD: Only checks that it failed.
await expect(login('bad_pass')).rejects.toThrow();

// GOOD: Verifies it failed for the correct business reason.
await expect(login('bad_pass')).rejects.toThrowError(
  new AuthenticationError('INVALID_CREDENTIALS')
);
```

**3. State Mutation Verification:**
If a function returns void but mutates a database or state, you must assert the mock database/state-manager was called with the exact updated parameters.
