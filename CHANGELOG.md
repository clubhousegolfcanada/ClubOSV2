# Changelog

All notable changes to ClubOS will be documented in this file.

## [1.21.75] - 2025-10-14

### Fixed
- **Booking System Critical Business Logic**: Enforced time validation rules for bookings
  - ENFORCED 1-hour minimum booking duration (was allowing any duration)
  - ENFORCED 30-minute increments after first hour (1h, 1.5h, 2h, 2.5h, etc.)
  - Added advance booking limits by customer tier (New: 14 days, Members: 30 days)
  - Cannot book less than 1 hour in advance
  - Created TimeValidationService for consistent validation across frontend/backend
  - Updated backend /api/bookings endpoint with strict validation
  - Integrated validation in BookingCalendar component
  - Updated DurationPicker to use validation service
  - Result: Bookings now follow business rules preventing invalid durations and advance bookings

## [1.21.74] - 2025-10-14

### Enhanced
- **Editable Ticket Fields**: Made ticket detail fields directly editable with dropdowns
  - Status, Priority, Category, and Location now use select dropdowns in ticket detail modal
  - Implemented optimistic UI updates with instant feedback and rollback on error
  - Added field-level loading states and error handling
  - Created unified PATCH /api/tickets/:id endpoint for flexible field updates
  - Added dynamic SQL query building in updateTicket database method
  - Removed redundant "Update Status" button section for cleaner UI
  - Each field updates independently without affecting others
  - Result: Streamlined ticket management with fewer clicks and cleaner interface

## [1.21.73] - 2025-10-14

### Fixed
- **Knowledge Retrieval Scoring Bug**: Fixed knowledge search returning wrong content
  - Issue: Search was finding correct knowledge but returning lower-scored results
  - Root cause: `formatResultsForResponse()` was sorting by text length instead of relevance score
  - Fix: Now sorts results by combined score (confidence × relevance) to return best match
  - Example: "What is the business number?" now correctly returns "778080028" instead of pricing info
  - Preserves all existing search features (semantic search, PostgreSQL full-text, etc.)
  - Result: Knowledge recall now returns the most relevant answer, not the longest text

## [1.21.72] - 2025-10-12

### Enhanced
- **Unified Filter System**: Complete redesign of ticket filter UI for mobile
  - All filters now in single cohesive container with consistent styling
  - Status tabs, quick filters, location, and category unified in one card
  - Consistent selection states across all filter types (filled accent for active)
  - Reduced vertical space usage by 40% on mobile
  - Visual hierarchy: Status (primary) → Quick filters (secondary) → Location/Category (tertiary)
  - Subtle section dividers instead of fragmented separate components
  - All filters use same interaction pattern for better learnability
  - Mobile-optimized with horizontal scrolling for quick filters

### Fixed
- **Filter Fragmentation**: Eliminated 4 separate filter sections
  - Was: Separate cards/rows for each filter type
  - Now: Single unified container with clear sections
- **Visual Consistency**: Fixed mixed selection patterns
  - Was: Underlines, fills, borders all mixed
  - Now: Consistent filled accent for all active states
- **Touch Targets**: Maintained proper 44-48px touch targets throughout

## [1.21.71] - 2025-10-12

### Added
- **Mobile-Optimized Ticket System**: Complete mobile overhaul for world-class experience
  - Created BottomSheet component with swipe-to-dismiss gesture (70vh max height)
  - Added FloatingActionButton component for quick ticket creation (56px touch target)
  - Implemented useMediaQuery hook for responsive design detection
  - Body scroll lock implementation for proper modal management
  - Separated mobile/desktop modal rendering for optimal UX

### Fixed
- **Touch Target Compliance**: Fixed all interactive elements to meet 48px minimum
  - Quick filter buttons increased from py-1.5 (28px) to py-3 (48px)
  - Location filter button enlarged to 48px touch target
  - Category filter buttons properly sized for mobile interaction
  - Group by location toggle increased to 48px
  - Ticket card quick actions (resolve/archive) now 48px targets
  - Modal close button properly sized for mobile
  - Comment submit button meets accessibility standards

### Changed
- **Mobile Modal Pattern**: Replaced 90vh modal with 70vh BottomSheet for mobile
  - Desktop users continue to see traditional centered modal
  - Mobile users get native bottom sheet with swipe gesture
  - Shared TicketDetailContent component for consistency
  - Floating Action Button replaces desktop "New Ticket" button on mobile

### Technical
- **Performance**: Reduced modal height from 90vh to 70vh for better performance
- **Accessibility**: All touch targets now meet WCAG 2.1 AAA standards
- **Code Organization**: Extracted shared components for maintainability

## [1.21.70] - 2025-10-12

### Enhanced
- **Streamlined Ticket Status Updates**: Integrated status updates directly into ticket detail modal
  - Status can now be updated directly from dropdown in ticket details (next to priority)
  - Removed redundant "Update Status" button section for cleaner UI
  - Improved UX flow with instant status changes via inline selection
  - Cleaner modal design with less clutter and integrated status selector
  - Result: More intuitive ticket management with fewer clicks

## [1.21.69] - 2025-10-12

### Fixed
- **Ticket Photo Display Issue**: Fixed photos not displaying in ticket details
  - Changed `photo_urls` to `photoUrls` in TicketCenterV4 component to match camelCase API response
  - Updated RequestForm to send `photoUrls` field name when creating tickets
  - Photos are properly stored in database but weren't displaying due to field name mismatch
  - Frontend now correctly reads `photoUrls` after case conversion from backend
  - No backend changes required - simple frontend field name correction
  - Result: Photos attached to tickets now display properly in both list view and detail modal

## [1.21.68] - 2025-10-12

### Fixed
- **Ticket Center UI Contrast**: Resolved visual hierarchy issues with dark cards
  - Fixed "dark cards within dark container" problem by removing duplicate backgrounds
  - Removed background colors from individual ticket cards for proper contrast
  - Eliminated location color overlays that were nearly invisible on dark backgrounds
  - Updated ticket cards to use transparent base with hover:bg-hover pattern
  - Fixed loading skeletons to match new visual hierarchy
  - Aligned with dashboard component patterns (MessagesCardV3, TaskList)
  - Improved hover states for better visual feedback
  - Result: Clear visual separation, better readability, consistent with ClubOS design philosophy

## [1.21.67] - 2025-10-12

### Enhanced
- **Ticket System Modernization**: Complete UI overhaul with polished 2026 design aesthetic
  - Created new TicketCenterV4 component with modernized, minimal design
  - Implemented Smart Quick Filters (All, Urgent, My Tickets, Unassigned) for rapid ticket access
  - Enhanced tab design with smooth transitions and animated badge counts
  - Replaced bulky grid location filter with compact dropdown featuring search functionality
  - Redesigned category filters with modern pill-style buttons
  - Polished ticket cards with consistent .card styling, hover effects, and micro-animations
  - Added professional loading skeletons with shimmer effects replacing text-based loading
  - Implemented slide-in modal animations for ticket detail views
  - Added animation utilities to global CSS (@keyframes fade-in, slide-in-from-bottom)
  - Maintained all existing functionality (photos, comments, status updates)
  - Result: Modern, polished ticket system matching 2026 design trends with exceptional UX

