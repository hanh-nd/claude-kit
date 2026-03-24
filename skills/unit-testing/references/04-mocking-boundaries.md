# 🧱 Mocking Boundaries & Absolute Isolation

Unit tests must be 100% isolated from the outside world. Any test that attempts to make a real network request, write to a real filesystem, or query a real database is an integration test and violates this protocol.

## 🛠️ Mandatory Mocking Rules

**1. Databases & ORMs:**

- Never initialize a real database connection.
- If the project uses an ORM (like Prisma, TypeORM, or Mongoose), mock the client or repository layer entirely.

```typescript
import { prisma } from '../lib/prisma';
jest.mock('../lib/prisma', () => ({
  prisma: { user: { create: jest.fn(), findUnique: jest.fn() } },
}));
```

**2. Third-Party APIs (HTTP Requests):**
All calls utilizing fetch, axios, or dedicated SDKs (like AWS SDK or Stripe) must be stubbed. They must return the exact expected structural response (including status codes and headers if the source code evaluates them).

**3. Time and Randomness (Determinism):**
Tests must pass regardless of the time of day or the machine they run on. If the logic relies on Date.now(), setTimeout, or token expirations, you MUST freeze time.

```typescript
// Freeze time to ensure deterministic behavior
beforeAll(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-03-14T10:00:00Z'));
});
afterAll(() => {
  jest.useRealTimers();
});
```

If the logic uses Math.random() or generates UUIDs, mock the generator to return a predictable, static string/number.
