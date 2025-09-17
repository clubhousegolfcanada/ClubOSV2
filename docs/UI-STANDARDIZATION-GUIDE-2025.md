# ClubOS UI Standardization Guide
**Version**: 1.0.0
**Date**: September 2025
**Status**: OFFICIAL GUIDELINES

## Executive Summary

After thorough investigation of the Dashboard and existing ClubOS patterns, this guide establishes the **official UI standards** that all components must follow. The Dashboard page demonstrates the correct implementation that Operations Center pages should adopt.

## Core Design System - Dashboard Pattern

### 1. Layout Structure

#### Master Container
```tsx
<main className="min-h-screen bg-[var(--bg-primary)] pb-12">
  <div className="container mx-auto px-4 py-2 md:py-3 lg:py-4">
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6">
      {/* Content */}
    </div>
  </div>
</main>
```

**Key Principles:**
- `min-h-screen` for full viewport height
- `bg-[var(--bg-primary)]` for theme-aware background
- Responsive padding: `px-4` mobile, increases on larger screens
- 12-column grid system on large screens
- Consistent gap spacing: `gap-4 lg:gap-6`

### 2. The "Card" Container Pattern

#### Standard Card Component
```css
.card {
  @apply bg-[var(--bg-secondary)]
         border border-[var(--border-primary)]
         rounded-xl
         p-3
         mb-3
         transition-all duration-300;
}
```

**This is THE standard container** used throughout Dashboard:
- `DatabaseExternalTools` ✅
- `MessagesCardV3` ✅
- `RequestForm` ✅
- `SuggestedActions` ✅
- `OccupancyMap` ✅

### 3. CSS Variable System (Already Established)

#### Color Variables
```css
:root {
  /* Backgrounds */
  --bg-primary: #ffffff;
  --bg-secondary: #f9fafb;
  --bg-tertiary: #f3f4f6;
  --bg-hover: #e5e7eb;

  /* Text */
  --text-primary: #111827;
  --text-secondary: #6b7280;
  --text-muted: #9ca3af;

  /* Borders */
  --border-primary: #e5e7eb;
  --border-secondary: #d1d5db;

  /* Accent */
  --accent: #0B3D3A;
  --accent-hover: #084a45;
}
```

### 4. Mobile-First Responsive Patterns

#### Responsive Grid
```tsx
// Mobile: Single column
// Desktop: Multi-column with specific spans
<div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
  <div className="lg:col-span-8">Main Content</div>
  <div className="lg:col-span-4">Sidebar</div>
</div>
```

#### Responsive Visibility
```tsx
// Mobile only
<div className="block lg:hidden">Mobile Content</div>

// Desktop only
<div className="hidden lg:block">Desktop Content</div>
```

### 5. Component Header Pattern

#### Standard Section Header
```tsx
<div className="px-3 py-2 border-b border-primary flex items-center justify-between">
  <h3 className="text-sm font-semibold text-primary">
    Section Title
  </h3>
  <button className="text-xs text-secondary hover:text-primary transition-colors">
    Action
  </button>
</div>
```

### 6. Form Elements Pattern

#### Standard Form Group
```tsx
<div className="form-group">
  <label className="form-label">Label</label>
  <input className="form-input" />
  <p className="form-helper">Helper text</p>
</div>
```

Defined in globals.css:
- `.form-group`: `mb-3`
- `.form-label`: `text-xs font-medium uppercase tracking-wider text-[var(--text-secondary)] mb-2`
- `.form-input`: Full theming with focus states

## Operations Center Refactoring Requirements

### Current Issues vs Dashboard Standard

| Component | Current State | Required Changes |
|-----------|--------------|------------------|
| **White Label** | Custom container with hardcoded colors | Use `.card` class |
| **White Label** | White text on white background bug | Fix with CSS variables |
| **Users** | `bg-white`, `text-gray-900` hardcoded | Replace with CSS variables |
| **Integrations** | `bg-purple-100`, custom colors | Use theme variables |
| **Checklists Admin** | Different layout pattern | Align with Dashboard grid |
| **All Operations** | Inconsistent container patterns | Standardize to `.card` |

### Scalable Container Pattern