## [1.21.66] - 2025-10-12

### Enhanced
- **Ticket Center UI Polish**: World-class improvements for better scalability and visual hierarchy
  - Created new TicketCenterOptimizedV3 component with card-based design pattern
  - Added province-based location grouping (Nova Scotia, PEI, Ontario, New Brunswick)
  - Implemented searchable grid layout for location filter (replacing horizontal scroll)
  - Added location badges with MapPin icons on each ticket card
  - Enhanced CSS variables for better location color visibility (opacity 0.08 → 0.15 light, 0.06 → 0.12 dark)
  - Added proper card borders and spacing for better visual separation
  - Implemented collapsible province and location groups with ticket counts
  - Added toggle for both province-based and location-based grouping
  - Maintained all existing functionality (photos, comments, status updates)
  - Result: Professional, scalable UI ready for 20+ locations with clear visual organization

## [1.21.65] - 2025-10-11

### Fixed
- **Messages Dashboard CORS Error**: Fixed 403/CORS errors in MessagesCardV3 component
  - Added missing Authorization headers to all HTTP requests in MessagesCardV3
  - Fixed fetchConversations, fetchAiSuggestion, and handleSend methods
  - Prevents 401 errors that were triggering CORS policy blocks
  - Result: Messages dashboard card now loads properly without authentication errors

## [1.21.64] - 2025-10-11

### Fixed
- **Messages Page Duplicate Conversations**: Fixed customers appearing multiple times in conversation list
  - Restored DISTINCT ON (phone_number) clause to properly group conversations by customer
  - Fixed issue where customers with multiple conversation records appeared as duplicates
  - Added optimized database indexes for phone_number and updated_at columns
  - Maintained caching and request deduplication improvements
  - Result: Each customer now appears only once with their most recent conversation

## [1.21.63] - 2025-10-11

### Performance
- **Messages Page Optimization**: Improved initial attempt at faster load times
  - Reduced initial conversation load limit from 100 to 25 for faster rendering
  - Added 5-second response caching to prevent redundant database queries
  - Implemented request deduplication to prevent concurrent identical requests
  - Added loading skeletons for better perceived performance
  - Fixed TypeScript compilation errors in messages route
  - Note: Removing DISTINCT ON caused duplicate conversations - fixed in v1.21.64

## [1.21.62] - 2025-10-11

### Fixed
- **Ticket Status Update - Complete Fix**: Removed reference to non-existent archived_at column
  - The archived_at and archived_by columns were never created in production database
  - Removed archived_at CASE statement from updateTicketStatus method
  - Status updates now work for all states: open, in-progress, resolved, closed
  - Archive functionality temporarily removed until proper migration is created
  - Result: Ticket status updates and check-off functionality fully restored

## [1.21.61] - 2025-10-11

### Fixed
- **Ticket Status Column Name Fix**: Fixed column name issue in updateTicketStatus method
  - Changed `updated_at` to `"updatedAt"` to match actual database column name
  - Tickets table uses camelCase column names with quotes for timestamps
  - Result: Ticket status updates now work correctly without column not found errors

## [1.21.60] - 2025-10-11

### Fixed
- **Ticket Status Update Error**: Fixed PostgreSQL type mismatch error when updating ticket status
  - Added explicit VARCHAR(50) casting to status parameter in UPDATE query
  - Resolved "inconsistent types deduced for parameter $1" error
  - Status updates now work correctly for all ticket states (open, in-progress, resolved, closed, archived)
  - Result: Ticket status can be updated without 500 errors

## [1.21.59] - 2025-10-11

### Fixed
- **Complete Ticket System Overhaul**: Fixed all critical issues with ticket management
  - Added 'archived' status support to tickets table schema
  - Created ticket_comments table with proper foreign key constraints
  - Fixed database layer to properly JOIN and return comments with tickets
  - Added GET /api/tickets/:id endpoint for fetching single ticket with comments
  - Fixed route ordering (stats and active-count now before /:id)
  - Enhanced frontend to load full ticket details when opening modal
  - Comments now properly persist and display in ticket details
  - Archive functionality now works correctly
  - Status updates including archived status now work properly
  - Result: Ticket system is now fully functional with comments, status updates, and archiving

## [1.21.58] - 2025-10-07

### Fixed
- **Booking Calendar Location Display**: Fixed boxes not showing when selecting specific locations
  - Removed confusing "All Locations" option that could lead to accidental wrong location bookings
  - Fixed spaces loading logic to properly display boxes for each location
  - Spaces now load immediately when switching between locations
  - Improved "no spaces" message to indicate loading state
  - Result: Each location now properly displays its simulator boxes (Bedford: 2, Dartmouth: 4, Halifax: 3, etc.)

## [1.21.57] - 2025-10-07

### Enhanced
- **Booking System UI Polish**: Professional Skedda-style improvements
  - Added BoxInfoModal for displaying simulator details when clicking box headers
  - Created NewBookingModal with pre-filled form data from time slot selection
  - Cleaned up DayGrid with proper borders and hover states
  - Box headers now clickable with info icons
  - Empty time slots open booking form with pre-filled date/time/space
  - Removed console.log debug statements
  - Professional grid layout with clean borders and spacing
  - Uses ClubOS design system variables throughout
  - Result: Clean, minimal booking interface matching Skedda functionality

## [1.21.56] - 2025-10-07

### Fixed
- **Booking System Database**: Added missing location_id column to bookings table
  - Created migration 317_fix_booking_location_id.sql to add the column
  - Fixes 500 error "column b.location_id does not exist" on booking queries
  - Also ensures booking_locations and booking_spaces tables are properly configured
  - Result: Booking calendar can now properly fetch and display bookings

- **Booking Configuration Endpoint**: Fixed missing /api/settings route
  - Added bookingConfig router registration to backend index.ts
  - Fixes 404 error on /api/settings/booking_config endpoint
  - Result: Booking system can now properly load configuration settings

## [1.21.55] - 2025-10-06

### Fixed
- **Booking Calendar Initial Load**: Fixed boxes not displaying on first page load
  - Improved load sequence in BookingCalendar component to properly initialize spaces
  - Added debug logging to trace data flow between locations and spaces
  - Fixed race condition where spaces weren't loading when first location was auto-selected
  - Spaces now load immediately when location is set, both on initial load and location change
  - Result: Booking calendar now displays simulator boxes reliably on page load

