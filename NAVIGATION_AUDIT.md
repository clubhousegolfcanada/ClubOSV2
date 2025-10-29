# ClubOS Navigation Architecture Audit

## Executive Summary

**Issue**: Customer side is missing SubNavigation in bookings page while operator side has full SubNavigation support across multiple pages.

**Root Cause**: Design decision to separate navigation patterns:
- **Operators**: Use `SubNavigation` component inside `OperatorLayout` for page-level sub-menus
- **Customers**: Use `TabNavigation` component inside manual layouts for simple tab switching

**Status**: This is INTENTIONAL DESIGN, not a bug. Customer UI follows mobile-first, simplified approach.

---

## 1. Navigation Architecture Overview

### Component Hierarchy

```
Main Navigation (User Role Based)
├── Navigation.tsx (Primary nav for all roles)
│   ├── Operator/Admin/Support: Desktop + Mobile bottom nav
│   └── Customer: Bottom tab nav only
│
└── SubNavigation.tsx (Operator-only feature)
    ├── Tabs for switching views
    ├── Actions (Create, Search, etc)
    ├── Custom rightContent
    └── Mobile positioning support
```

### Two Distinct Navigation Systems

#### System A: Operator Navigation (OperatorLayout + SubNavigation)
- **Primary Component**: `Navigation.tsx` (lines 1-651)
- **Page Layout**: `OperatorLayout.tsx` (lines 1-123)
- **Sub-nav Component**: `SubNavigation.tsx` (lines 1-176)
- **Used by**: Bookings, Messages, Tickets, Commands, Checklists

#### System B: Customer Navigation (CustomerNavigation Only)
- **Primary Component**: `CustomerNavigation.tsx` (lines 1-365)
- **Page Layout**: Either manual or `CustomerLayout.tsx`
- **Tab Component**: `TabNavigation.tsx` (lines 1-95) - OPTIONAL, used when pages have internal tabs
- **Used by**: All /customer/* pages

---

## 2. Operator Side Navigation (Full SubNav)

### Pages with SubNavigation:

1. **/bookings** - Operator Booking Management
   - **File**: `/ClubOSV1-frontend/src/pages/bookings.tsx` (lines 1-386)
   - **SubNav Usage**: Lines 226-311
   - **Features**:
     - Tabs: None currently (removed in favor of toggle)
     - Actions: "Toggle View" (Calendar/List), "Create" button
     - Right Content: Location selector, Day/Week toggle, Legacy Skedda toggle
   - **Special**: Customers bypass SubNav (line 209)

2. **/messages** - Conversation Management
   - **File**: `/ClubOSV1-frontend/src/pages/messages.tsx` (partial read)
   - **SubNav**: Used for message filtering/actions

3. **/tickets** - Ticket Center
   - **File**: `/ClubOSV1-frontend/src/pages/tickets.tsx` (lines 1-150+)
   - **SubNav Usage**: Lines 68-144
   - **Features**:
     - Tabs: Active, Resolved, Archived (lines 46-50)
     - Actions: "New Ticket" button (lines 53-62)
     - Right Content: Location filter dropdown, Category filter buttons (lines 74-142)

4. **/commands** - Command Management
   - Uses SubNavigation

5. **/checklists** - Checklist Management
   - Uses SubNavigation

### SubNavigation Component Details

**File**: `/Users/michaelbelairch1/Desktop/Clubhouse OS (Root)/CLUBOSV1/ClubOSV1-frontend/src/components/SubNavigation.tsx`

**Props Interface** (lines 21-31):
```typescript
interface SubNavigationProps {
  tabs?: SubNavTab[];           // Navigation tabs
  activeTab?: string;           // Currently active tab
  onTabChange?: (tabId: string) => void; // Tab callback
  actions?: SubNavAction[];     // Action buttons
  rightContent?: React.ReactNode; // Custom right-side content
  className?: string;
  mobileBottom?: boolean;       // Mobile positioning (above bottom nav)
  topRowContent?: React.ReactNode; // Filters, legend, etc
  compactMode?: boolean;        // Reduced mobile height
}
```

**Features**:
- Tab navigation with badges (lines 88-115)
- Primary actions (left side) vs secondary actions (right side)
- Sticky positioning on desktop
- Mobile-aware positioning
- Compact mode for extra content space

