# Booking System UI Fix Implementation Plan

## Objective
Fix booking system UI inconsistencies to align with ClubOS design system and improve usability.

## Phase 1: Quick Wins (Immediate - 2-3 hours)

### 1.1 Standardize Card Styling
- [ ] Replace all `bg-white rounded-lg shadow-sm border border-gray-200` with `.card` class
- [ ] Update BookingCalendar.tsx
- [ ] Update TieredBookingForm.tsx
- [ ] Update ChangeManagement.tsx
- [ ] Update all location components

### 1.2 Remove Hardcoded Colors
- [ ] Create CSS variable mappings for status colors
- [ ] Replace all Tailwind hardcoded colors with CSS variables
- [ ] Update color usage in:
  - SmartUpsellPopup.tsx (gradients → solid colors)
  - DurationPicker.tsx (badges)
  - PromoCodeInput.tsx
  - PricingDisplay.tsx

### 1.3 Simplify Visual Elements
- [ ] Remove excessive gradients from SmartUpsellPopup
- [ ] Simplify hover states in DurationPicker
- [ ] Remove scale transforms
- [ ] Reduce badge usage

### 1.4 Typography & Spacing
- [ ] Standardize all padding to p-3
- [ ] Use consistent heading sizes (text-lg for titles)
- [ ] Match font weights to TaskList pattern

## Phase 2: Component Refactoring (Day 2)

### 2.1 Break Down TieredBookingForm
Split 507-line component into:
- [ ] BookingLocationSelector.tsx
- [ ] BookingTimeSelector.tsx
- [ ] BookingCustomerInfo.tsx
- [ ] BookingPricingSummary.tsx
- [ ] BookingActions.tsx

### 2.2 Simplify Duration Picker
- [ ] Remove "Popular" badges
- [ ] Show price only on selection
- [ ] Basic grid layout
- [ ] Remove custom duration for now

### 2.3 Create Reusable Booking Components
- [ ] BookingCard (extends .card)
- [ ] BookingSection (consistent section styling)
- [ ] BookingAlert (unified alerts)

## Phase 3: UX Improvements (Day 3)

### 3.1 Implement 3-Click Flow
1. Click calendar slot
2. Select duration
3. Confirm booking

### 3.2 Progressive Disclosure
- [ ] Hide advanced options by default
- [ ] Show only essential fields first
- [ ] "More options" toggle for power users

### 3.3 Mobile-First Refinements
- [ ] Test all components on mobile
- [ ] Ensure touch targets are 48px minimum
- [ ] Verify forms work on iOS Safari

## Testing Checklist
- [ ] Test locally on port 3001
- [ ] Verify no TypeScript errors: `npx tsc --noEmit`
- [ ] Test on mobile device
- [ ] Check dark mode
- [ ] Verify all booking flows work

## Git Workflow
1. Create atomic commits for each component
2. Test after each change
3. Update CHANGELOG.md with version bump
4. Push to auto-deploy

## Success Criteria
- All components use `.card` class
- No hardcoded colors
- Components under 200 lines
- 3-click booking achievable
- Consistent with ClubOS design