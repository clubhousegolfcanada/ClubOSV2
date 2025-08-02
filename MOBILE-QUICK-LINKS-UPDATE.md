# Mobile Quick Links Collapse Update

## Summary
Updated the Quick Links section in the dashboard to be collapsed by default on mobile devices to reduce visual clutter.

## Changes Made

### DatabaseExternalTools.tsx
1. Added `isLinksCollapsed` state that defaults to `true` on mobile devices
2. Added mobile detection using window width < 640px (sm breakpoint)
3. Made the Quick Links header clickable to toggle collapse state
4. Added chevron icon and item count when collapsed
5. Preserved user preference in localStorage

## Behavior

### Mobile (< 640px width)
- Quick Links section is **collapsed by default**
- Shows "X tools" count when collapsed
- Tap header to expand/collapse
- User preference is saved and persists

### Desktop (≥ 640px width)
- Quick Links section is **expanded by default**
- Same toggle functionality available
- Edit button only shows when expanded

## Technical Details
- Uses Tailwind's sm breakpoint (640px) for mobile detection
- Smooth CSS transitions for expand/collapse animation
- localStorage key: `linksSectionCollapsed`
- Responsive resize handler updates behavior when switching between mobile/desktop