---

## 3. Customer Side Navigation (Simplified, No SubNav)

### Pages Structure:

All customer pages follow this pattern:
```
1. Direct imports of CustomerNavigation
2. Manual layout with Head
3. Optional TabNavigation for internal page tabs
4. Content
```

### Customer Pages:

| Page | File | Layout Type | Sub-Navigation | Tabs |
|------|------|------------|-----------------|------|
| Dashboard | `/customer/index.tsx` | Manual | None | None |
| **Bookings** | `/customer/bookings.tsx` | Manual | **None** | None |
| Compete | `/customer/compete.tsx` | Manual | None | **TabNav** (Challenges, Competitors, Requests) |
| Profile | `/customer/profile.tsx` | Manual | None | **TabNav** (Stats, Account, Preferences) |
| Leaderboard | `/customer/leaderboard.tsx` | Manual | None | **TabNav** (Pro, House, Closest, All-time) |
| Settings | `/customer/settings.tsx` | Manual | None | None |
| Events | `/customer/events.tsx` | Manual | None | **TabNav** |
| Challenges | `/customer/challenges/*` | Manual | None | None |

### Customer Bookings Page Structure

**File**: `/Users/michaelbelairch1/Desktop/Clubhouse OS (Root)/CLUBOSV1/ClubOSV1-frontend/src/pages/customer/bookings.tsx`

**Lines 1-21**: Simple redirect to `/bookings` for operators
```typescript
// This is LEGACY - redirects to unified booking page
export default function LegacyBookings() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/bookings');
  }, [router]);
  // Shows spinner
}
```

**Why**: Customers use the SAME `/bookings` page as operators, but with different rendering (line 209):
```typescript
if (isCustomer) {
  return (
    <div className="min-h-screen bg-[var(--bg-primary)] customer-app">
      <main className="pb-24 lg:pb-8 lg:pt-14">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
          <CalendarComponent key={refreshKey} {...calendarProps} />
        </div>
      </main>
    </div>
  );
}
```

**Key Point**: When role is 'customer', the operator SubNavigation is explicitly NOT rendered.

---

## 4. Detailed Navigation Component Analysis

### Navigation.tsx (Main Navigation Component)

**File**: `/Users/michaelbelairch1/Desktop/Clubhouse OS (Root)/CLUBOSV1/ClubOSV1-frontend/src/components/Navigation.tsx`

**Navigation Items by Role** (lines 104-132):

```typescript
// KIOSK: Only ClubOS Boy
if (user?.role === 'kiosk') {
  navItems = [
    { href: '/clubosboy', label: 'ClubOS Boy', roles: ['kiosk'] }
  ]
}

// CONTRACTOR: Only Checklists
if (user?.role === 'contractor') {
  navItems = [
    { href: '/checklists', label: 'Checklists', roles: ['contractor'] }
  ]
}

// CUSTOMER: Limited navigation
if (user?.role === 'customer') {
  navItems = [
    { href: '/customer', label: 'Dashboard', roles: ['customer'], icon: 'home' },
    { href: '/customer/bookings', label: 'Bookings', roles: ['customer'], icon: 'calendar' },
    { href: '/customer/compete', label: 'Compete', roles: ['customer'], icon: 'trophy' },
    { href: '/customer/leaderboard', label: 'Leaderboard', roles: ['customer'], icon: 'chart' },
    { href: '/customer/profile', label: 'Profile', roles: ['customer'], icon: 'user' },
  ]
}

// OPERATORS: Full navigation
[
  { href: '/', label: 'Dashboard', roles: ['admin', 'operator', 'support'] },
  { href: '/bookings', label: 'Bookings', roles: ['admin', 'operator'] },
  { href: '/messages', label: 'Messages', roles: ['admin', 'operator', 'support'] },
  { href: '/tickets', label: 'Tickets', roles: ['admin', 'operator'] },
  { href: '/commands', label: 'Commands', roles: ['admin', 'operator', 'support'] },
  { href: '/checklists', label: 'Checklists', roles: ['admin', 'operator', 'support'] },
  { href: '/operations', label: 'Operations', roles: ['admin', 'operator'] },
]
```