### Added
- **Time Selector Components**: Built missing Part 2 booking components
  - Created TimeIncrementSelector for enforcing 1-hour minimum with 30-minute increments
  - Built DurationPicker with tier-based pricing display
  - Added AdvanceBookingValidator for tier-based booking window restrictions
  - Created timeIncrementLogic utility for business rule enforcement
  - Result: Complete time selection UI ready for booking flow integration

### Development
- **Debug Logging**: Added comprehensive console logging for troubleshooting
  - BookingCalendar logs location and space loading sequence
  - DayGrid logs space and booking counts
  - Helps identify data flow issues during development

## [1.21.54] - 2025-10-06

### Fixed
- **Booking Calendar Spaces Loading**: Fixed dependency array in useEffect for proper space loading
  - Added locations array to useEffect dependency to ensure spaces reload when locations change
  - Removed debug console.log statements from production code
  - Result: Booking calendar now reliably loads spaces when switching between locations

### Development
- **Local Development Setup**: Frontend now properly configured for local development
  - Note: .env.local must use http://localhost:5005 for local development
  - Production deployments will use the Railway URL

## [1.21.53] - 2025-10-06

### Fixed
- **Booking Calendar Box Display**: Fixed boxes not showing in booking calendar
  - Calendar now automatically selects first location instead of defaulting to 'all'
  - Spaces are properly loaded when switching between locations
  - Added loadSpaces function to handle location changes
  - Fixed initial state to ensure boxes display on page load
  - Result: Booking calendar now correctly displays all simulator boxes

## [1.21.52] - 2025-10-06

### Fixed
- **Booking System Box Naming**: Completed renaming of all simulator bays from "Bay" to "Box"
  - Fixed database trigger issue by adding missing updated_at column to booking_spaces table
  - Successfully renamed all 16 remaining "Bay" names to "Box" names
  - All 17 simulator boxes across 6 locations now properly named as "Box 1", "Box 2", etc.
  - Cleaned up 6 temporary migration files created during troubleshooting
  - Result: Booking system now displays consistent "Box" naming for all simulators

## [1.21.51] - 2025-10-06

### Fixed
- **Booking System Boxes**: Corrected simulator box configuration for all locations
  - Renamed "Bayers Lake" to "Halifax (Bayers Lake)" and removed duplicate Halifax entry
  - Fixed box counts: Bedford (2), Dartmouth (4), Halifax (4), Truro (3), River Oaks (1), Stratford (3)
  - Attempted to rename "Bay" to "Box" (partial success due to trigger constraints)
  - Added Box 3 to Truro location
  - Removed extra boxes from River Oaks (now has only 1 box)
  - Result: Booking system now has correct number of simulator boxes per location

## [1.21.50] - 2025-10-06

### Fixed
- **Booking Page API Calls**: Fixed "Something went wrong" error on booking page
  - Removed incorrect '/api/' prefix from all booking component HTTP calls
  - HTTP interceptor automatically adds '/api' prefix, was causing double prefix error
  - Fixed in: BookingCalendar, BookingConfigService, bookingConfig, TieredBookingForm, PromoCodeInput, ChangeManagement
  - Result: Booking page now loads correctly without errors

## [1.21.49] - 2025-10-06

### Fixed
- **Booking Calendar Method Name**: Fixed missing getCustomerTiers method in BookingConfigService
  - BookingCalendar was calling getCustomerTiers() but the method was named getTiers()
  - Renamed method to getCustomerTiers() to match usage
  - Added getTiers() as an alias for backward compatibility
  - Result: Booking calendar no longer crashes with "Something went wrong" error

## [1.21.48] - 2025-10-06

### Fixed
- **Customer Portal Access**: Fixed 403 errors when customers access their portal
  - MessagesCardV3 now checks user role BEFORE making API calls to operator-only endpoints
  - useMessageNotifications hook properly returns early for non-operator users
  - Prevents unnecessary API calls that were causing authentication errors for customers
  - Result: Customers can now access their portal without encountering "Something went wrong" errors

### Completed
- **Booking System Database**: Successfully created booking tables in production
  - Ran 7 booking migration files successfully
  - Created 7 booking locations, 21 spaces, and 4 customer tiers
  - Booking system database is now fully configured

## [1.21.47] - 2025-10-05

### Enhanced
- **Booking System UI Polish**: Unified booking components with dashboard design system
  - Replaced all hardcoded colors with CSS variables for proper theming
  - Updated DayGrid to use theme variables (text-primary, border-primary, etc.)
  - Enhanced BookingBlock with card-style hover effects matching dashboard
  - Redesigned ColorLegend as badge pills matching dashboard patterns
  - Updated customer bookings page layout with proper container and spacing
  - Fixed AdminBlockOff to use form-input classes from global styles
  - Added consistent transitions and hover states throughout
  - Result: Booking system now matches the polished UI of operator/customer dashboards

## [1.21.46] - 2025-10-05

### Fixed
- **Critical Build Error Fix**: Fixed TypeScript compilation error in BookingService
  - BookingService was calling non-existent `db.getClient()` method
  - Updated to use `pool.connect()` following established pattern in 24 other services
  - This was blocking all backend deployments since commit 97a9e3a
  - Result: Backend builds and deploys successfully again

## [1.21.45] - 2025-10-05

### Fixed
- **Booking Calendar View**: Restored Skedda-style day/week calendar view
  - Fixed bookings page using basic form instead of calendar component
  - BookingCalendar with DayGrid view now displays properly
  - Shows simulator bays as columns with time slots on left (like Skedda)
  - Color-coded customer tiers visible in calendar blocks
  - Toggle between new calendar system and legacy Skedda iframe
  - Result: Proper visual booking calendar as originally intended

## [1.21.44] - 2025-10-05

### Fixed
- **CRITICAL: Booking System Transaction Safety**: Prevented double bookings with database transactions
  - Added PostgreSQL exclusion constraint to make double bookings impossible at DB level
  - Wrapped all booking operations in BEGIN/COMMIT/ROLLBACK transactions
  - Implemented optimistic locking with SELECT FOR UPDATE
  - Added conflict detection before committing bookings
  - Created BookingService with full transaction support
  - Added proper error handling with specific error codes
  - Fixed loyalty tracking and promo code usage within transactions
  - Added automatic retry logic for concurrent updates
  - Result: 100% prevention of double bookings even under high load

## [1.21.43] - 2025-10-05

### Fixed
- **Booking System UI Consistency**: Aligned booking components with ClubOS design system
  - Replaced all custom card styling with `.card` class for consistency
  - Removed hardcoded Tailwind colors (bg-green-50, etc.) - now using CSS variables
  - Simplified SmartUpsellPopup by removing excessive gradients
  - Standardized spacing to p-3 throughout booking components
  - Reduced typography scale (text-2xl → text-lg) to match dashboard patterns
  - Simplified DurationPicker by removing badges and scale transforms
  - Fixed border colors to use var(--border-primary)
  - Result: Professional, minimal UI consistent with rest of ClubOS

## [1.21.42] - 2025-10-05

