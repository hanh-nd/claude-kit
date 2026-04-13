# 🎨 Domain: Styling & Visual Governance

## 🎯 Objective

To ensure a consistent visual experience that is performant, responsive, and easy to theme.

## 🚀 High-Density Directives

1. **Design Tokens First:** Use CSS Variables or Theme Objects for colors, spacing, and typography. No hardcoded hex codes.
2. **Utility-First or Scoped:** Prefer Tailwind for speed or CSS Modules for strict isolation. Avoid global "spaghetti" CSS.
3. **Layout over Margins:** Use Flexbox/Grid containers (`gap`) instead of adding `margin` to individual child components.
4. **Responsive Strategy:** Use Mobile-First media queries. Ensure the UI is functional from 320px to 2560px.

## ✅ Implementation Patterns

### Pattern: CSS Variable Theming

_Why: Allows dynamic theme switching (Dark/Light mode) without JS re-renders._

```css
:root {
  --primary: #0070f3;
}
[data-theme='dark'] {
  --primary: #3291ff;
}
.button {
  background: var(--primary);
}
```

### Pattern: Intrinsic Layouts

_Why: Reduces media query overhead by letting content define its space._

```css
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
}
```

## ❌ Anti-Patterns to Avoid

- **`!important` Abuse:** Indicates a breakdown in CSS specificity or architecture.
- **Inline Styles for Logic:** Using `style={{ color: 'red' }}` instead of data-attributes or classes.
- **Fixed Dimensions:** Using `width: 500px` on elements that should be fluid.