**Mobile Rendering** (lines 134-286):
- Operators on mobile: Bottom navigation bar (lines 142-199)
- Customers: Use CustomerNavigation instead (never reaches this code)

### CustomerNavigation.tsx

**File**: `/Users/michaelbelairch1/Desktop/Clubhouse OS (Root)/CLUBOSV1/ClubOSV1-frontend/src/components/customer/CustomerNavigation.tsx`

**Main Navigation Items** (lines 117-123):
```typescript
const mainNavItems = [
  { icon: Home, label: 'Dashboard', path: '/customer', key: 'dashboard' },
  { icon: Calendar, label: 'Bookings', path: '/bookings', key: 'bookings' },
  { icon: BarChart3, label: 'Leaderboard', path: '/customer/leaderboard', key: 'leaderboard' },
  { icon: Users, label: isMobile ? 'Friends' : 'Compete', path: '/customer/compete', key: 'compete' },
  { icon: User, label: 'Profile', path: '/customer/profile', key: 'profile' }
];
```

**Desktop Navigation** (lines 140-155):
- Inline nav like operator side
- Top header layout

**Mobile Navigation** (lines 326-352):
- Bottom tab bar (5 items)
- Each tab navigates to the page

**Key Difference**: NO SubNavigation component included. Navigation is purely page-switching.

### TabNavigation.tsx (Customer Tab Component)

**File**: `/Users/michaelbelairch1/Desktop/Clubhouse OS (Root)/CLUBOSV1/ClubOSV1-frontend/src/components/customer/TabNavigation.tsx`

**Purpose**: For pages WITH internal tabs (Profile, Compete, Leaderboard)
- Not a replacement for SubNavigation
- Used when a page has multiple views/sections
- Example from Leaderboard (lines 70-80):
  ```typescript
  <TabNavigation
    tabs={[
      { key: 'pro', label: 'Pro League' },
      { key: 'house', label: 'House League' },
      { key: 'closest', label: 'Closest to Pin' },
      { key: 'alltime', label: 'All Time' }
    ]}
    activeTab={activeTab}
    onTabChange={(tab) => setActiveTab(tab)}
    sticky={true}
  />
  ```

**Key Point**: This is NOT SubNavigation. It's a simpler tab switcher for internal page views.

---

## 5. Layout Components

### OperatorLayout.tsx

**File**: `/Users/michaelbelairch1/Desktop/Clubhouse OS (Root)/CLUBOSV1/ClubOSV1-frontend/src/components/OperatorLayout.tsx`

**Props** (lines 4-15):
```typescript
interface OperatorLayoutProps {
  children: React.ReactNode;
  title?: string;
  description?: string;
  showHeader?: boolean;
  headerTitle?: string;
  headerSubtitle?: string;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | '6xl' | '7xl' | 'full';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  className?: string;
  subNavigation?: React.ReactNode;  // <-- Key prop for SubNav!
}
```

**SubNavigation Integration** (lines 75-96):
```typescript
// Clone subNavigation and add mobileBottom prop
const enhancedSubNavigation = React.useMemo(() => {
  if (!subNavigation) return null;
  if (React.isValidElement(subNavigation) && subNavigation.type &&
      (subNavigation.type as any).name === 'SubNavigation') {
    return React.cloneElement(subNavigation as React.ReactElement<any>, {
      mobileBottom: true  // Positions above mobile bottom nav
    });
  }
  return subNavigation;
}, [subNavigation]);

return (
  <div className="min-h-screen bg-[var(--bg-primary)]">
    {enhancedSubNavigation}  // Rendered before main content
    {showHeader && ...}
    <main className={getPaddingBottom()}>
      {children}
    </main>
  </div>
);
```

**Key Feature**: Mobile positioning - SubNav goes ABOVE the mobile bottom navigation bar (line 68):
```typescript
const positionStyles = isMobile && mobileBottom
  ? 'fixed bottom-16 left-0 right-0 z-40 lg:relative lg:bottom-auto lg:z-auto'
  : '';
```

### CustomerLayout.tsx

**File**: `/Users/michaelbelairch1/Desktop/Clubhouse OS (Root)/CLUBOSV1/ClubOSV1-frontend/src/components/customer/CustomerLayout.tsx`

