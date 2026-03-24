# 🛑 Type Safety Anti-Cheat Rules

When writing Unit Tests in a statically typed environment (like TypeScript), you must never bypass the type system to force a test to compile. The type system is the first layer of testing.

## 🚫 Hard Bans (Strictly Forbidden)

1. **No `any`**: You must never cast mock data, arguments, or return values to `any`.
2. **No Suppression**: The use of `@ts-ignore` or `@ts-expect-error` to hide missing properties or type mismatches is strictly prohibited.
3. **No Blind Casting**: Using `as T` on empty objects (e.g., `const user = {} as User;`) is an immediate failure.

## ✅ Mandatory Solutions

Instead of cheating, use native utility types to create valid, type-safe mocks:

**1. Use `Partial<T>` for Data Payloads:**
If a function requires a `User` object (which has 50 fields) but only reads `id` and `email`, use `Partial` to maintain type safety on the fields you do provide:

```typescript
// GOOD: The compiler still checks if 'id' and 'email' are valid properties of User.
const mockUser: Partial<User> = { id: 1, email: 'test@domain.com' };
```

**2. Use Specific Mock Types for Functions:**

```typescript
// GOOD: Retains the exact argument and return types of the original function.
jest.spyOn(db.user, 'findUnique').mockResolvedValue({ id: 1, role: 'ADMIN' });
```

**3. Use `createMock<T>` Utility:**
If a function requires a complex object with many optional fields, use the `createMock` utility to generate a type-safe mock.

```typescript
// GOOD: The compiler checks if the mock function has the correct signature.
const mockUser = createMock<User>({ id: 1 });
```