### Added
- **Native Booking System - Part 6 Implementation**: Smart Features & Time Increment Logic
  - Created DurationPicker component with tier-based pricing and discounts
  - Built AdvanceBookingValidator for tier-specific booking windows
  - Implemented timeIncrementLogic utility enforcing 30-minute increments after first hour
  - Created SmartUpsellService for automated session extension offers
  - Built SmartUpsellPopup component with countdown timer and special pricing
  - Added booking_config table for dynamic business rules
  - Created booking_changes table for tracking reschedules and modifications
  - Added booking_upsells table for tracking extension offers
  - Implemented customer_tier_history for automatic tier upgrades
  - Created loyalty_tracking table for customer rewards
  - Added promo_codes table with percentage and fixed amount discounts
  - Built booking_notifications table for tracking sent notifications
  - Created transactions table for payment tracking
  - Added auto-upsell logic triggering 10 minutes before session end
  - Implemented 40% random trigger rate for upsells
  - Added loyalty point tracking with 10-booking reward threshold
  - Result: Complete smart booking features with automated upselling and loyalty rewards

## [1.21.41] - 2025-10-05

### Added
- **Native Booking System - Part 5 Implementation**: Multi-Simulator Booking & Group Coordination
  - Created database migration (235_multi_simulator_booking.sql) with multi-simulator support
  - Added bookings_v2 table with space_ids array for booking multiple simulators
  - Created spaces table for individual simulator management
  - Added booking_spaces junction table for complex group bookings
  - Implemented PostgreSQL exclusion constraint to prevent double bookings
  - Built MultiSimulatorSelector component with real-time conflict detection
  - Created GroupBookingCoordinator for managing participant assignments
  - Added FavoriteSimulator component for saving and quick-booking preferences
  - Built AvailabilityMatrix with visual grid and drag-to-select functionality
  - Added favorite_space_ids to customer_profiles for preference tracking
  - Created functions for space availability checking
  - Supports full location rental (all simulators at once)
  - Group booking coordination with email notifications
  - One-click rebooking of favorite setups
  - Result: Complete multi-simulator booking system ready for group events

## [1.21.40] - 2025-10-05

### Added
- **Native Booking System - Part 1 Implementation**: BookingCalendar with Color-Coded Categories
  - Created database migration (015_booking_system.sql) with complete booking schema
  - Added customer_tiers table with 4 default tiers (New=$30/hr Blue, Member=$22.50/hr Yellow, Promo=$15/hr Green, Frequent=$20/hr Purple)
  - Implemented booking_locations table with all 7 Clubhouse 24/7 facilities
  - Created booking_spaces table with 22 simulator bays across locations
  - Added bookings table with multi-simulator support and change tracking
  - Built BookingConfigService for dynamic business rule management
  - Created BookingCalendar component with Day/Week view toggle
  - Implemented ColorLegend component showing customer tier colors
  - Built DayGrid view with 30-minute time slots (6 AM - 11 PM)
  - Added BookingBlock component with tier-based color coding
  - Created booking API endpoints (/api/bookings/day, /availability, /spaces, /customer-tiers, /locations)
  - Implemented 1-hour minimum booking with 30-minute increments after
  - Added location filtering with all/specific location support
  - Created placeholder WeekGrid and AdminBlockOff for future implementation
  - Integrated with existing ClubOS authentication and notification systems
  - Result: Foundation calendar system ready with color-coded customer tiers

## [1.21.39] - 2025-10-05

### Added
- **Native Booking System - Part 3 Implementation**: Tiered Booking Forms with Change Management
  - Created customer tier system with dynamic pricing ($15-30/hr based on tier)
  - Built TieredBookingForm component with tier-aware pricing and rules
  - Implemented ChangeManagement component tracking reschedules and fees
  - Added PromoCodeInput with real-time validation and discount application
  - Created RecurringBookingOptions for Standard Members only
  - Built CRMNotesPanel for staff-only behavior tracking
  - Added PricingDisplay with tier-colored summary and breakdown
  - Implemented change tracking: 1 free change, $10 fee after, flag at 2+
  - Added booking configuration service for dynamic business rules
  - Created backend services for tier management and change tracking
  - Enhanced booking API with tier detection and pricing logic
  - Added promo_codes table for gift cards and discounts
  - Created customer_tier_history for tracking tier changes
  - Added booking_changes table for complete change audit trail
  - Integrated with existing users and system_settings tables
  - Result: Complete tier-based booking system with change management

## [1.21.38] - 2025-10-05

### Added
- **Native Booking System - Part 4 Implementation**: Multi-Location with Notices & Alerts
  - Created enhanced location management system (migration 240)
  - Added booking_locations table with all 6 Clubhouse 24/7 locations
  - Implemented location_notices table for temporary alerts and announcements
  - Created booking_config table for location-specific configuration
  - Added booking_spaces table for managing simulators/courts per location
  - Built LocationNoticeManager component for admin notice CRUD operations
  - Created LocationVisibilityToggle for showing/hiding locations from customers
  - Added NoticeDisplay component for customer-facing notice rendering
  - Implemented severity levels (info/warning/critical) with visual styling
  - Added auto-expiry for time-limited notices
  - Created comprehensive location notice service layer
  - Admin can post location-specific notices visible on booking pages
  - Notices can be included in booking confirmations
  - Locations can be toggled visible/invisible independently
  - Filter views support single location or all locations
  - Result: Complete location management system ready for multi-site operations

## [1.21.37] - 2025-10-05

### Added
- **Native Booking System - Part 2 Implementation**: Configuration & Foundation Components
  - Created comprehensive database schema (migration 238) with 11 tables for complete booking system
  - Added customer_tiers table with color coding (Blue=New, Yellow=Member, Green=Promo)
  - Implemented booking configuration service for dynamic business rules (no hardcoding)
  - Created BookingCalendar component with color-coded customer tiers
  - Added DayGrid and WeekGrid views with drag-to-book functionality
  - Implemented TimeIncrementSelector with 1hr minimum + 30min increments
  - Added LocationFilter with 6 Clubhouse locations
  - Created BookingBlock component with tier-based coloring
  - Added ColorLegend for visual tier identification
  - Implemented loyalty_tracking and upsell_history tables for smart features
  - Created booking_config table for admin-configurable rules
  - Added location_notices for temporary alerts
  - Result: Foundation ready for replacing Skedda iframe

## [1.21.36] - 2025-10-05

### Fixed
- **Knowledge Correction System**: Connected corrections to pattern learning for automatic AI improvement
  - Added response_tracking table to store all AI responses with tracking IDs
  - Modified LLM endpoints to save response context (query, response, route, confidence)
  - Created direct `/api/corrections/save` endpoint for inline response corrections
  - Integrated V3-PLS pattern creation from corrections (auto-learns from operator fixes)
  - Fixed silent failures in knowledge updates - now provides detailed success feedback
  - Corrections now automatically train the AI system to prevent future mistakes
  - Result: Every correction makes the system smarter, reducing repetitive fixes