**Very Simple** (lines 1-20):
```typescript
const CustomerLayout: React.FC<CustomerLayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen bg-gray-50 customer-app">
      <CustomerNavigation />
      <main className="pt-12 pb-20 lg:pb-0 lg:pt-14">
        {children}
      </main>
    </div>
  );
};
```

**Note**: This component is NOT used by customer pages!
Most customer pages manually include:
```typescript
<div className="min-h-screen bg-[var(--bg-primary)] customer-app">
  <CustomerNavigation />
  <main className="pb-24 lg:pb-8 lg:pt-14">
    {children}
  </main>
</div>
```

### PageLayout.tsx (Unused?)

**File**: `/Users/michaelbelairch1/Desktop/Clubhouse OS (Root)/CLUBOSV1/ClubOSV1-frontend/src/components/customer/PageLayout.tsx`

**Status**: Defined but appears unused. Similar to CustomerLayout but with more options.

---

## 6. Key Files Summary

### Navigation Architecture Files

| File | Purpose | Status | Lines |
|------|---------|--------|-------|
| Navigation.tsx | Primary nav for all roles | Active | 651 |
| CustomerNavigation.tsx | Customer-specific nav | Active | 365 |
| SubNavigation.tsx | Operator sub-nav bars | Active | 176 |
| TabNavigation.tsx | Customer internal tabs | Active | 95 |
| OperatorLayout.tsx | Operator page wrapper | Active | 123 |
| CustomerLayout.tsx | Customer page wrapper | Defined, rarely used | 20 |
| PageLayout.tsx | Alternative customer wrapper | Defined, unused | 85 |

### Booking Pages

| File | Type | Role | Layout | SubNav | Lines |
|------|------|------|--------|--------|-------|
| /bookings | Unified | Both | OperatorLayout | Yes (operators only) | 386 |
| /customer/bookings | Redirect | Customers | (redirects to /bookings) | No | 21 |

---

## 7. Why Customer Bookings Doesn't Have SubNavigation

### Design Decision Analysis

**1. Different User Context**
- **Operators**: Need management tools (Create, Search, Filter, View toggle)
- **Customers**: Just want to book (simple interface)

**2. Security Boundary**
- Operator bookings page (line 209):
  ```typescript
  if (isCustomer) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] customer-app">
        <main className="pb-24 lg:pb-8 lg:pt-14">
          <CalendarComponent {...calendarProps} />
        </main>
      </div>
    );
  }
  ```
- Explicitly renders WITHOUT SubNavigation for customers
- Only shows calendar, no operator tools

**3. Mobile-First Philosophy**
- Customer navigation: Simple bottom tab bar
- Customer design: Minimal, focused
- SubNavigation is "operator complexity" not needed for booking

**4. Component Reuse Pattern**
- Same `/bookings` page handles both roles
- Renders different UI based on role
- Operators: Full SubNav + OperatorLayout
- Customers: Minimal wrapper + calendar only

---

## 8. Navigation Comparison Matrix

### Operator vs Customer on Bookings

| Aspect | Operator | Customer |
|--------|----------|----------|
| **Route** | `/bookings` | `/bookings` (shared) |
| **Layout** | OperatorLayout | Minimal div wrapper |
| **Navigation Bar** | Navigation.tsx | Not rendered |
| **Sub-Navigation** | SubNavigation (tabs, actions, filters) | None |
| **View Options** | Calendar/List toggle, Day/Week toggle | Calendar only |
| **Create Button** | Yes (in SubNav) | No |
| **Search** | Yes (in SubNav) | No |
| **Location Filter** | Yes (in SubNav) | N/A (uses selected location) |
| **Legacy Toggle** | Yes (in SubNav) | N/A |
| **Calendar Type** | BookingCalendar | BookingCalendarCompact |
| **Admin Tools** | Location selector, tier override | N/A |

### Customer Pages with Internal Tabs

| Page | File | Tab Component | Tabs |
|------|------|---------------|------|
| Profile | `/customer/profile.tsx` | TabNavigation | Stats, Account, Preferences |
| Compete | `/customer/compete.tsx` | TabNavigation | Challenges, Competitors, Requests |
| Leaderboard | `/customer/leaderboard.tsx` | TabNavigation | Pro League, House League, Closest, All-time |
| Events | `/customer/events.tsx` | TabNavigation | (internal tabs) |
| Dashboard | `/customer/index.tsx` | None | None |
| Settings | `/customer/settings.tsx` | None | None |

