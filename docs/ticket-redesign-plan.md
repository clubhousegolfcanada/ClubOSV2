# Ticket Page Redesign Plan

## Current Analysis

### Issues Found:
1. **Ticket Page**: Too compact, especially on mobile (small text, cramped spacing)
2. **Checklist Page**: Too much padding/spacing
3. **Inconsistent Design**: Not aligned with dashboard/messages pages

### Design References:
- **Dashboard (index.tsx)**: Clean cards, good spacing, mobile-friendly grid
- **Messages Page**: Excellent mobile layout with proper spacing, clear hierarchy
- **Checklists**: Overly spacious, needs tightening

## Redesign Goals

### 1. Mobile-First Approach
- Larger touch targets (minimum 44px)
- Better spacing between interactive elements
- Readable text sizes (minimum 14px for body text)
- Clear visual hierarchy

### 2. Design Consistency
- Match dashboard card styling
- Use consistent spacing patterns:
  - Container: `px-3 sm:px-4 py-4 sm:py-6`
  - Card padding: `p-4`
  - Section spacing: `mb-6`
  - Item spacing: `space-y-3` or `gap-3`

### 3. Improved Layout
- Better use of screen real estate
- Clear ticket cards with proper breathing room
- Mobile-optimized filter pills
- Improved modal design for ticket details

## Implementation Changes

### TicketCenterOptimized Component Updates:

1. **Container Spacing**
   - Change from compact to standard ClubOS spacing
   - Match dashboard container patterns

2. **Ticket Cards**
   - Increase padding from `p-3` to `p-4`
   - Larger text sizes (from text-xs to text-sm for main content)
   - Better visual separation between tickets
   - More prominent priority indicators

3. **Filter Pills**
   - Larger touch targets
   - Better spacing between pills
   - More visible active state

4. **Mobile Modal**
   - Full-screen on mobile with proper safe areas
   - Larger text and better spacing
   - Improved comment section

5. **Typography Scale**
   - Title: text-base (16px) instead of text-xs (12px)
   - Body: text-sm (14px) instead of text-xs
   - Meta: text-xs (12px) for secondary info only

## Next Steps
1. Update TicketCenterOptimized component
2. Test on mobile devices
3. Ensure consistency with other pages
4. Update README and CHANGELOG