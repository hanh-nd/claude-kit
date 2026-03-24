# ⚡ Domain: Performance & Delivery

## 🎯 Objective

To deliver a fast, interactive experience by optimizing resource loading and execution.

## 🚀 High-Density Directives

1. **Code Splitting:** Use dynamic imports (`React.lazy`) for routes and large non-critical components (modals, charts).
2. **Image Optimization:** Use modern formats (WebP), responsive sizes (`srcset`), and lazy loading.
3. **Critical Path:** Ensure LCP (Largest Contentful Paint) elements are prioritized. No lazy loading for "above the fold" images.
4. **Memoization Strategy:** Use `useMemo` and `useCallback` only when profiling shows expensive re-computations or to prevent stable-reference breakages.

## ✅ Implementation Patterns

### Pattern: Route-Based Splitting

_Why: Reduces the initial bundle size significantly._

```typescript
const AdminPanel = React.lazy(() => import('./AdminPanel'));
```

### Pattern: Debounced Inputs

_Why: Prevents excessive processing/API calls during user typing._

```typescript
const debouncedSearch = useDebounce(query, 300);
```

## ❌ Anti-Patterns to Avoid

- **Giant Bundles:** Importing entire libraries (e.g., `lodash`) when only one function is needed.
- **Layout Shifts (CLS):** Reserving no space for images or ads, causing the page to "jump" during load.
- **Excessive Re-renders:** Passing new object references `onClick={() => ...}` to memoized children.