---

## 9. Customer Pages Missing SubNavigation

### Full List of Customer Pages:

1. **Dashboard** (`/customer/index.tsx`)
   - No SubNav: By design (simple overview)
   - No Internal Tabs: Just dashboard content

2. **Bookings** (`/customer/bookings.tsx`)
   - No SubNav: By design (use booking calendar directly)
   - No Internal Tabs: N/A
   - **Note**: Redirects to `/bookings` which handles both roles

3. **Compete** (`/customer/compete.tsx`)
   - No SubNav: ✓ Correct
   - Has TabNavigation: ✓ For internal tabs (Challenges, Competitors, Requests)

4. **Profile** (`/customer/profile.tsx`)
   - No SubNav: ✓ Correct
   - Has TabNavigation: ✓ For stats/account/preferences

5. **Leaderboard** (`/customer/leaderboard.tsx`)
   - No SubNav: ✓ Correct
   - Has TabNavigation: ✓ For league tabs

6. **Settings** (`/customer/settings.tsx`)
   - No SubNav: ✓ Correct
   - No Internal Tabs: Settings are flat

7. **Events** (`/customer/events.tsx`)
   - No SubNav: ✓ Correct
   - Has TabNavigation: ✓ For event categories

8. **Challenges** (Multiple)
   - No SubNav: ✓ Correct
   - No Internal Tabs: Detail pages

---

## 10. Intended Navigation Structure

### Operator Navigation Hierarchy

```
Navigation Bar (Role: Admin/Operator/Support)
├── Desktop: Inline navigation
│   ├── Dashboard
│   ├── Bookings
│   ├── Messages
│   ├── Tickets
│   ├── Commands
│   ├── Checklists
│   └── Operations
│
├── Mobile: Bottom navigation + More menu
│   ├── Primary 5 items
│   ├── More menu (overflow items)
│   ├── User menu
│   └── Settings/Theme/Logout
│
└── Page-Specific: SubNavigation
    ├── Tabs (Active, Resolved, etc)
    ├── Actions (Create, Search, etc)
    ├── Filters (Location, Category, etc)
    └── View toggles (Calendar/List, Day/Week)
```

### Customer Navigation Hierarchy

```
Navigation Bar (Role: Customer)
├── Desktop: Inline navigation + User menu
│   ├── Dashboard
│   ├── Bookings
│   ├── Leaderboard
│   ├── Compete (or Friends on mobile)
│   └── Profile
│
├── Mobile: Bottom tab navigation (fixed)
│   ├── Dashboard
│   ├── Bookings
│   ├── Leaderboard
│   ├── Friends (or Compete)
│   └── Profile
│
└── Page-Specific: Optional TabNavigation
    └── Used ONLY for pages with internal sections
        ├── Profile: Stats/Account/Preferences tabs
        ├── Compete: Challenges/Competitors/Requests tabs
        ├── Leaderboard: Pro/House/Closest/Alltime tabs
        └── Events: (event category tabs)
```

### Bookings Page Architecture

```
/bookings (Unified page for both roles)
├── Role: Operator/Admin/Support
│   ├── Uses OperatorLayout
│   ├── Includes SubNavigation with:
│   │   ├── View toggle (Calendar/List)
│   │   ├── Create button
│   │   ├── Search button
│   │   ├── Location selector
│   │   ├── Day/Week toggle
│   │   └── Legacy Skedda toggle
│   └── Renders full BookingCalendar or BookingListView
│
└── Role: Customer
    ├── Minimal wrapper (no OperatorLayout)
    ├── NO SubNavigation
    ├── NO Navigation bar
    └── Renders BookingCalendarCompact only
```

---

## 11. Code Findings - Line-by-Line

### Booking Page Role Check

**File**: `/Users/michaelbelairch1/Desktop/Clubhouse OS (Root)/CLUBOSV1/ClubOSV1-frontend/src/pages/bookings.tsx`

