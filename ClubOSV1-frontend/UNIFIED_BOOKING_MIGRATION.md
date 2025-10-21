# Unified Booking System Migration Plan

## Overview
The new Unified Booking System consolidates multiple booking interfaces into a single, polished component. This document outlines the migration path from old components to the new unified system.

## Status: ✅ READY FOR TESTING

## New Components Created

### Core Components
1. **UnifiedBookingCard** (`/src/components/booking/unified/UnifiedBookingCard.tsx`)
   - Main orchestrator for all booking modes
   - Replaces: NewBookingModal, AdminBlockOff (partial), TieredBookingForm (partial)

2. **BookingModeSelector** (`/src/components/booking/unified/BookingModeSelector.tsx`)
   - Mode switching UI with visual indicators
   - New functionality - no direct replacement

3. **SmartBookingForm** (`/src/components/booking/unified/SmartBookingForm.tsx`)
   - Dynamic form with role-based fields
   - Replaces: Parts of TieredBookingForm, NewBookingModal form sections
   - Integrates: TimeValidationService ✅

4. **ConflictDetector** (`/src/components/booking/unified/ConflictDetector.tsx`)
   - Real-time conflict checking with suggestions
   - Enhances: Existing conflict detection logic

5. **PricingCalculator** (`/src/components/booking/unified/PricingCalculator.tsx`)
   - Dynamic pricing with tier support
   - Integrates: PromoCodeInput (reused) ✅
   - Replaces: Pricing logic from TieredBookingForm

6. **BookingTemplates** (`/src/components/booking/unified/BookingTemplates.tsx`)
   - Quick template system for common bookings
   - New functionality - no direct replacement

7. **BookingConfirmation** (`/src/components/booking/unified/BookingConfirmation.tsx`)
   - QR code generation and confirmation display
   - Enhances: Basic booking success messages

8. **BookingCalendarV2** (`/src/components/booking/calendar/BookingCalendarV2.tsx`)
   - Updated calendar using UnifiedBookingCard
   - Replaces: BookingCalendar (eventually)

## Components to Deprecate (Phase 2)

### High Priority (Remove after testing)
- `/src/components/booking/NewBookingModal.tsx` → Replaced by UnifiedBookingCard
- `/src/components/booking/calendar/AdminBlockOff.tsx` → Integrated into UnifiedBookingCard
- `/src/components/booking/forms/TieredBookingForm.tsx` → Replaced by SmartBookingForm

### Medium Priority (Evaluate usage)
- `/src/components/booking/BookingTerminalCard.tsx` → Pattern incorporated into UnifiedBookingCard
- `/src/components/booking/GroupBookingCoordinator.tsx` → May need integration if actively used

### Keep & Integrate
- `/src/components/booking/forms/PromoCodeInput.tsx` → Already integrated ✅
- `/src/components/booking/forms/CustomerSearch.tsx` → Keep as utility
- `/src/components/booking/forms/LocationSelector.tsx` → Keep as utility
- `/src/components/booking/forms/SpaceSelector.tsx` → Keep as utility
- `/src/components/booking/forms/RecurringBookingOptions.tsx` → Keep as utility
- `/src/services/booking/timeValidationService.ts` → Already integrated ✅
- `/src/services/booking/BookingService.ts` → Keep backend service

## Migration Steps

### Phase 1: Testing (Current)
1. ✅ All unified components created
2. ✅ Time validation integrated
3. ✅ Existing PromoCodeInput reused
4. ✅ BookingCalendarV2 created with unified card
5. ⏳ Test all booking modes thoroughly
6. ⏳ Gather user feedback

### Phase 2: Gradual Rollout
1. Update `/src/pages/bookings.tsx` to use BookingCalendarV2
2. Monitor for issues
3. Update customer-facing pages
4. Deprecate old modals

### Phase 3: Cleanup
1. Remove deprecated components
2. Update all imports
3. Clean up unused code
4. Update documentation

## Testing Checklist

### Booking Mode
- [ ] Create standard booking
- [ ] Apply promo code
- [ ] Validate time restrictions
- [ ] Check conflict detection
- [ ] Verify pricing calculation
- [ ] Test confirmation with QR code

### Block Mode
- [ ] Admin can block time
- [ ] Block reason saved
- [ ] Conflicts prevented
- [ ] Recurring blocks work

### Maintenance Mode
- [ ] Schedule maintenance
- [ ] Photo attachments work
- [ ] Maintenance type saved

### Event Mode
- [ ] Create event with attendees
- [ ] Deposit calculation correct
- [ ] Special pricing applied

### Class Mode
- [ ] Schedule class
- [ ] Instructor rates applied
- [ ] Recurring classes work

## API Endpoints Used
- `GET /bookings/locations` - Load locations
- `GET /bookings/spaces` - Load spaces
- `GET /customers/search` - Search customers
- `POST /bookings/check-availability` - Conflict checking
- `GET /bookings/next-available` - Find next slot
- `POST /bookings` - Create booking
- `GET /bookings/templates` - Load templates
- `POST /bookings/templates` - Save template

## Benefits of Unified System
1. **Consistency**: Single interface for all booking types
2. **Maintainability**: Reduced code duplication
3. **Features**: Templates, QR codes, smart validation
4. **UX**: Polished, modern interface
5. **Performance**: Optimized component structure

## Notes
- The unified system maintains backward compatibility with existing API endpoints
- All business logic from old components has been preserved
- Role-based permissions are enforced throughout
- Mobile-responsive design maintained

## Next Steps
1. Run comprehensive testing
2. Get stakeholder approval
3. Plan phased rollout
4. Monitor production usage
5. Complete deprecation

---
Created: 2025-01-21
Status: Ready for Testing
Author: Claude Code Assistant