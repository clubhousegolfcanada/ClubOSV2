# Mobile Dashboard Updates Implementation Plan

## Overview
Remove bay status card and add collapsible functionality to messages card on mobile operations dashboard.

## Current Structure Analysis

### File: `/src/pages/index.tsx` (Main Dashboard)
- **Line 349**: `<OccupancyMap compact />` - Bay Status card
- **Line 331**: `<MessagesCardV3 />` - Messages card
- Both components are wrapped in `SectionErrorBoundary`

### Component Details

#### OccupancyMap Component (`/src/components/dashboard/OccupancyMap.tsx`)
- Shows bay occupancy for all locations
- Polls every 30 seconds for updates
- Has compact mode prop for dashboard view
- Clickable to navigate to commands page

#### MessagesCardV3 Component (`/src/components/dashboard/MessagesCardV3.tsx`)
- Shows last 3 conversations
- Polls every 10 seconds for updates
- Has expandable conversation details
- Includes AI suggestion feature

## Implementation Tasks

### Task 1: Remove Bay Status Card on Mobile
**File**: `/src/pages/index.tsx`

**Changes**:
1. Wrap OccupancyMap component with a conditional render
2. Add `hidden lg:block` classes to hide on mobile
3. Keep desktop functionality intact

**Implementation**:
```tsx
{/* Desktop-only Bay Status */}
<div className="hidden lg:block">
  <SectionErrorBoundary section="Occupancy Map" compact>
    <OccupancyMap compact />
  </SectionErrorBoundary>
</div>
```

### Task 2: Add Collapsible Messages Card
**File**: `/src/components/dashboard/MessagesCardV3.tsx`

**Changes**:
1. Add collapse state management
2. Add header with toggle button
3. Implement smooth collapse animation
4. Persist collapse state in localStorage
5. Show unread count when collapsed

**New Features**:
- Collapse/expand button in header
- Animated height transition
- Badge showing unread count when collapsed
- Mobile-optimized touch targets

**Implementation Details**:
```tsx
// Add state
const [isCollapsed, setIsCollapsed] = useState(false);

// Load saved state
useEffect(() => {
  const saved = localStorage.getItem('messages-collapsed');
  if (saved === 'true') setIsCollapsed(true);
}, []);

// Toggle function
const toggleCollapse = () => {
  const newState = !isCollapsed;
  setIsCollapsed(newState);
  localStorage.setItem('messages-collapsed', newState.toString());
};
```

## Testing Checklist

### Mobile Testing (< 1024px)
- [ ] Bay status card NOT visible
- [ ] Messages card visible with collapse button
- [ ] Collapse/expand animation smooth
- [ ] Unread badge shows when collapsed
- [ ] State persists on refresh
- [ ] Touch targets are 44px minimum

### Desktop Testing (>= 1024px)
- [ ] Bay status card visible
- [ ] Messages card has collapse functionality
- [ ] All existing features work
- [ ] No layout shifts

### Edge Cases
- [ ] Empty conversations list
- [ ] Loading states
- [ ] Error boundaries work
- [ ] Polling continues when collapsed
- [ ] Authentication errors handled

## Rollback Plan
If issues occur:
1. Remove collapse state code from MessagesCardV3
2. Remove conditional rendering from index.tsx
3. Git revert if needed

## Files to Modify
1. `/src/pages/index.tsx` - Hide bay status on mobile
2. `/src/components/dashboard/MessagesCardV3.tsx` - Add collapse feature

## No Side Effects Confirmed
- ✅ OccupancyMap used only in index.tsx (dashboard)
- ✅ MessagesCardV3 used only in index.tsx
- ✅ No shared state dependencies
- ✅ Error boundaries already in place
- ✅ Mobile-first CSS approach safe