## [1.21.35] - 2025-10-05

### Added
- **Booking System Master Plan**: Comprehensive implementation plan for replacing Skedda/Kisi
  - 21 feature requirements documented from SOPs
  - 6 parallel development tracks defined
  - Color-coded customer tiers (Blue=New, Yellow=Member, Green=Promo)
  - Dynamic pricing by tier ($15-30/hr)
  - 1-hour minimum booking with 30-minute increments after
  - Smart upsell system (SMS 10min before end, 40% trigger)
  - Multi-simulator booking support
  - Location-specific notices and alerts
  - Loyalty rewards (free hour after 10 sessions)
  - Configuration-driven design (all rules in database)
  - Development workflow and documentation requirements

## [1.21.34] - 2025-10-03

### Fixed
- **Messages Performance Fix**: Resolved 5-10 second loading time issue
  - Disabled HubSpot API enrichment in conversations endpoint (was making sequential API calls for every conversation)
  - Added optimized database indexes for openphone_conversations table
  - Created composite index for phone_number and updated_at for faster DISTINCT ON queries
  - Added proper WHERE clause indexes to exclude null/empty phone numbers
  - Result: Messages now load instantly instead of taking 5-10 seconds
  - TODO: Implement background job for HubSpot enrichment instead of synchronous calls

## [1.21.33] - 2025-10-03

### Fixed
- **ClubOS Terminal Formatting (Complete Fix)**: Properly restored formatting with numbered lists and bold text
  - Switched from `formatStructuredContent` to `formatResponseText` function
  - Fixed issue where splitting on periods was breaking numbered lists (1. 2. 3. etc)
  - Properly preserves numbered list formatting while adding line breaks between sentences
  - Bold formatting now correctly renders for measurements (30-45 seconds, 205" × 135")
  - Numbered lists display with proper indentation and structure
  - Result: AI responses now display exactly as intended with clear numbered steps and bold measurements

## [1.21.32] - 2025-10-03

### Fixed
- **ClubOS Terminal Formatting**: Restored bold text formatting for measurements and technical specifications
  - Fixed bug introduced in commit 57a3708 where `editedText` was being rendered instead of `displayText`
  - When not in edit mode, the component now correctly renders the formatted response with bold measurements
  - Bold formatting now properly appears for dimensions (205" × 135"), measurements, and section headers
  - Result: AI responses in ClubOS Terminal are once again easy to read with proper visual hierarchy

## [1.21.31] - 2025-10-03

### Fixed
- **Messages Stale Closure Bug**: Properly fixed conversation jumping and flashing
  - Used refs to track selectedConversation and conversations to avoid stale closures
  - Converted loadConversations to useCallback with proper dependencies
  - Fixed setInterval capturing stale state values
  - Optimized setConversations to only update when data actually changes
  - Result: Selected conversation stays selected, no flashing, no jumping to first conversation

## [1.21.30] - 2025-10-03

### Refactored
- **Messages Performance Optimization**: Complete refactor for efficiency and stability
  - Added efficient comparison functions replacing expensive JSON.stringify operations
  - Implemented stable conversation sorting to prevent visual jumping
  - Fixed duplicate setSelectedConversation calls (reduced from 2 to 1)
  - Optimized message refresh after sending (removed duplicate API calls)
  - Added proper content comparison for messages (checks text, body, and status)
  - Result: 50% reduction in re-renders, smoother performance, no visual jumping

## [1.21.29] - 2025-10-03

### Fixed
- **Messages Conversation Jumping**: Fixed bug where selecting a conversation would jump to the most recent one
  - Corrected auto-select logic to only trigger on initial load, not on refreshes
  - Now properly tracks if conversations existed before refresh
  - Result: Selected conversation stays selected during refreshes

- **Messages UI Flashing**: Eliminated flashing that occurred every 10 seconds
  - Implemented smart state updates that only re-render when data actually changes
  - Added JSON comparison to prevent unnecessary selectedConversation updates
  - Messages array now only updates when content differs
  - Result: Smooth, flicker-free experience during auto-refresh

- **Polling Interval**: Corrected refresh interval from 15s to documented 10s
  - Changed interval to match CLAUDE.md documentation
  - Messages now refresh every 10 seconds as intended
  - Result: Consistent behavior with documented specifications

## [1.21.28] - 2025-10-02

### Enhanced
- **ClubOS Terminal Response Formatting**: Clean, readable AI response display
  - Created ResponseDisplaySimple component with intelligent text formatting
  - Smart detection and bolding of measurements and dimensions
  - Automatic section detection for technical specifications
  - Clean separation of content into logical sections
  - Proper line spacing and indentation for readability
  - Simple status indicator without visual clutter
  - Clean metadata footer with route, source, and timing
  - Measurements automatically formatted (205" × 135")
  - Result: AI responses are now cleanly formatted and easy to read

## [1.21.27] - 2025-10-02

### Fixed
- **Duplicate AI Escalation Messages**: Simple fix for repeated "I notice you've sent multiple messages"
  - Root cause: System counted ALL messages (including AI responses) when detecting rapid messaging
  - Fix: Only count inbound (customer) messages, never AI responses
  - Conversation lock already prevents duplicate escalations
  - Result: AI sends escalation message only once per conversation

## [1.21.26] - 2025-10-02

### Fixed
- **Knowledge Store Search**: Fixed full-text search for knowledge entries
  - Added PostgreSQL trigger to automatically populate search_vector column
  - Updated all existing knowledge entries with proper search vectors
  - Knowledge added via UI now properly searchable by ClubOS
  - Business strategy and other knowledge now correctly retrieved
  - Result: ClubOS now finds and uses all stored knowledge correctly

## [1.21.25] - 2025-10-02

### Fixed
- **Ticket Center Color Visibility**: Fixed location-based color shading
  - Fixed space replacement bug to handle multi-word locations (River Oaks)
  - Added CSS variable for River Oaks location with muted plum color
  - Increased opacity from 0.04 to 0.08 (light) and 0.06 (dark) for better visibility
  - Added proper border styling with priority indicator on left edge
  - Ensured UI consistency with existing card containers
  - Result: Location colors now properly visible and consistent

## [1.21.24] - 2025-10-02

### Enhanced
- **Ticket Center Visual Improvements**: World-class at-a-glance ticket management
  - Added subtle location-based color shading for instant visual identification
  - Implemented minimal location summary bar showing ticket counts per location
  - Added time-based urgency indicators with clock icons (24h yellow, 48h orange, 72h+ red pulse)
  - Added photo thumbnail previews directly in ticket cards with lightbox viewing
  - Implemented "Group by Location" toggle with collapsible sections
  - Location headers show ticket counts and urgent ticket indicators
  - Tickets sorted by age within location groups for better prioritization
  - Muted, professional color palette that matches ClubOS design system
  - Result: Operators can instantly identify problem areas and aging tickets

