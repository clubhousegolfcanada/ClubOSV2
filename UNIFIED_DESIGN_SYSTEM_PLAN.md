# Unified Design System - Operator & Customer Sides

## Current State Analysis

### Operator Side (Older Code)
**Characteristics:**
- **Headers**: Inconsistent - some use `text-2xl md:text-3xl`, others different
- **Layout**: `container mx-auto px-3 sm:px-4 py-4 sm:py-6` pattern
- **Components**: Dashboard cards, inline styles, no component reuse
- **Navigation**: Single Navigation.tsx handles all roles
- **Pages**: Dashboard, Messages, Tickets, Commands, Checklists, Operations

**Problems:**
- No standardized page structure
- Inline styles everywhere
- Dashboard uses custom card components
- Different padding/spacing per page
- Headers vary from page to page

### Customer Side (Newer Code)
**Characteristics:**
- **Headers**: More consistent `text-xl font-bold` pattern
- **Layout**: Attempted consistency with `px-4 py-4`
- **Components**: TabNavigation actively used, some patterns emerging
- **Navigation**: Separate CustomerNavigation component
- **Pages**: Dashboard, Profile, Compete, Leaderboard, Events

**Problems:**
- Has unused PageLayout/PageHeader components
- Compete page uses custom tabs
- Still has inline styles despite newer architecture

### Shared Infrastructure (Unused Gold Mine)
```
✅ CSS Variables System (--bg-primary, --text-primary, etc.)
✅ Theme Context (dark/light mode)
✅ Button UI Component (unused)
✅ PageLayout Component (unused)
✅ PageHeader Component (unused)
❌ No shared constants file
❌ No unified component library
```

## Unified Design System Strategy

### Core Principle: One System, Two Experiences
- **Shared foundation** - Same components, different configurations
- **Role-based styling** - CSS classes change based on user role
- **Progressive enhancement** - Start with shared base, add role-specific features

### Architecture

```
/src
├── design-system/
│   ├── components/           # Shared UI components
│   │   ├── Layout/
│   │   │   ├── PageLayout.tsx    # Universal page wrapper
│   │   │   ├── PageHeader.tsx    # Configurable header
│   │   │   └── Navigation.tsx    # Role-aware navigation
│   │   ├── UI/
│   │   │   ├── Button.tsx        # Already exists
│   │   │   ├── Card.tsx          # New - universal card
│   │   │   ├── StatCard.tsx      # New - stat display
│   │   │   ├── EmptyState.tsx    # New - empty states
│   │   │   └── TabNavigation.tsx # Exists - enhance
│   │   └── Dashboard/
│   │       ├── QuickStat.tsx     # Operator dashboard stat
│   │       └── MetricCard.tsx    # Customer metric display
│   ├── constants/
│   │   ├── styles.ts          # Universal style constants
│   │   ├── customerStyles.ts  # Customer-specific
│   │   └── operatorStyles.ts  # Operator-specific
│   └── hooks/
│       └── usePageLayout.ts   # Layout configuration hook
```

## Implementation Plan

### Phase 1: Universal Foundation (2 hours)

#### 1.1 Enhanced PageLayout Component
```tsx
// design-system/components/Layout/PageLayout.tsx
interface PageLayoutProps {
  role?: 'operator' | 'customer';
  variant?: 'dashboard' | 'detail' | 'form';
  title: string;
  subtitle?: string;
  headerActions?: ReactNode;
  tabs?: Tab[];
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  maxWidth?: string;
  padding?: string;
  children: ReactNode;
}

export const PageLayout = ({ role = 'operator', ...props }) => {
  const styles = role === 'customer' ? customerConfig : operatorConfig;
  
  return (
    <>
      <Head><title>{props.title}</title></Head>
      <div className={styles.wrapper}>
        <Navigation role={role} />
        <main className={styles.main}>
          {props.subtitle && (
            <PageHeader 
              title={props.title} 
              subtitle={props.subtitle}
              rightContent={props.headerActions}
              className={styles.header}
            />
          )}
          {props.tabs && (
            <TabNavigation 
              tabs={props.tabs}
              activeTab={props.activeTab}
              onTabChange={props.onTabChange}
              variant={role === 'customer' ? 'underline' : 'pill'}
            />
          )}
          <div className={styles.content}>
            {props.children}
          </div>
        </main>
      </div>
    </>
  );
};
```

