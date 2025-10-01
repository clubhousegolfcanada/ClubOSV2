# Ticket Page Mobile Optimization Implementation Plan

## Overview
Refactor the ticket page to match ClubOS dashboard patterns, improve mobile usability, and prepare for 6+ location expansion.

## Implementation Steps

### Step 1: Create New Component Structure
Break down the monolithic TicketCenterOptimized.tsx (779 lines) into:

1. **components/tickets/TicketCard.tsx** - Individual ticket display
2. **components/tickets/TicketFilters.tsx** - Location/status/category filters
3. **components/tickets/TicketDetailModal.tsx** - Full detail view
4. **components/tickets/TicketList.tsx** - Main container
5. **hooks/useTickets.ts** - Data fetching and state management

### Step 2: Standardize Card Structure
```tsx
// Before: Custom styling
<div className="max-w-7xl mx-auto">

// After: Standard card
<div className="card">
  <div className="flex items-center justify-between mb-3">
    <h3 className="text-sm font-semibold">Ticket Center</h3>
    <button className="btn-primary">New Ticket</button>
  </div>
```

### Step 3: Replace Horizontal Location Filter
```tsx
// Before: Horizontal scroll pills
<div className="flex gap-2 overflow-x-auto">
  {locations.map(loc => <button>{loc}</button>)}
</div>

// After: Vertical collapsible list
<div className="card mt-4">
  <button onClick={toggleLocations} className="w-full flex justify-between">
    <span className="text-sm font-semibold">
      <MapPin className="w-4 h-4" />
      {selectedLocation || 'All Locations'}
    </span>
    <ChevronDown />
  </button>
  {showLocations && (
    <div className="space-y-1 mt-2">
      {locations.map(location => (
        <div className="p-2 rounded hover:bg-[var(--bg-tertiary)]">
          <MapPin /> {location}
          <span className="ml-auto badge">{counts[location]}</span>
        </div>
      ))}
    </div>
  )}
</div>
```

### Step 4: Simplify Ticket Cards
```tsx
// Match TaskList item pattern
<div className="p-3 bg-[var(--bg-primary)] hover:bg-[var(--bg-tertiary)] group rounded-lg">
  <div className="flex items-start gap-3">
    {/* Priority as colored left border */}
    <div className={`w-1 self-stretch rounded ${priorityColors[ticket.priority]}`} />

    <div className="flex-1 min-w-0">
      <h4 className="font-medium text-sm truncate">{ticket.title}</h4>
      <div className="flex flex-wrap gap-2 mt-1 text-xs text-[var(--text-muted)]">
        <span>{ticket.category}</span>
        <span>•</span>
        <span>{ticket.location}</span>
        <span>•</span>
        <span>{formatTimeAgo(ticket.createdAt)}</span>
      </div>
    </div>

    {/* Actions visible on hover/focus */}
    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
      <button className="p-2 hover:bg-[var(--bg-secondary)] rounded">
        <Check className="w-4 h-4" />
      </button>
      <button className="p-2 hover:bg-[var(--bg-secondary)] rounded">
        <Archive className="w-4 h-4" />
      </button>
    </div>
  </div>
</div>
```

### Step 5: Mobile-Optimized Modal
```tsx
// Full-screen on mobile, centered on desktop
<div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
  <div className="bg-[var(--bg-primary)] w-full sm:max-w-2xl h-[90vh] sm:h-auto sm:max-h-[90vh] rounded-t-2xl sm:rounded-lg flex flex-col">
    {/* Swipe indicator for mobile */}
    <div className="sm:hidden py-2">
      <div className="w-12 h-1 bg-gray-400 rounded-full mx-auto" />
    </div>

    {/* Header */}
    <div className="p-4 border-b border-[var(--border-primary)]">
      <h2 className="text-lg font-semibold">Ticket Details</h2>
    </div>

    {/* Scrollable content */}
    <div className="flex-1 overflow-y-auto p-4">
      {/* Content */}
    </div>
  </div>
</div>
```

### Step 6: Implement Mobile Gestures
```tsx
// Add swipe detection
import { useSwipeable } from 'react-swipeable';

const handlers = useSwipeable({
  onSwipedRight: () => resolveTicket(ticket.id),
  onSwipedLeft: () => archiveTicket(ticket.id),
  preventDefaultTouchmoveEvent: true,
  trackMouse: false
});

<div {...handlers} className="ticket-card">
  {/* Card content */}
</div>
```

### Step 7: Add Loading Skeletons
```tsx
// Replace spinner with skeleton
{loading ? (
  <div className="space-y-3">
    {[1,2,3].map(i => (
      <div key={i} className="animate-pulse">
        <div className="h-20 bg-[var(--bg-secondary)] rounded-lg" />
      </div>
    ))}
  </div>
) : (
  // Actual content
)}
```

## Mobile-Specific Features

### Collapsible Filters
- Status filter collapses on mobile to save space
- Location selector in dropdown format
- Category as toggle buttons

### Touch Optimizations
- 48px minimum touch targets
- Swipe actions for quick resolve/archive
- Long-press for multi-select
- Pull-to-refresh

### Performance
- Virtual scrolling for 100+ tickets
- Lazy load images in detail view
- Debounced filter changes
- Optimistic UI updates

## Testing Checklist

- [ ] Test on iPhone Safari
- [ ] Test on Android Chrome
- [ ] Verify touch targets are 48px+
- [ ] Check horizontal scroll is eliminated
- [ ] Validate swipe gestures work
- [ ] Ensure modals are full-screen on mobile
- [ ] Verify filters collapse properly
- [ ] Test with 100+ tickets for performance
- [ ] Check all 6 locations display correctly
- [ ] Validate dark/light theme consistency

## Rollout Plan

1. **Phase 1**: Implement component structure and standard cards
2. **Phase 2**: Add vertical location list and simplified cards
3. **Phase 3**: Optimize modal and add gestures
4. **Phase 4**: Performance optimizations and testing

## Success Metrics

- Touch target compliance: 100% at 48px+
- Page load time: < 1 second
- Interaction delay: < 100ms
- Component size: < 400 lines each
- Mobile usability score: 95+