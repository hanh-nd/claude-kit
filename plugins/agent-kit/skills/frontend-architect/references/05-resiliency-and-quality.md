# 🛡️ Domain: Resiliency & Quality

## 🎯 Objective

To build a UI that is accessible to all users and recovers gracefully from failures.

## 🚀 High-Density Directives

1. **Semantic HTML:** Use `<button>`, `<nav>`, `<main>`, `<header>` correctly. ARIA should be the fallback, not the first choice.
2. **Error Boundaries:** Wrap major feature areas in Error Boundaries to prevent a single component crash from taking down the whole app.
3. **Form Safety:** Validate inputs on the client (Zod) and server. Provide clear, accessible error messages.
4. **E2E Critical Paths:** Write Playwright/Cypress tests for "Money Flows" (Checkout, Login, Core Workflows).

## ✅ Implementation Patterns

### Pattern: Accessible Buttons

_Why: Ensures screen readers and keyboard users can interact with the UI._

```jsx
<button aria-label="Close modal" onClick={close}>
  <IconClose />
</button>
```

### Pattern: Feature-Level Error Boundary

_Why: Localizes crashes to the specific feature._

```jsx
<ErrorBoundary fallback={<FeatureError />}>
  <ComplexDashboard />
</ErrorBoundary>
```

## ❌ Anti-Patterns to Avoid

- **Div-Buttons:** Using `<div onClick={...}>` without `tabIndex` or `role="button"`.
- **Silent Failures:** Catching errors in `useEffect` and not showing any UI feedback to the user.
- **Testing Implementation Details:** Testing "if the state changed" instead of "if the user sees the correct output."
