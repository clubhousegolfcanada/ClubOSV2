# Ticket System UI - Minimal Professional Revision

## Issues with Current Implementation

1. **Location selector already exists** - No need for new dropdown
2. **Emojis don't match ClubOS style** - Must be removed
3. **Category toggle too large** - Needs to match existing 3-way toggle style
4. **Not minimal enough** - Too much visual weight

## Revised Approach - Minimal & Professional

### 1. Category Selection - 2-Way Mini Toggle
- **Reuse existing 3-way toggle pattern** from Ticket/AI/Human
- Make it 2-way for Facilities/Tech
- Same size and style as existing toggle
- Just "F" and "T" labels or icons, minimal text
- Position inline with other controls

### 2. Priority Slider - Keep but Simplify
- Remove icon labels (too busy)
- Just show text labels below
- Thinner track
- Smaller thumb
- More subtle gradient
- Professional, understated

### 3. Location - Use Existing Pattern
- **Already exists when AI is selected**
- Reuse that exact same button/selector
- Don't create new component
- Keep consistent with current UI

## Implementation Details

### Facilities/Tech Toggle (Minimal)
```tsx
// Same style as 3-way toggle but 2 options
<div className="relative inline-block w-16">
  <div className="flex bg-[var(--bg-tertiary)] border border-[var(--border-secondary)] rounded-full p-0.5">
    <div className="absolute inset-y-0.5 transition-all duration-200 rounded-full bg-[var(--accent)]"
         style={{ width: '50%', left: category === 'facilities' ? '0%' : '50%' }} />
    <button className="relative z-10 flex-1 py-1 text-xs">F</button>
    <button className="relative z-10 flex-1 py-1 text-xs">T</button>
  </div>
</div>
<span className="text-xs text-[var(--text-muted)] ml-2">
  {category === 'facilities' ? 'Facilities' : 'Tech'}
</span>
```

### Priority - Simplified
- Remove all icons
- Just colored dots on slider
- Text labels: Low • Med • High • Urgent
- Subtle, professional

### Location
- Use existing location selector code
- No changes needed
- Already professional and minimal

## Benefits of This Approach

1. **Consistency** - Matches existing UI patterns exactly
2. **Minimal** - Small, unobtrusive controls
3. **Professional** - Clean, no emojis or excess decoration
4. **Familiar** - Users already know these patterns
5. **Fast** - Can reuse existing code

## What to Remove

- ❌ LocationDropdown component (use existing)
- ❌ Large CategoryToggle (replace with mini toggle)
- ❌ Emojis everywhere
- ❌ Icons in priority slider
- ❌ Excessive descriptions

## What to Keep

- ✅ Priority slider concept (simplified)
- ✅ Existing location selector pattern
- ✅ 3-way toggle pattern (adapted to 2-way)
- ✅ ClubOS color variables
- ✅ Minimal professional style