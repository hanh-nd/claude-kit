# 🏛️ Domain: Component Architecture

## 🎯 Objective

To build a scalable, predictable component tree that prioritizes reusability and minimizes side effects.

## 🚀 High-Density Directives

1. **Composition > Props:** Use `children` or render props to avoid deep prop-drilling and "God Components" that handle too many responsibilities.
2. **Logic Separation (Headless):** Extract complex UI logic into custom hooks. Components should primarily be "View" layers.
3. **Atomic Boundaries:** Follow Atomic Design (Atoms, Molecules, Organisms). A Molecule should never depend on an Organism.
4. **Controlled vs. Uncontrolled:** Default to uncontrolled components (using `ref`) for performance-critical inputs; use controlled state only when synchronization is required.

## ✅ Implementation Patterns

### Pattern: Compound Components

_Why: Provides flexibility for the consumer while maintaining internal state consistency._

```jsx
<Tabs>
  <Tabs.List>
    <Tabs.Trigger value="1">Tab 1</Tabs.Trigger>
  </Tabs.List>
  <Tabs.Content value="1">Panel 1</Tabs.Content>
</Tabs>
```

### Pattern: Headless Hooks

_Why: Separates business logic from the DOM representation._

```typescript
const { data, isLoading, error } = useProductList({ category: 'tech' });
// Render UI using the data
```

## ❌ Anti-Patterns to Avoid

- **Prop-Drilling:** Passing data through >3 layers of components. Use Context or a state manager.
- **Inline Complex Logic:** Putting `useEffect` with >10 lines of logic inside a UI component.
- **Implicit Dependencies:** Components relying on global window objects or external state without proper injection.
