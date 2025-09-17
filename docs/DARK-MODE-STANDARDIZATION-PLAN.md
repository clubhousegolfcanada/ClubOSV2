# Dark Mode Standardization Plan for ClubOS

## Executive Summary
This document outlines the complete dark mode standardization for ClubOS PWA, addressing iOS/Android inconsistencies and establishing best practices for theme-aware development.

## Current State (September 2025)

### ✅ Completed
- **Core Theme System**: ThemeProvider with localStorage persistence
- **CSS Variable System**: Comprehensive variables in globals.css
- **Tailwind Configuration**: Properly configured with `darkMode: 'class'`
- **Role-Based Theming**: Customers forced to light mode, operators get dark/light toggle
- **PWA Meta Tags**: Dynamic theme-color updates for iOS/Android
- **Critical Components Fixed**:
  - MessageCard.tsx
  - Button.tsx
  - ChecklistSystem.tsx
  - StatusBadge.tsx
  - CustomAchievementCreator.tsx
  - Input.tsx
  - Toggle.tsx
  - LoadingSpinner.tsx
  - RequestForm.tsx (partial)

### ⚠️ Remaining Issues
- 700+ instances of hardcoded colors across 45+ files
- Some components still use inline styles
- Hardcoded brand colors in various places

## CSS Variable Reference

### Use These Variables Consistently

```css
/* Backgrounds */
--bg-primary      /* Main page background */
--bg-secondary    /* Card/modal backgrounds */
--bg-tertiary     /* Subtle backgrounds, badges */
--bg-hover        /* Hover states */
--bg-elevated     /* Elevated surfaces */

/* Text */
--text-primary    /* Main text content */
--text-secondary  /* Secondary/muted text */
--text-muted      /* Disabled/very muted text */
--text-disabled   /* Disabled state text */

/* Borders */
--border-primary  /* Main borders */
--border-secondary /* Subtle borders */
--border-hover    /* Hover state borders */

/* Interactive */
--accent          /* Primary brand color (green) */
--accent-hover    /* Hover state for accent */

/* Status Colors */
--status-success  /* Success states */
--status-error    /* Error states */
--status-warning  /* Warning states */
--status-info     /* Info states */

/* Form Elements */
--input-bg        /* Input backgrounds */
--input-border    /* Input borders */
--input-focus     /* Focus ring color */
```

## Color Mapping Guide

### Replace These Colors

| Old Color | New Variable |
|-----------|-------------|
| `bg-white` | `bg-[var(--bg-secondary)]` |
| `bg-gray-50` | `bg-[var(--bg-tertiary)]` |
| `bg-gray-100` | `bg-[var(--bg-tertiary)]` |
| `bg-gray-200` | `bg-[var(--bg-hover)]` |
| `text-gray-500` | `text-[var(--text-muted)]` |
| `text-gray-600` | `text-[var(--text-secondary)]` |
| `text-gray-700` | `text-[var(--text-primary)]` |
| `text-gray-800` | `text-[var(--text-primary)]` |
| `text-gray-900` | `text-[var(--text-primary)]` |
| `border-gray-*` | `border-[var(--border-primary)]` |
| `hover:bg-gray-*` | `hover:bg-[var(--bg-hover)]` |

## Development Guidelines

### ✅ DO's
1. **Always use CSS variables** for colors that should adapt to theme
2. **Test in both themes** before committing
3. **Use the existing variable system** - don't create new color variables
4. **Consider role context** - customers are locked to light mode
5. **Update meta tags dynamically** in ThemeContext for PWA

### ❌ DON'Ts
1. **Never use hardcoded colors** except for:
   - Brand-specific elements that never change (ClubOS green logo)
   - Status indicators that need specific colors (red for errors)
2. **Don't use Tailwind dark: modifier** - use CSS variables instead
3. **Don't forget mobile testing** - iOS and Android render differently
4. **Don't use inline styles** for colors - use classes with variables

## Testing Checklist

### Before Deployment
- [ ] Toggle between dark/light modes on desktop
- [ ] Test on iOS device (Safari)
- [ ] Test on Android device (Chrome)
- [ ] Verify PWA status bar colors match theme
- [ ] Check customer view (should be forced light mode)
- [ ] Check operator view (should have toggle)
- [ ] Verify no white cards appear in dark mode
- [ ] Confirm text is readable in both modes

### Component Testing
- [ ] Cards have proper backgrounds
- [ ] Text has sufficient contrast
- [ ] Borders are visible but subtle
- [ ] Hover states work correctly
- [ ] Form inputs are clearly visible
- [ ] Buttons maintain brand consistency

## Implementation Priority

### Phase 1: Critical Path (COMPLETED)
- ✅ Message interface
- ✅ Core UI components
- ✅ PWA meta tags

### Phase 2: High Traffic Pages (IN PROGRESS)
- [ ] Dashboard
- [ ] Tickets page
- [ ] Operations center
- [ ] Messages page (remaining components)

### Phase 3: Secondary Features
- [ ] Checklists
- [ ] Knowledge base
- [ ] V3-PLS
- [ ] Settings

### Phase 4: Customer Portal
- [ ] Profile
- [ ] Compete/Challenges
- [ ] Leaderboards
- [ ] Friends

## Platform-Specific Considerations

### iOS (Safari)
- Status bar uses `apple-mobile-web-app-status-bar-style`
- Set to `black-translucent` for dark mode
- Set to `default` for light mode

### Android (Chrome)
- Uses standard `theme-color` meta tag
- Automatically adapts notification bar

### Windows (Edge)
- Uses `msapplication-navbutton-color`
- Follows same color scheme as theme-color

## Quick Fix Script

For bulk replacements in a component:
```bash
# Replace all bg-white with theme variable
sed -i '' 's/bg-white/bg-[var(--bg-secondary)]/g' component.tsx

# Replace all text-gray-* with theme variables
sed -i '' 's/text-gray-500/text-[var(--text-muted)]/g' component.tsx
sed -i '' 's/text-gray-600/text-[var(--text-secondary)]/g' component.tsx
sed -i '' 's/text-gray-700/text-[var(--text-primary)]/g' component.tsx
```

## Monitoring & Maintenance

### Regular Audits
1. Monthly review of new components for hardcoded colors
2. Automated testing for theme consistency
3. User feedback collection on readability

### Performance Metrics
- Theme switch should be instant (<50ms)
- No layout shift during theme change
- CSS variables should not impact performance

## Success Criteria

### Complete When
1. Zero hardcoded gray/white colors in components
2. All cards properly themed in both modes
3. iOS and Android show consistent experience
4. Customer/Operator role theming works correctly
5. No user complaints about readability

## Resources

- [CSS Variables Documentation](https://developer.mozilla.org/en-US/docs/Web/CSS/Using_CSS_custom_properties)
- [PWA Theme Color Guide](https://web.dev/articles/theme-color)
- [Tailwind Dark Mode](https://tailwindcss.com/docs/dark-mode)

## Contact

For questions or issues with dark mode implementation:
- Check `/styles/globals.css` for variable definitions
- Review `ThemeContext.tsx` for theme logic
- Test on actual devices, not just browser devtools

---

Last Updated: September 2025
Status: Phase 1 Complete, Phase 2 In Progress