#### 1.2 Universal Style Constants
```tsx
// design-system/constants/styles.ts
export const DS = {
  // Typography - works for both sides
  h1: {
    operator: 'text-2xl md:text-3xl font-bold text-[var(--text-primary)]',
    customer: 'text-xl font-bold text-[var(--text-primary)]'
  },
  h2: {
    all: 'text-lg font-semibold text-[var(--text-primary)]'
  },
  
  // Layout
  container: {
    operator: 'container mx-auto px-3 sm:px-4 py-4 sm:py-6',
    customer: 'max-w-7xl mx-auto px-4 py-4'
  },
  
  // Components
  card: 'bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-primary)]',
  button: {
    primary: 'px-4 py-2 bg-[#0B3D3A] text-white rounded-lg font-medium hover:bg-[#084a45] transition-colors',
    secondary: 'px-4 py-2 border border-[var(--border-primary)] rounded-lg font-medium hover:bg-[var(--bg-tertiary)]'
  }
};
```

### Phase 2: Operator Side Modernization (2 hours)

#### 2.1 Update Operator Pages
```tsx
// pages/tickets.tsx - BEFORE
<div className="min-h-screen bg-[var(--bg-primary)] pb-12">
  <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6">
    <h1 className="text-2xl md:text-3xl font-bold">Ticket Center</h1>
    ...

// AFTER
<PageLayout
  role="operator"
  title="Ticket Center - ClubOS"
  subtitle="View and manage all facilities and technical support tickets"
  variant="dashboard"
>
  <TicketCenterOptimized />
</PageLayout>
```

#### 2.2 Standardize Dashboard Components
```tsx
// Refactor dashboard to use shared components
- Replace custom QuickStat cards with StatCard component
- Use Card component for all dashboard widgets
- Apply DS constants for consistent styling
```

### Phase 3: Customer Side Activation (1 hour)

#### 3.1 Wire Up Existing Components
```tsx
// All customer pages
- Replace manual layouts with PageLayout
- Use existing PageHeader component
- Replace Compete custom tabs with TabNavigation
```

#### 3.2 Apply Universal Components
```tsx
// Use shared Card, Button, EmptyState across all pages
import { Card, Button, EmptyState } from '@/design-system/components/UI';
```

### Phase 4: Migration Strategy (1 hour)

#### 4.1 Page-by-Page Migration Order
**Operator Side (older, needs more work):**
1. Dashboard - Create reusable dashboard cards
2. Tickets - Standardize with PageLayout
3. Commands - Apply consistent headers
4. Messages - Unify with customer messaging style
5. Checklists - Standard page structure
6. Operations - Apply design system

**Customer Side (newer, easier):**
1. Dashboard - Add PageHeader
2. Compete - Replace custom tabs
3. All pages - Wrap in PageLayout

#### 4.2 Component Migration
```tsx
// Step 1: Create adapter for existing components
export const LegacyAdapter = ({ children }) => (
  <div className={DS.container.operator}>
    {children}
  </div>
);

// Step 2: Gradually replace with new components
// Step 3: Remove adapters once migrated
```

## Benefits of Unified Approach

### For Development
- **Single source of truth** - One place to update styles
- **50% less code** - Shared components between sides
- **Type safety** - TypeScript enforces consistency
- **Faster development** - Reuse components across roles

### For Users
- **Consistent experience** - Same patterns everywhere
- **Role-appropriate UI** - Operator gets dense info, customer gets clean
- **Smooth transitions** - Users with multiple roles see familiar patterns
- **Better mobile** - Unified responsive design

### For Maintenance
- **Easy updates** - Change once, update both sides
- **Clear patterns** - New developers understand quickly
- **Testable** - Component-level testing works for both
- **Scalable** - Add new roles easily

## Implementation Timeline

### Week 1: Foundation
- Day 1-2: Create design-system structure
- Day 3-4: Build universal components
- Day 5: Create style constants

### Week 2: Migration
- Day 1-2: Migrate operator dashboard
- Day 3-4: Migrate customer pages
- Day 5: Testing and polish

### Incremental Approach
Each phase can be shipped independently:
1. Ship universal components (no breaking changes)
2. Migrate one operator page at a time
3. Migrate customer pages in parallel
4. Remove old code once complete

## Success Metrics
- **Before**: 20+ different header implementations
- **After**: 1 PageHeader component with role configs
- **Before**: Inline styles in 50+ places
- **After**: DS constants used everywhere
- **Before**: 0% component reuse between sides
- **After**: 80% shared components

## Risk Mitigation
- **No business logic changes** - UI layer only
- **Incremental rollout** - Page by page
- **Backward compatible** - Old pages work during migration
- **Feature flags** - Can toggle between old/new per page

## Next Steps
1. **Approve unified approach** vs separate systems
2. **Prioritize operator or customer** first
3. **Create design-system folder** structure
4. **Start with one page** as proof of concept
5. **Measure impact** and adjust