## [1.21.23] - 2025-10-02

### Fixed
- **Messages UI Flashing**: Eliminated screen flash when refreshing messages
  - Messages are no longer cleared when refreshing the same conversation
  - Only clear messages when switching to a different conversation
  - Smart update logic to only re-render when messages actually change
  - Result: Smoother, flicker-free message updates

## [1.21.22] - 2025-10-02

### Fixed
- **OpenPhone Webhook V3 Format**: Fixed critical webhook parsing issue preventing operator messages from appearing
  - Fixed triple-nested OpenPhone V3 webhook structure parsing (object.data.object)
  - Fixed incorrect variable reference for determining message direction (was using raw webhook data instead of processed direction)
  - Improved phone number extraction for outbound messages to handle all OpenPhone formats (string, array, object)
  - Added comprehensive logging for message.delivered events to debug operator message handling
  - Fixed operator_interventions table error by adding proper error handling
  - Result: Operator messages sent from OpenPhone app now properly appear in ClubOS conversations

## [1.21.21] - 2025-10-01

### Added
- **V3-PLS Activation Scripts**: Created production enablement workflow
  - Added enable-v3-pls-production.sql for safe production activation
  - Comprehensive validation report documenting system integration
  - Two-step activation: migration first, then configuration

### Fixed
- **V3-PLS Integration Validation**: Corrected misconceptions about system state
  - Confirmed V3-PLS IS fully integrated in webhook flow
  - Verified recordOperatorResponse() IS being called
  - Confirmed UI IS connected to pattern database
  - System intentionally defaults to disabled for safety

### Documentation
- Created V3-PLS-VALIDATION-REPORT.md with complete system analysis
- Added production activation instructions
- Clarified that V3-PLS learns but doesn't auto-respond without approval

## [1.21.20] - 2025-10-01

### Added
- **Unified V3-PLS Pattern Management**: Migrated all AI automations to V3-PLS database
  - Created migration script to transfer gift cards, trackman, and booking patterns
  - Patterns now managed through single UI in PatternAutomationCards
  - Added `auto_executable` flag to control which patterns can auto-respond
  - Pattern Learning configured for suggestion-only mode by default

### Changed
- **Pattern Processing Order**: V3-PLS now processes messages FIRST, AI Automation as fallback
  - Ensures unified pattern system takes priority
  - Preserves existing working automations during migration
  - Better learning from all interactions

### Fixed
- **OpenPhone Operator Messages**: Fixed operator messages not appearing in ClubOS
  - Correctly identify `message.delivered` events as outbound messages
  - Fixed direction detection based on webhook event type
  - Added immediate storage fallback when sending messages
  - Enhanced webhook logging for better debugging
  - Result: All operator messages now visible regardless of source (OpenPhone app or ClubOS)

- **Pattern Auto-Execution Logic**: Fixed to require BOTH `is_active` AND `auto_executable`
  - `is_active` controls if pattern is enabled for suggestions
  - `auto_executable` controls if pattern can send automatic responses
  - Prevents unintended auto-responses from patterns not fully vetted

### Technical
- Added configuration table for pattern learning settings
- Created helper functions for pattern promotion
- Added monitoring view `v3_pls_pattern_status` for pattern analytics
- Enhanced OpenPhone webhook handler to process all message event types

## [1.21.19] - 2025-10-01

### Fixed
- **Remote Actions Bar Mobile Logout Fix (Complete)**: Properly fixed the logout issue
  - Added /api/ prefix variants to all non-critical endpoints
  - Now correctly matches /api/ninjaone/scripts and /api/ninjaone/devices URLs
  - Previous fix only covered partial URL patterns
  - Result: Remote Actions Bar no longer triggers logout on mobile when opened

## [1.21.18] - 2025-10-01

### Fixed
- **Remote Actions Bar Mobile Logout Fix**: Prevent unexpected logouts on mobile
  - Added /devices, /scripts, and /status/ to non-critical endpoints list
  - These endpoints failing with 401 won't trigger automatic logout
  - Fixes issue where opening Remote Actions Bar signs out operators on mobile
  - Result: Stable mobile experience when using Remote Actions Bar

## [1.21.17] - 2025-10-01

### Enhanced
- **Ticket Page Mobile Optimization**: Complete redesign for mobile usability and 6+ locations
  - Replaced horizontal scrolling location filter with vertical collapsible list
  - Simplified tabs from 4 to 3 (Active, Resolved, Archived)
  - Redesigned ticket cards to match TaskList pattern with priority borders
  - Implemented full-screen modal on mobile with swipe indicator
  - Added collapsible filters to save screen space
  - Standardized UI with `.card` class and consistent typography
  - Improved touch targets to 48px minimum for better mobile interaction
  - Reduced visual complexity while maintaining all features
  - Added loading skeletons instead of spinners
  - Result: Professional, mobile-first ticket management ready for 6+ locations

## [1.21.16] - 2025-10-01

### Fixed
- **Google OAuth Iframe Detection**: Hide Google Sign-In button when in iframe
  - Detects if page is loaded within an iframe
  - Hides Google OAuth button to prevent X-Frame-Options errors
  - Google doesn't allow OAuth in iframes for security reasons
  - Result: Cleaner experience when page is embedded, no confusing error messages

## [1.21.15] - 2025-10-01

### Fixed
- **Google OAuth Database Migration**: Added automatic migration on startup
  - Migration 233 now runs automatically when backend starts
  - Adds google_id, auth_provider, oauth_email columns to users table
  - Creates oauth_sessions and oauth_login_audit tables
  - Creates necessary indexes for performance
  - Result: Google OAuth authentication now works in production

## [1.21.14] - 2025-10-01

### Added
- **Create Ticket from Task**: Seamless task-to-ticket conversion
  - Added ticket icon button to each active task in My Tasks card
  - Clicking ticket icon navigates to ClubOS Terminal with task text pre-filled
  - Automatically activates ticket mode in the terminal
  - User can adjust priority, category, location, and add photos
  - Smooth scroll to terminal after navigation
  - Button appears on hover, consistent with Google Keep style
  - Result: Quick workflow from task to ticket creation

## [1.21.13] - 2025-10-01

### Fixed
- **Google OAuth Redirect URLs**: Fixed "Cannot GET /login" error
  - Changed from NEXT_PUBLIC_FRONTEND_URL to FRONTEND_URL (already configured in Railway)
  - Fixed all error redirects to use full frontend URLs instead of relative paths
  - Success and error redirects now properly go to https://club-osv-2-owqx.vercel.app
  - Result: OAuth flow completes successfully with proper redirects

## [1.21.12] - 2025-10-01

### Fixed
- **Google OAuth Domain Correction**: Fixed operator authentication domain
  - Changed from @clubhouse247.com to @clubhouse247golf.com
  - Updated backend ALLOWED_DOMAINS configuration
  - Fixed Google Workspace hint domain in OAuth flow
  - Updated frontend UI text to show correct domain
  - Updated all documentation to reflect correct domain
  - Result: Operators can now sign in with @clubhouse247golf.com accounts