```tsx
// ✅ CORRECT - Dashboard Pattern (Scalable)
const StandardContainer: React.FC<{ title?: string; children: React.ReactNode }> = ({
  title,
  children
}) => (
  <div className="card">
    {title && (
      <div className="px-3 py-2 border-b border-primary flex items-center justify-between">
        <h3 className="text-sm font-semibold text-primary">{title}</h3>
      </div>
    )}
    <div className="p-3">
      {children}
    </div>
  </div>
);

// ❌ INCORRECT - Current Operations Pattern
<div className="bg-white rounded-lg shadow-sm border border-gray-200">
  {/* Hardcoded colors, inconsistent spacing */}
</div>
```

### Tab Navigation Pattern (From Dashboard)

```tsx
// Dashboard uses clean, accessible tabs
<nav className="flex space-x-1 overflow-x-auto pb-px">
  {tabs.map((tab) => (
    <button
      className={`
        px-4 py-3 text-sm font-medium border-b-2 transition-all
        ${activeTab === tab.id
          ? 'border-[var(--accent)] text-[var(--accent)]'
          : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
        }
      `}
    >
      {tab.label}
    </button>
  ))}
</nav>
```

## Implementation Priority

### Phase 1: Critical Fixes (Immediate)
1. Fix White Label tab visibility (white on white bug)
2. Replace all hardcoded colors with CSS variables

### Phase 2: Container Standardization (Week 1)
1. Convert all Operations components to use `.card` class
2. Implement consistent spacing patterns
3. Align headers with Dashboard pattern

### Phase 3: Layout Alignment (Week 2)
1. Implement Dashboard grid system
2. Add proper responsive breakpoints
3. Standardize mobile/desktop visibility patterns

## Code Quality Standards

### Component Structure
```tsx
// Standard component with proper typing and error boundaries
export const OperationsComponent: React.FC<Props> = ({ data }) => {
  // Hooks first
  const [state, setState] = useState();

  // Effects second
  useEffect(() => {}, []);

  // Handlers third
  const handleAction = () => {};

  // Render
  return (
    <ErrorBoundary>
      <div className="card">
        {/* Content using CSS variables */}
      </div>
    </ErrorBoundary>
  );
};
```

### CSS Variable Usage
```tsx
// ✅ CORRECT
className="bg-[var(--bg-secondary)] text-[var(--text-primary)]"

// ❌ INCORRECT
className="bg-white text-gray-900"
```

### Responsive Classes
```tsx
// ✅ CORRECT - Mobile-first
className="px-4 sm:px-6 lg:px-8"

// ❌ INCORRECT - Desktop-first
className="px-8 md:px-6 sm:px-4"
```

## Testing Checklist

Before any component is approved:

- [ ] Uses `.card` class for containers
- [ ] All colors use CSS variables
- [ ] Responsive on 320px-428px screens
- [ ] Follows Dashboard grid pattern
- [ ] Headers match standard pattern
- [ ] Forms use `.form-*` classes
- [ ] No hardcoded colors
- [ ] Proper TypeScript typing
- [ ] Error boundaries in place
- [ ] Tested in light/dark themes

## Migration Example

### Before (Operations Users)
```tsx
<div className="bg-white rounded-lg shadow-sm border border-gray-200">
  <div className="px-6 py-4 border-b border-gray-200">
    <h2 className="text-lg font-semibold text-gray-900">Users</h2>
  </div>
</div>
```

### After (Dashboard Standard)
```tsx
<div className="card">
  <div className="px-3 py-2 border-b border-primary flex items-center justify-between">
    <h3 className="text-sm font-semibold text-primary">Users</h3>
  </div>
</div>
```

## Conclusion

The Dashboard page demonstrates the **correct, scalable UI patterns** that should be used throughout ClubOS. All Operations Center components must be refactored to match these standards. The `.card` class and CSS variable system are already established and must be used consistently.

**Key Takeaway**: Don't create new patterns - use what's already working in the Dashboard.

## Appendix: Available Utility Classes

### From globals.css
- `.card` - Standard container
- `.form-group`, `.form-label`, `.form-input` - Form elements
- `.text-primary`, `.text-secondary`, `.text-muted` - Text colors
- `.bg-primary`, `.bg-secondary`, `.bg-tertiary` - Backgrounds
- `.border-primary`, `.border-secondary` - Borders
- `.button-primary`, `.button-secondary` - Buttons

### From Tailwind + CSS Variables
- `bg-[var(--bg-primary)]` - Theme-aware backgrounds
- `text-[var(--text-primary)]` - Theme-aware text
- `border-[var(--border-primary)]` - Theme-aware borders

**Note**: Always prefer CSS variables over Tailwind's default colors for theme consistency.