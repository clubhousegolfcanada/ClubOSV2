# ClubOS Color Standardization Guide

## Color Mapping Reference

### Background Colors
```
REPLACE → WITH CSS VARIABLE
bg-gray-50   → bg-[var(--bg-tertiary)]
bg-gray-100  → bg-[var(--bg-tertiary)]
bg-gray-200  → bg-[var(--bg-secondary)]
bg-gray-300  → bg-[var(--bg-secondary)]
bg-gray-400  → bg-[var(--bg-secondary)]
bg-gray-500  → bg-[var(--bg-primary)]
bg-gray-600  → bg-[var(--bg-primary)]
bg-gray-700  → bg-[var(--bg-primary)]
bg-gray-800  → bg-[var(--bg-primary)]
bg-gray-900  → bg-[var(--bg-primary)]
bg-black     → bg-[var(--bg-primary)]
bg-white     → bg-[var(--bg-tertiary)]
```

### Text Colors
```
text-gray-400 → text-[var(--text-muted)]
text-gray-500 → text-[var(--text-secondary)]
text-gray-600 → text-[var(--text-secondary)]
text-gray-700 → text-[var(--text-primary)]
text-gray-800 → text-[var(--text-primary)]
text-gray-900 → text-[var(--text-primary)]
text-black    → text-[var(--text-primary)]
text-white    → text-white (keep for contrast on dark backgrounds)
```

### Border Colors
```
border-gray-200 → border-[var(--border-secondary)]
border-gray-300 → border-[var(--border-primary)]
border-gray-400 → border-[var(--border-primary)]
border-gray-500 → border-[var(--border-primary)]
border-gray-600 → border-[var(--border-primary)]
border-gray-700 → border-[var(--border-primary)]
```

### Status Colors (Keep as-is for semantic meaning)
```
# Success (Green) - KEEP
bg-green-*, text-green-*, border-green-*

# Warning (Yellow) - KEEP
bg-yellow-*, text-yellow-*, border-yellow-*

# Error/Danger (Red) - KEEP
bg-red-*, text-red-*, border-red-*

# Info (Blue) - KEEP
bg-blue-*, text-blue-*, border-blue-*

# Special (Purple/Indigo) - KEEP for specific features
bg-purple-*, text-purple-*, bg-indigo-*, text-indigo-*
```

### Hover States
```
hover:bg-gray-* → hover:bg-[var(--bg-hover)]
hover:text-gray-* → hover:text-[var(--text-primary)]
hover:border-gray-* → hover:border-[var(--border-primary)]
```

### ClubOS Brand Colors
```
# Primary brand color
bg-green-500 (when used for brand) → bg-[var(--accent)]
text-green-500 (when used for brand) → text-[var(--accent)]
hover:bg-green-600 → hover:bg-[var(--accent-hover)]

# Light accent backgrounds
bg-green-50 → bg-[var(--accent-light)]
```

## Conversion Rules

1. **Always preserve semantic colors** (success, error, warning, info)
2. **Convert neutral grays** to CSS variables
3. **Keep white text** on dark backgrounds for contrast
4. **Test hover states** after conversion
5. **Check dark/light mode** compatibility

## Quick Reference for VSCode

Find & Replace patterns:
1. `bg-gray-(\d00)` → Check mapping above
2. `text-gray-(\d00)` → Check mapping above
3. `border-gray-(\d00)` → Check mapping above

## Component-Specific Notes

### Pattern Components
- Heavy use of gray-100/200 for cards → Use bg-[var(--bg-secondary)]
- Gray-600/700 for headers → Use bg-[var(--bg-primary)]
- Keep status colors for pattern states

### Dashboard Components
- Keep gradient backgrounds as-is
- Convert card backgrounds to CSS variables
- Preserve chart colors for data visualization

### Form Components
- Input backgrounds → bg-[var(--bg-primary)]
- Disabled states → opacity-50 (keep)
- Focus rings → Keep blue for accessibility