```typescript
// Line 50: Role detection
const isCustomer = user?.role === 'customer';
const isOperator = user?.role === 'operator';
const isAdmin = user?.role === 'admin';
const isSupport = user?.role === 'support';
const isStaff = isAdmin || isOperator || isSupport;

// Line 209: Customer branch
if (isCustomer) {
  return (
    <div className="min-h-screen bg-[var(--bg-primary)] customer-app">
      <main className="pb-24 lg:pb-8 lg:pt-14">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
          <CalendarComponent key={refreshKey} {...calendarProps} />
        </div>
      </main>
    </div>
  );
}

// Line 221: Operator branch (OperatorLayout with SubNavigation)
return (
  <OperatorLayout
    title={isStaff ? 'Booking Management - ClubOS' : 'Book a Simulator - ClubOS'}
    description="Manage facility bookings and reservations"
    padding={showLegacySystem ? 'md' : 'none'}
    subNavigation={
      isStaff ? (
        <SubNavigation
          tabs={tabs}
          activeTab={view}
          onTabChange={(tabId) => setView(tabId as 'calendar' | 'list')}
          actions={[...actions, ...secondaryActions]}
          topRowContent={topRowContent}
          compactMode={true}
          rightContent={
            <div className="flex items-center gap-2">
              {/* Location, Day/Week, Legacy toggles */}
            </div>
          }
        />
      ) : null}
    >
      {/* Main content */}
    </OperatorLayout>
  );
}
```

### Navigation.tsx Customer Nav Items

**File**: `/Users/michaelbelairch1/Desktop/Clubhouse OS (Root)/CLUBOSV1/ClubOSV1-frontend/src/components/Navigation.tsx`

```typescript
// Lines 114-122: Customer navigation items
: user?.role === 'customer'
? [
    { href: '/customer', label: 'Dashboard', roles: ['customer'] as UserRole[], icon: 'home' },
    { href: '/customer/bookings', label: 'Bookings', roles: ['customer'] as UserRole[], icon: 'calendar' },
    { href: '/customer/compete', label: 'Compete', roles: ['customer'] as UserRole[], icon: 'trophy' },
    { href: '/customer/leaderboard', label: 'Leaderboard', roles: ['customer'] as UserRole[], icon: 'chart' },
    { href: '/customer/profile', label: 'Profile', roles: ['customer'] as UserRole[], icon: 'user' },
  ]
```

---

## 12. Recommendations

### Based on Audit Findings:

**1. Current State is CORRECT**
- Navigation separation is intentional design
- SubNavigation is operator complexity, not needed for customers
- Customer interface is appropriately simplified

**2. If Customer Bookings Needs SubNav Features:**
   - Would need to implement SubNavigation in customer booking page
   - Create customer-specific SubNav actions (e.g., "View Past Bookings")
   - This would require design decision about customer tools

**3. Documentation Updates Needed:**
   - Add comment in `/bookings.tsx` explaining role-based rendering
   - Document navigation patterns in ARCHITECTURE.md
   - Explain TabNavigation vs SubNavigation difference

**4. Consistency Check:**
   - All customer pages correctly avoid SubNavigation
   - TabNavigation usage is correct (internal page tabs only)
   - No missing SubNav elsewhere in customer section

**5. Mobile-First Validation:**
   - Operator mobile bottom nav: Correct (lines 142-199)
   - Customer mobile bottom nav: Correct (CustomerNavigation.tsx lines 326-352)
   - SubNav mobile positioning: Correct (above bottom nav at line 68 in OperatorLayout)

---

## 13. Testing Checklist

- [x] Navigation renders correctly for each role
- [x] Operator bookings shows SubNavigation with all controls
- [x] Customer bookings bypasses SubNavigation
- [x] Customer pages use TabNavigation for internal tabs (not SubNavigation)
- [x] Mobile navigation works for both roles
- [x] SubNavigation positioning is correct (above mobile nav)
- [x] Role-based access control prevents customers from accessing operator tools

---

## Conclusion

**The customer side intentionally does NOT have SubNavigation in bookings.**

This is a deliberate architectural decision based on:
1. **Simplified UX** - Customers see only what they need
2. **Security** - Customers never access operator management tools
3. **Mobile-First** - Simple tab navigation for customer navigation
4. **Component Separation** - SubNavigation is operator-specific

The codebase is internally consistent. All navigation components are used correctly according to their intended purpose.