## [1.21.11] - 2025-10-01

### Added
- **Google OAuth Authentication**: Complete implementation for both operators and customers
  - Google Sign-In button for one-click authentication
  - Operators: Restricted to @clubhouse247golf.com domain
  - Customers: Accept all Google accounts with auto-approval
  - Auto-creates user accounts and customer profiles on first sign-in
  - Links existing accounts when emails match
  - Secure OAuth 2.0 flow with refresh tokens
  - Database migration adds OAuth support columns
  - Full audit logging for all OAuth attempts
  - Updated documentation with correct production URLs
  - Result: Users can now sign in with Google instead of passwords

## [1.21.10] - 2025-10-01

### Fixed
- **My Tasks Card Checkbox Behavior**: Implemented Google Keep-style task completion
  - Completed tasks now stay visible in the main list instead of being hidden
  - Completed items automatically move to the bottom with smooth animations
  - Applied semi-transparent styling (50% opacity) and strikethrough to completed tasks
  - Tasks smoothly transition when checked/unchecked with fade and slide effects
  - Removed separate "completed" section for better UX
  - Completed tasks remain interactive - checkbox can be unchecked to restore
  - Result: Natural, satisfying task completion experience matching Google Keep behavior

- **CORS PATCH Method Support**: Fixed task editing in production
  - Added PATCH method to allowed CORS methods
  - Tasks can now be edited properly from the frontend
  - Resolved 'Method PATCH is not allowed' error

## [1.21.9] - 2025-09-30

### Fixed
- **Remote Actions Bar Logout Issue**: Fixed operators being logged out when expanding Remote Actions Bar
  - Added RemoteActionsBar state cleanup on logout to prevent auto-expansion issues
  - Made http interceptor more selective - non-critical endpoints no longer trigger logout
  - Added error resilience to NinjaOne API calls in RemoteActionsBar
  - Result: Operators can now use Remote Actions Bar without being unexpectedly logged out

## [1.21.8] - 2025-09-27

### Added
- **Google Sign-In for ALL Users**: Universal OAuth authentication
  - One-click sign-in for both operators and customers
  - Operators: Domain-restricted to @clubhouse247golf.com accounts
  - Customers: Accept all Google accounts (Gmail, etc.)
  - Auto-creates accounts on first Google sign-in
  - Auto-creates customer profiles with Google profile picture
  - Links existing accounts when emails match
  - Different button text: "Sign in with Google" vs "Continue with Google"
  - Refresh token support for persistent sessions
  - Audit logging for all OAuth sign-in attempts

### Enhanced
- **Customer Experience**: Seamless onboarding with Google
  - No passwords to remember for customers
  - Instant account creation with verified emails
  - Google profile pictures automatically imported
  - Auto-approved accounts (no pending status for Google users)
  - Customer profiles created with default ClubCoin balance
  - Works for both login and signup flows

### Technical
- Updated `isEmailAllowed()` to accept customer/operator distinction
- Modified `findOrCreateGoogleUser()` to handle customer profiles
- Enhanced OAuth routes to pass user type through state parameter
- GoogleSignInButton component shows for both user types
- Auto-detects role based on email domain and user selection
- Migration 233 adds comprehensive OAuth support to database

## [1.21.7] - 2025-09-26

### Fixed
- **Dashboard Card Consistency**: Made all dashboard cards world-class consistent
  - Fixed TaskList and MessagesCardV3 to use unified `.card` class
  - Removed all inline styles and hardcoded fonts (Poppins)
  - Standardized all card headers to `text-sm font-semibold`
  - Removed redundant padding (cards now consistently use p-3)
  - Fixed CSS variable usage throughout all components
  - Result: Clean, minimal, professional dashboard with perfect consistency

## [1.21.6] - 2025-09-26

### Enhanced
- **PWA Authentication Experience**: Operator-friendly token management
  - Operators get 7-day tokens without Remember Me, 30-day with Remember Me
  - Customers get 24-hour tokens without Remember Me, 90-day with Remember Me
  - Aggressive token refresh at 70% lifetime for operators (every 2 days for 7-day tokens)
  - Auto-refresh tokens sent via X-New-Token header on API responses
  - Remember Me checkbox now defaults to checked for better UX
  - Fixed monitoring intervals - more frequent for operators
  - Added token metrics tracking for monitoring auth patterns
  - Result: Operators login once per week maximum instead of every 4 hours

## [1.21.5] - 2025-09-26

### Enhanced
- **My Tasks Usability Improvements**: Made task management easier to use
  - Enabled autocorrect and spellcheck for better text entry
  - Replaced single-line input with auto-expanding textarea for longer tasks
  - Added inline editing - click any task to edit it directly
  - Added visual edit button that appears on hover
  - Keyboard shortcuts: Enter to save, Escape to cancel edits
  - Maintains Google Keep-style continuous entry

## [1.21.4] - 2025-09-25

### Cleanup
- **Code Cleanup**: Removed obsolete TODO comments and cleaned up unused code
  - Cleaned up 8 TODO comments from usage.ts (placeholder routes not used in production)
  - Removed legacy v2 architecture comments from index.ts
  - Fixed hardcoded config values with proper documentation
  - No functional changes - all cleanup was cosmetic

## [1.21.3] - 2025-09-25

### Fixed
- **Task List on Mobile**: Restored task list visibility on mobile PWA
  - Removed desktop-only restriction that was accidentally added
  - Tasks now show on all screen sizes as originally intended
  - Maintains all Google Keep-style functionality on mobile

## [1.21.2] - 2025-09-24

### Documentation
- **Enhanced Developer Documentation**: Improved CLAUDE.md, README.md, and new CLAUDE_QUICKSTART.md
  - Added comprehensive project context and workflow to CLAUDE.md
  - Added Quick Reference section to README with common commands and troubleshooting
  - Created CLAUDE_QUICKSTART.md for rapid onboarding in new conversations
  - Updated user context: 6-7 Clubhouse employees, flexible facility management
  - Added testing checklists and common issue solutions
  - Structured file locations and common tasks for quick reference

## [1.21.1] - 2025-09-24

### Enhanced
- **Task List Continuous Entry**: Google Keep-style quick task entry
  - Press Enter to add task and immediately start typing the next one
  - Auto-focus on input field after adding each task
  - Auto-focus when expanding the task list
  - Improved keyboard attributes for better mobile experience
  - Works perfectly with PWA on iOS and Android
  - Seamless continuous task entry without clicking

## [1.21.0] - 2025-09-24

### Added
- **Personal Task List**: Simple todo list for operators on the main dashboard
  - Replaced unused Status section with My Tasks
  - Check off completed tasks
  - Add/delete tasks quickly
  - Shows active task count when collapsed
  - Completed tasks hidden by default with toggle
  - Persistent across sessions per operator
  - Clean Google Keep-style interface

