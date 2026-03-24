# 🔄 Domain: State & Data Synchronization

## 🎯 Objective

To manage data flow efficiently, ensuring the UI stays in sync with the server and local user intent without redundant renders.

## 🚀 High-Density Directives

1. **Server vs. Client Split:** Use specialized tools (TanStack Query/SWR) for Server State. Keep Client State (Zustand/Redux) minimal.
2. **URL as Source of Truth:** Store filter, sort, and search states in the URL (query params) to ensure shareability and "back button" reliability.
3. **Optimistic Updates:** Implement optimistic UI for high-frequency actions (likes, toggles) to provide instant feedback.
4. **Derived State:** Never store data in state that can be calculated from props or other state variables.

## ✅ Implementation Patterns

### Pattern: Server State Management

_Why: Handles caching, revalidation, and loading states automatically._

```typescript
const { data } = useQuery(['user', id], () => fetchUser(id));
```

### Pattern: URL-Synced State

_Why: Enables deep-linking and state persistence across refreshes._

```typescript
const [search, setSearch] = useSearchParams();
const filter = search.get('q') || '';
```

## ❌ Anti-Patterns to Avoid

- **`useEffect` for Fetching:** Manually managing loading/error/data states with `useEffect` (leads to race conditions).
- **Duplicate State:** Storing the same data in both a global store and local component state.
- **State Over-Centralization:** Putting simple toggle states (e.g., `isModalOpen`) into a global Redux store.