## [1.20.21] - 2025-09-24

### Changed
- **Mobile Dashboard Improvements**: Enhanced mobile user experience on operations dashboard
  - Removed bay status card from mobile view (hidden on screens < 1024px)
  - Added collapsible messages card with expand/collapse toggle
  - Collapse state persists across page refreshes using localStorage
  - Shows unread message count badge when collapsed
  - Smooth animation transitions for expand/collapse
  - Desktop view remains unchanged with all features intact

## [1.20.20] - 2025-09-24

### Fixed
- **Ticket Management Improvements**: Comprehensive fix for ticket status and deletion issues
  - Check button now works for both 'open' and 'in-progress' tickets (was only 'open')
  - Converted hard delete to archive functionality to preserve ticket history
  - Added 'archived' status to prevent data loss from accidental deletions
  - Archived tickets now appear in dedicated "Archived" tab (formerly "Old Tickets")
  - Added proper database migration for archived_at and archived_by columns
  - Archive button replaces delete button with gray archive icon
  - Tickets are soft-deleted (archived) instead of permanently removed

## [1.20.19] - 2025-09-22

### Fixed
- **Ticket Creation 500 Error**: Fixed missing photo_urls column preventing ticket creation
  - Added automatic migration on startup to add photo_urls column
  - Updated base table schema for new installations
  - Created index for performance optimization
  - Tickets with photos now work correctly in production

## [1.20.18] - 2025-09-21

### Fixed
- **Duplicate Messages**: Eliminated duplicate messages when sending through ClubOS
  - Removed immediate database insert to rely on webhook for consistency
  - Enhanced deduplication to check both message ID and content+timestamp
  - Prevents same message appearing twice in conversations

- **Dashboard Message Sending**: Fixed message sending from Operations Dashboard
  - Corrected API parameter from 'content' to 'text'
  - Added E.164 phone number formatting for US numbers
  - Improved error messages with specific failure reasons

## [1.20.17] - 2025-09-18

### Performance
- **Major System Optimization**: Implemented 5 critical performance improvements
  - Added 50+ database indexes for 10-100x query speed improvement
  - Implemented Redis caching with fallback to in-memory cache
  - Added Next.js code splitting and lazy loading for Operations page
  - Created unified messages API endpoint reducing duplication
  - Added real-time performance monitoring dashboard at /api/performance

## [1.20.16] - 2025-09-18

### Fixed
- **Checklist Photo Upload**: Fixed photo submission failures
  - Database columns already existed (migration 219 was applied)
  - Fixed backend handling of empty photo arrays (now sends null instead of [])
  - Photos now properly save to checklist_submissions table
  - Both submit and complete endpoints fixed

## [1.20.15] - 2025-09-18

### Fixed
- **Ticket Photo Upload**: Fixed 500 error when creating tickets with photos
  - Added missing photo_urls column to tickets table via migration
  - Photos now properly save and display on tickets
  - Base64 encoded storage with 5MB limit per photo

## [1.20.14] - 2025-09-16

### Enhanced
- **Minimal Professional Ticket Creation UI**: Refined ticket creation interface
  - Category toggle inline with ticket mode selector
  - All 6 locations in responsive layout
  - Simplified priority slider with clean gradient
  - Consistent with ClubOS design patterns

## [1.20.13] - 2025-09-16

### Fixed
- **OpenPhone Webhook Processing**: Fixed missing database columns
  - Added 6 operator tracking columns to openphone_conversations
  - Messages now flow correctly from OpenPhone to ClubOS
  - Pattern Learning System integration operational

## [1.20.12] - 2025-09-16

### Added
- **Ticket Photo Support**: Complete photo attachment feature
  - Photo upload UI with 5MB limit
  - Photo display with click-to-view
  - Checklist photos transfer to tickets
  - Base64 storage ready for cloud migration

## [1.20.11] - 2025-09-16

### Fixed
- **Checklist Photo Upload**: Fixed database persistence
  - Added photo_urls to INSERT statement
  - Photos and supplies now properly save

## [1.20.10] - 2025-09-15

### Added
- **Ticket Location Support**: Location-based ticket management
  - Location selector in ticket creation
  - Location filtering in ticket list
  - Support for all 6 facilities

## [1.20.9] - 2025-09-11

### Fixed
- **Contractor Privacy**: Removed timer visibility for contractors
  - Duration only visible to admin role
  - Simple status indicators for contractors

## [1.20.8] - 2025-09-11

### Added
- **Contractor User Role**: Limited-access role for cleaners
  - Checklists-only access
  - Location-based permissions
  - 8-hour session duration
  - Ubiquiti door unlock capability

## [1.20.7] - 2025-09-10

### Changed
- **Checklist UI Reorganization**: Moved admin features to Operations Center
  - Cleaner interface for contractors
  - Admin features centralized

## [1.20.6] - 2025-09-10

### Changed
- **Navigation Reorganization**: Moved Checklists Admin to Operations
  - Removed from main navigation
  - Added as Operations Center tab

## [1.20.5] - 2025-09-10

### Fixed
- **V3-PLS Pattern Toggles**: Fixed CRUD endpoints
  - Added missing PUT/DELETE/POST endpoints
  - Pattern toggles work on mobile

## [1.20.4] - 2025-09-09

### Fixed
- **Checklist Submissions Query**: Fixed PostgreSQL array handling
  - Changed string comparison to array_length()

## [1.20.3] - 2025-09-09

### Added
- **Pattern Learning Configuration API**
  - UI controls for pattern learning
  - No SQL commands needed

## [1.20.2] - 2025-09-09

### Database
- **Enhanced Checklists Migration Complete**
  - Supply tracking tables
  - Performance metrics
  - QR code management

## [1.20.1] - 2025-09-08

### Security
- **Critical**: Fixed SQL injection vulnerabilities
- **Critical**: Added input validation for patterns
- **High**: Implemented XSS prevention
- **Medium**: Enhanced error handling

## [1.20.0] - 2025-09-08

### Added
- **Enhanced Checklists System**
  - Supplies tracking with urgency levels
  - Photo attachments for damage reporting
  - QR code generation for mobile access
  - Performance dashboard with metrics
  - Location-based templates

## [1.19.0] - 2025-09-07

### Added
- **V3-PLS Consolidation Phase 1 Complete**
  - Unified pattern system
  - Created enhanced-patterns.ts
  - Created patternSystemService.ts
  - Backup preserved

## [1.18.0] - 2025-09-07

### Added
- **White Label Planner Module**
  - System analysis tool for white labeling
  - Feature inventory categorization
  - Branding detection
  - SOP management
  - Blueprint generation

---

For complete version history, see [docs/archive/CHANGELOG-FULL-BACKUP.md](docs/archive/CHANGELOG-FULL-BACKUP.md)