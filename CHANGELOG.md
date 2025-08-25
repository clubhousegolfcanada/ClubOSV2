# Changelog

All notable changes to ClubOS will be documented in this file.

## [1.14.41] - 2025-08-25

### Enhanced
- **Tier System Visual Integration**
  - Added subtle tier-based colored left borders to leaderboard entries
  - Replaced generic icons with tier-specific stencil icons throughout
  - Customer dashboard now shows tier icon instead of trophy
  - Profile page features subtle tier accent colors
  - Maintained minimalist ClubOS design aesthetic
  - Legend tier (10,000+ CC) displays with purple accents
  - Mobile-friendly tier visuals across all pages

## [1.14.40] - 2025-08-25

### Fixed
- **Production Database Migration**
  - Applied missing migration 115 to add required user columns
  - Fixed "column status does not exist" error in production
  - Customer creation now works in both admin panel and signup screen
  - Added status, signup_date, and signup_metadata columns to users table
  - Verified all user management features are operational

## [1.14.39] - 2025-08-24

### Fixed
- **Customer Account Creation**
  - Fixed admin panel "Add Customer" functionality that was never working
  - Admin-created customers now properly receive 100 CC signup bonus
  - Customer profiles are correctly created for admin-added customers
  - New customers are automatically added to season leaderboards
  - Unified password validation (6+ characters) across all user creation methods
  - Changed default role to "customer" in admin panel for convenience
  - Added proper error handling and rollback for failed customer creation
  - Both admin creation and signup screen now work identically

## [1.14.38] - 2025-08-24

### Fixed
- **User Creation System**
  - Added missing status, signup_date, and signup_metadata columns to users table
  - Fixed 500 error when creating new customer accounts
  - Enabled customer account approval workflow
  - Migration 115 adds required columns for user management

- **Friends API**
  - Fixed table naming consistency (all lowercase 'users' now)
  - Resolved missing column errors for achievements
  - Friends list now properly loads in Competitors tab

## [1.14.37] - 2025-08-24

### Fixed
- **Backend API Errors**
  - Fixed friends API 500 error by correcting table reference from 'users' to 'Users'
  - Added missing `/api/challenges/cc-balance/:userId` endpoint for fetching user CC balances
  - Fixed ClubCoins showing as zero in customer management table
  - Resolved database table name inconsistency issues

## [1.14.36] - 2025-08-24

### Added
- **5-Tier Club Coin System**
  - New tier structure: Junior (0-199), House (200-749), Amateur (750-1999), Pro (2000-4999), Master (5000+)
  - TierBadge component with visual indicators and icons
  - TierProgressBar showing progression to next tier
  - Tier display integrated into customer profile
  - Tier progression notifications utility
  - Database migration ready (111_update_tier_system.sql)

- **Booking Rewards System**
  - 25 CC reward per booking (7-day delay)
  - Complete webhook infrastructure for HubSpot
  - Admin monitoring endpoints
  - Awaiting HubSpot webhook configuration

### Fixed
- Push Notifications save button added to Integrations page
- Configure buttons now show instructions for HubSpot, NinjaOne, and UniFi
- AI Center consolidated into Integrations tab (removed from operator view)

### Changed
- Profile page now displays tier badge next to user name
- Added tier progression card showing CC progress and total bookings

## [1.15.2] - 2025-08-24

### Added
- **Customer-Facing Achievement Displays**
  - Comprehensive achievements section on customer profile page
  - Tournament achievements with categories: Tournament, Championship, CTP, Special
  - Featured achievements showcase with special animations
  - Achievement detail modal with full information
  - Achievement badges on leaderboard entries (up to 3 featured)
  - Achievement badges on competitor cards in compete page
  - ProfileAchievements component with filtering and stats
  - Support for fully custom colors, animations, and effects

### Categories for Custom Achievements
- **Tournament** - Tournament wins and placements
- **Championship** - Championship victories
- **CTP (Closest to Pin)** - CTP competition wins
- **Special** - OG Pin (first year members), Tour Pro, custom recognitions

## [1.15.1] - 2025-08-24

### Changed
- **Custom Achievements System Refactor**
  - Removed all pre-defined achievements - system is now 100% custom
  - Operators create completely bespoke achievements on-the-fly
  - Full control over appearance: colors, icons, animations, glow effects
  - Each achievement is unique and special to the recipient
  - Added award button directly in operator user management page
  - No limitations - create any achievement imaginable

### Added
- **CustomAchievementCreator Component**
  - Visual achievement designer with live preview
  - Color picker with 10 preset themes (Gold, Silver, Bronze, Diamond, etc.)
  - 40+ popular emoji icons with custom input option
  - 8 animation types (pulse, spin, bounce, glow, float, shake, ping)
  - Points value slider (0-5000)
  - Custom categories and rarities
  - Tournament/event ID tracking

## [1.15.0] - 2025-08-24

### Added
- **Tournament Achievements System**
  - Complete achievement system for operators to award badges and special recognition
  - 34 pre-defined achievements across 5 categories:
    - Tournament (9): Champion, Runner-up, Bronze, Hole-in-One, etc.
    - Seasonal (5): Spring/Summer/Fall/Winter Champions, Season MVP
    - Special (5): Club Legend, Rising Star, Sportsmanship, Grand Slam
    - Milestone (10): Auto-awarded based on stats (challenges, win streaks, etc.)
    - Challenge (5): David vs Goliath, Weekend Warrior, Night Owl, etc.
  - Achievement rarity levels: Common, Rare, Epic, Legendary
  - Points system for achievement rankings
  
- **Operator Achievement Management**
  - New operator page at `/operator/achievements` for awarding achievements
  - Single and bulk award capabilities
  - Tournament quick-award mode for placing winners
  - Achievement statistics dashboard
  - Recent awards timeline
  
- **Achievement Display Features**
  - Featured achievements on user profiles (up to 3)
  - Achievement badges on leaderboards with animations
  - Achievement counts and points in profile stats
  - Competitor cards show achievement badges
  - Legendary achievements have special glow and shimmer effects
  
- **Backend Achievement Infrastructure**
  - New achievement service with comprehensive API
  - Database migration 110 with full schema
  - Auto-award system for milestone achievements
  - Achievement tracking in customer_profiles
  - REST API endpoints:
    - `GET /api/achievements` - List all achievements
    - `GET /api/achievements/user/:userId` - Get user's achievements
    - `POST /api/achievements/award` - Award achievement (operator only)
    - `POST /api/achievements/bulk-award` - Bulk award (operator only)
    - `DELETE /api/achievements/revoke` - Revoke achievement (operator only)
    - `GET /api/achievements/stats` - Achievement statistics
    - `GET /api/achievements/leaderboard` - Achievement rankings
  
- **Achievement Components**
  - `AchievementBadge` - Animated badge component with rarity effects
  - `AchievementBadgeGroup` - Display multiple badges with overflow count
  - `AchievementSelector` - Modal for operators to select and award achievements
  
### Changed
- Leaderboard API now includes achievement data (count, points, featured badges)
- Profile stats API includes achievement statistics
- Friends API returns featured achievements for each friend

## [1.14.35] - 2025-08-23

### Fixed
- **Competitors Page Stats**
  - Fixed wins/plays display on competitors page under compete
  - Friends API now returns actual challenge stats from database
  - Shows correct total_challenges_won and total_challenges_played
  - Win rate calculated from actual challenge data, not placeholder values
  - Frontend now properly maps challenge stats instead of wager stats

## [1.14.34] - 2025-08-23

### Fixed
- **Profile Page Stats Updates**
  - Fixed `total_challenges_played` not incrementing for both players
  - Added proper `challenge_win_rate` calculation after each challenge
  - Created comprehensive stats tracking via migration 109
  - Profile page now uses single optimized API endpoint `/api/profile/stats`
  - Reduced API calls from 4 to 1 for better performance
  - Added auto-refresh on tab focus and window focus
  - Fixed `total_cc_earned` and `total_cc_spent` tracking with triggers

### Added
- **New Profile Stats API**
  - `/api/profile/stats` - Returns all profile data in one call
  - `/api/profile/stats-summary` - Quick stats for dashboard widgets
  - Includes challenges, rankings, social stats, and settings

### Changed
- Profile page now refreshes automatically when returning to tab
- Stats update immediately after challenge resolution (database triggers)

## [1.14.33] - 2025-08-23

### Fixed
- **All-Time Leaderboard Rank Changes**
  - Removed simulated/placeholder rank change values
  - Added proper database tracking for rank changes with migration 108
  - Created rank_history table to track all rank movements
  - Added previous_rank column to customer_profiles for accurate tracking
  - Backend API now calculates and returns real rank changes
  - Rank change indicators now show actual movement based on CC earnings

## [1.14.32] - 2025-08-23

### Fixed
- **Winner Selection Column Error**
  - Fixed trigger using wrong column name (winner_id vs selected_winner_id)
  - Updated check_challenge_winner_agreement function in migration 107
  - Mike can now successfully select a winner for challenges
  
- **ClubCoin Balance Issues**
  - Updated existing challenge from 30/70 to 50/50 stake split (25 CC each)
  - Corrected Mike's balance to reflect proper 25 CC stake
  - API now returns correct balance of 75 CC

## [1.14.31] - 2025-08-23

### Fixed
- **Challenge Audit Trigger Error**
  - Fixed trigger using wrong column names (action_type vs event_type)
  - Updated check_challenge_winner_agreement function to use correct column names
  - Added migration 106 to fix the trigger function
  - Winner selection now logs audit entries correctly

## [1.14.30] - 2025-08-23

### Fixed
- **Winner Selection Error**
  - Fixed missing `updated_at` column in challenges table
  - Added migration 105 to add updated_at column with auto-update trigger
  - Winner selection now works correctly without database errors

## [1.14.29] - 2025-08-23

### Fixed
- **Critical Login Issue**
  - Fixed 404 error when attempting to login (double `/api/api/` in URL)
  - Updated login page to use correct API paths without `/api` prefix
  - Fixed auth endpoints in login.tsx (login, signup, forgot-password)
  - Kept environment variables with `/api` suffix as originally configured
  
- **Database Migration Error**
  - Fixed missing `rank_tier` column in rank_assignments table
  - Added migration 104 to rename `rank` column to `rank_tier` to match application code
  - Fixed rank calculation service errors preventing proper rank assignments

## [1.14.28] - 2025-08-23

### Added
- **Winner Selection System**
  - Players can now select who won after completing a challenge
  - Both players must agree on the winner for automatic resolution
  - If players disagree, they can file a dispute for admin review
  - Added modal interface for selecting "Me" or "Opponent" as winner
  - Challenge automatically resolves and awards CC when both agree

### Fixed
- **Production Database Migration**
  - Manually ran challenge_winner_selections migration on production
  - Fixed 500 error when selecting winner
  - Added proper indexes and triggers for winner agreement

### Improved
- **Challenge Card UI**
  - Removed redundant "Players" section from expanded view
  - Added time remaining display with duration options (1/2/4 weeks)
  - Added "Select Winner" and "Dispute" buttons for active challenges
  - Shows "To Be Decided" for skipped course selection

## [1.14.27] - 2025-08-23

### Improved
- **Challenge Viewing Experience**
  - Simplified challenge viewing with expandable inline cards
  - Users can now view challenge details without leaving the compete page
  - Added expandable/collapsible UI with smooth animations
  - Shows full player information, course details, and stakes inline
  - Displays appropriate action buttons based on challenge status
  - Improved UX by reducing page navigation

## [1.14.26] - 2025-08-23

### Fixed
- **Missing Routes**
  - Added missing /customer/challenges index page that redirects to compete page
  - Fixed 404 error when accessing /challenges endpoint

### Security
- **Enhanced Security Headers**
  - Added Referrer-Policy header for better privacy
  - Added Permissions-Policy to restrict feature access
  - Improved security posture without breaking functionality

### Technical
- **CSP Analysis**
  - Identified CSP warnings are from parent HubSpot iframe (report-only, non-blocking)
  - Found 7 files with inline styles (acceptable for React)
  - Production build completes successfully with no errors

## [1.14.25] - 2025-08-23

### Improved
- **Challenge Creation UX**
  - Added selected opponent preview card showing rank and champion status
  - Enhanced review section with opponent rank details
  - Added balance check in stake breakdown showing if user has sufficient funds
  - Visual warning when wager exceeds available balance
  - Clearer "Change" option for selected opponent

### Fixed
- **Challenge Details Page**
  - Now properly fetches and displays real challenge data from API
  - Shows actual player names, ranks, scores, and stakes
  - Displays correct challenge status and timestamps
  - Fixed champion marker display for both players

## [1.14.24] - 2025-08-23

### Added
- **Unified Leaderboard Component**
  - Created reusable LeaderboardList component for consistency
  - Pull-to-refresh functionality for mobile devices
  - Loading skeletons instead of basic spinners for better UX
  - Virtual scrolling for performance with large lists (50+ items)
  - Rank change indicators showing movement up/down
  - Integrated search functionality within component
  - Touch gesture support for mobile refresh

### Improved
- **Enhanced Leaderboard Features**
  - Better performance with virtual scrolling
  - Smoother loading experience with skeleton screens
  - Visual rank change indicators (up/down arrows)
  - Unified experience across all leaderboard views
  - Reduced code duplication between pages

### Fixed
- **Navigation & Scrolling Issues**
  - Removed swipe navigation that conflicted with horizontal scrolling
  - Fixed z-index issues with sticky headers (z-30 to z-40)
  - Improved tab navigation scrolling on mobile

### Changed
- **Component Architecture**
  - Both leaderboard and compete pages now use unified component
  - Consistent styling and behavior across all leaderboard views
  - Centralized leaderboard logic for easier maintenance

## [1.14.23] - 2025-08-23

### Fixed
- **Password System Critical Fixes**
  - Resolved validation mismatch between frontend and backend (now both require 6+ characters)
  - Removed complex password requirements that were blocking logins
  - Fixed Alanna's login issue and similar authentication problems
  - Made email comparison case-insensitive in database queries

### Added
- **Password Security Enhancements**
  - Rate limiting on password changes (max 3 attempts per 15 minutes)
  - New passwordChangeLimiter middleware for security
  - Protection against brute force attacks

### Improved
- **Password Change UX**
  - Clear password requirements display (6 characters minimum)
  - Consistent validation messages
  - Fixed password visibility toggle functionality

## [1.14.22] - 2025-08-23

### Fixed
- **Challenge Creation UX**
  - Made "Skip Course & Settings Selection" option more prominent and discoverable
  - Added dedicated button above course dropdown for skipping TrackMan settings
  - Separated skip option from course selection with visual "OR" divider
  - Fixed course dropdown to not show "DECIDE_LATER" as a selectable course
  - Improved visual feedback when skip option is selected

- **Terminal UI Mobile Layout**
  - Fixed Advanced and Location buttons positioning on mobile devices
  - Moved buttons from top-right header to next to the mode toggle (matching desktop layout)
  - Improved consistency between mobile and desktop layouts

- **Leaderboard Mobile Responsiveness**
  - Fixed horizontal scrolling issues on mobile devices
  - Made player stats responsive with abbreviated format on small screens
  - Added text truncation for long player names to prevent overflow
  - Optimized button sizes with icon-only display on mobile
  - Fixed tab navigation with shortened labels and proper scrolling
  - Adjusted iframe heights for better mobile viewport
  - Added proper touch targets (min 44px) for mobile interactions
  - Implemented flex layout for mobile-first responsive design

## [1.14.21] - 2025-08-22

### Added
- **Challenge System Flexibility**
  - Option to skip TrackMan settings when creating challenges
  - "Decide outside of the challenge" option for manual game setup
  - Complete audit documentation of challenge system flow
  - Database migration to make course_id optional

### Fixed
- **Challenge Creation**
  - Backend now accepts challenges without courseId
  - Frontend properly handles "DECIDE_LATER" course selection
  - Validation updated to allow challenges without TrackMan settings

### Technical
- **Challenge System Audit**
  - Verified profile statistics updates on challenge completion
  - Confirmed ClubCoin transactions (stake locking, payouts, bonuses)
  - Documented complete challenge lifecycle and data flow
  - Created CHALLENGE-SYSTEM-AUDIT.md with comprehensive documentation

### Verified
- Challenge results properly link to customer profiles
- Win/loss statistics update correctly
- ClubCoin balances update on stake/payout
- Leaderboard rankings reflect challenge outcomes
- Badge and rank calculations trigger after resolution

## [1.14.20] - 2025-08-22

### Added
- **Complete Friend System Implementation**
  - FriendRequests component for managing incoming/outgoing friend requests
  - New "Requests" tab in compete page with notification badge showing pending count
  - Accept/reject functionality with real-time updates
  - Visual separation between incoming and outgoing requests
  - Empty state when no pending requests exist
- **Role-Based Session Timeouts**
  - Customer accounts: 8 hour default session
  - Operator/Admin accounts: 4 hour default session
  - "Remember Me" option extends any account to 30 days
  - Dynamic token monitoring intervals based on session duration

### Fixed
- **Friend Request System**
  - Database migration to fix duplicate user tables (Users vs users)
  - Foreign key constraints now properly reference correct table
  - Self-friending prevention at API level with validation
  - Friend requests now visible to recipients in Requests tab
  - Club coins balance properly initialized for test accounts
- **Authentication Issues**
  - Fixed "session expired" error when switching between accounts
  - Enhanced logout to properly clear all auth state
  - Added grace periods to prevent false positive session expiry
  - Fixed race conditions in auth state management

### Technical
- **Database Improvements**
  - Migration 099 consolidates duplicate user tables
  - Fixed foreign key references in friend_invitations and user_blocks
  - Added self-friending prevention constraint
  - Performance indexes added for friendships queries
- **Security Enhancements**
  - Implemented role-based session expiration
  - Added Remember Me functionality for user convenience
  - Improved token monitoring with adaptive check intervals

### Testing
- **Test Account Setup**
  - mikebelair79@gmail.com: 100 CC, friends with Alanna
  - alanna.belair@gmail.com: 100 CC, friends with Mike
  - Both accounts ready for compete feature testing

## [1.14.19] - 2025-08-21

### Added
- **Friends Feature Enhancements**
  - Interactive friends list in Competitors tab of Compete page
  - Friends display with avatars, ranks, CC balance, and challenge stats
  - Click-to-challenge functionality - clicking friend card navigates to challenge creation
  - Pre-selection of friend when navigating from compete page to challenge creation
  - Friend management dropdown menu with options to remove friend or block user
  - Click-outside handling to close management menus
  - Visual feedback with toast notifications for all friend actions

### Fixed
- **Friend Request Functionality**
  - Fixed leaderboard API to properly check `friendships` table instead of `friend_invitations`
  - Friend requests now correctly check for pending status in the right table
  - Leaderboard properly shows is_friend and has_pending_request status

- **Friends API Data Structure**
  - Updated friends API endpoint to return proper data format for frontend
  - Added missing fields: rank_tier, cc_balance, clubcoin_balance, is_friend, has_pending_request
  - Fixed data mapping for compete page compatibility

### Improved
- **User Experience**
  - Made entire friend card clickable for better UX
  - Added hover effects and smooth transitions
  - Improved visual design with gradient avatars
  - Better separation between main content and action buttons
  - Enhanced mobile responsiveness

### Technical
- **Duplicate Account Investigation**
  - Investigated reported duplicate Alanna Belair accounts
  - Confirmed only one account exists (alannabelair@gmail.com)
  - Verified email uniqueness constraints are properly enforced
  - Emails stored in lowercase for case-insensitive matching

## [1.14.18] - 2025-08-20

### Fixed
- **Customer Dashboard Location Selector**
  - Removed location name from selector button to prevent icon overlap
  - Shows only map pin and dropdown arrow icons
  - Card label already shows "Book Bedford" etc, so name was redundant
  - Added tooltip on hover to show selected location

## [1.14.17] - 2025-08-20

### Fixed
- **Leaderboard Mobile Black Screen Issue**
  - Fixed API response format mismatch between backend and frontend
  - Backend now returns snake_case fields matching frontend LeaderboardEntry interface
  - Added proper friend status and pending request checks to alltime endpoint
  - Improved error handling and removed mock data fallback
  - Fixed iframe responsive styling for TrackMan embeds on mobile devices
  - Added proper authentication checks and loading states
  - Set default tab to 'alltime' since it's the main custom leaderboard
  - Added lazy loading to iframes to improve mobile performance

## [1.14.16] - 2025-08-20

### Improved
- **Customer Dashboard Location Selector**
  - Location selector now matches style of other card badges
  - Uses consistent green theme (bg-[#0B3D3A]/10) like CC and rank badges
  - Proper sizing with text-xs and standard padding
  - Better hover state with darker green background
  - Consistent positioning at top-2 right-2

## [1.14.15] - 2025-08-20

### Fixed
- **Customer Dashboard Book Card**
  - Made location selector smaller to prevent icon overlap
  - Card now shows "Book Bedford", "Book Dartmouth", or "Book Anywhere" based on selection
  - Location selector moved to top-right corner with minimal footprint
  - Text hidden on mobile to save space (only shows icon)

## [1.14.14] - 2025-08-20

### Changed
- **Terminal UI Button Styling**
  - Add Knowledge submit button now displays in yellow (#EAB308) when in Update mode
  - Update button in top right no longer changes color when active (stays neutral gray)
  - Cleaner visual hierarchy with distinct button states

## [1.14.13] - 2025-08-20

### Fixed
- **ClubCoin System Critical Fixes**
  - Fixed all existing customers not receiving 100 CC founding member bonus
  - Michael Belair and Alanna Belair now have their 100 CC properly granted
  - Fixed silent failure in signup CC initialization that prevented new users from getting CC
  - Added proper error logging and rollback when CC initialization fails
  - Added idempotency check to prevent double grants
  - Removed hardcoded 100 CC placeholder for mikebelair79@gmail.com in profile page
  - Profile page now shows actual CC balance from database
  - Added database migration to grant 100 CC to all existing customers without initial grant
  - All 3 active customers now have their founding member bonus
  - New signups will now properly receive 100 CC or fail with clear error

## [1.14.12] - 2025-08-20

### Fixed
- **Terminal UI Polish**
  - Update button now preserves AI toggle state when clicked
  - Advanced and Location buttons positioned closer to left side for better UX
  - Fixed toggle behavior to stay on AI mode when entering Update mode

## [1.14.11] - 2025-08-19

### Redesigned
- **Professional Customer Profile Page**
  - Removed colorful/childish design elements for professional ClubOS style
  - Clean, minimalist layout matching LIV Golf design language
  - Real data display: 100 CC for founding members (pre-signup bonus)
  - Three organized tabs: Statistics, Account, Preferences
  - Removed fake badges, lore lines, and gamification elements
  - Simple stat cards with ClubCoins, Win Rate, Total Wins, Streak
  - Professional header with avatar and edit functionality
  - Clean account management and security sections
  - Proper preference toggles for notifications

## [1.14.10] - 2025-08-19

### Improved
- **Customer Dashboard Optimization**
  - Reduced location selector to compact dropdown in header
  - Removed unavailable features (box availability, next slot times)
  - Added Quick Stats bar with ClubCoins, challenges, next booking, streak
  - Reorganized layout to 2-column for better space usage
  - Added Quick Links section with prominent challenge creation
  - Fixed naming conventions: "Bay" instead of "Box", consistent terminology
  - Centered quick action buttons with better visual hierarchy
  - Improved mobile responsiveness with better grid layouts

## [1.14.9] - 2025-08-19

### Changed
- **Unified Competition System**
  - Combined Friends and Challenges into single "Compete" page
  - Fantasy sports-style competition focus instead of social messaging
  - Three main tabs: Challenges, Competitors, Leaderboard
  - Streamlined challenge management with filters (all, active, pending, history)
  - Competitor view shows friends/rivals with stats and quick challenge buttons
  - Integrated leaderboard with add competitor functionality
  - Removed separate Friends and Challenges pages for cleaner navigation
  - Mobile-optimized with improved information density

## [1.14.8] - 2025-08-19

### Added
- **Pride-First Customer Profile Page**
  - Hero section with large rank emblem and username
  - Champion markers and auto-generated lore lines
  - Stats overview grid with all-time CC, W/L record, streaks
  - Clean stencil-style rank emblems (Crown, Trophy, Star, Medal, etc.)
  - Badges showcase with pride-of-place highlighting
  - Career timeline showing seasonal rank progression
  - Recent activity feed with wins, losses, badges, rank-ups
  - Deep dive tabs for history, all badges, and settings
  - Mobile-responsive grid layout matching UI design system

## [1.14.7] - 2025-08-19

### Fixed
- **Customer App Loading Issues**
  - Removed old "Wallet" navigation item that was causing 404s
  - Fixed dashboard linking to wrong leaderboard page (/events → /leaderboard)
  - Updated service worker cache version to clear stale content
  - Improved cache cleanup on service worker activation
  - Enhanced app visibility hook to properly route customers
  - Updated customer route whitelist to include leaderboard and challenges

## [1.14.6] - 2025-08-19

### Added
- **Enhanced New User Experience**
  - New signups automatically receive 100 ClubCoins
  - Auto-enrollment in current season leaderboard
  - Starting rank set to "House" tier
  
- **All-Time Leaderboard with Social Features**
  - Interactive all-time rankings with player stats
  - Send friend requests directly from leaderboard
  - View win rates, CC balance, and challenge stats
  - Proper Lucide icons instead of emojis
  - Visual rank indicators (Crown, Trophy, Star, Medal, etc.)

### Changed
- **Friends Page Improvements**
  - Updated Challenges tab with prominent "Create New Challenge" button
  - Better visual styling with white button on green background
  - Changed currency icon from DollarSign to Coins for consistency

- **Customer Login Branding**
  - Updated all customer pages from "Clubhouse 24/7" to "Clubhouse Golf"
  - Consistent branding across login and all customer pages

## [1.14.5] - 2025-08-19

### Fixed
- **Customer Leaderboard Embed Links**
  - Fixed Pro League embed URL to use correct TrackMan short link
  - Fixed House League embed URL to use correct TrackMan short link
  - Added "Closest to the Pin" tab with TrackMan embed
  - Reordered tabs: Pro League, House League, Closest to Pin, All Time
  - All TrackMan embeds now working correctly for customer portal

## [1.14.4] - 2025-08-19

### Fixed
- **Customer App Background Resume Issue**
  - Fixed infinite loading when app returns from background
  - Prevented operator dashboard flash for customer accounts
  - Added proper visibility change handling for mobile apps
  - Improved token expiration checking on app resume
  - Enhanced AuthGuard with proper loading states
  - Added useAppVisibility hook for background/foreground transitions
  - Ensured customer role always stays in customer view mode

## [1.14.3] - 2025-08-19

### Changed
- **Major Codebase Standardization**
  - Organized 34+ root directory files into proper structure
  - Created `/scripts` directory with subdirectories (dev, deploy, test, utils, security)
  - Moved all test scripts to `/scripts/test/`
  - Moved all utility scripts to `/scripts/utils/`
  - Moved security scripts to `/scripts/security/`
  - Organized documentation into `/docs` subdirectories
  - Root directory now contains only 9 essential files
  - Updated .gitignore with standard patterns
  - Generated standardization audit and progress reports
  
### Improved
- **Code Maintainability**
  - Maintainability score improved from 5/10 to 7/10
  - Clear separation of concerns between scripts
  - Standardized directory structure following industry best practices
  - Better discoverability of scripts and documentation
  
### Added
- `STANDARDIZATION-AUDIT.md` - Comprehensive codebase analysis
- `STANDARDIZATION-PROGRESS.md` - Progress tracking for improvements
- `/scripts/standardize-codebase.sh` - Automation script for organization
- `/scripts/utils/organize-documentation.sh` - Documentation organization helper

## [1.14.2] - 2025-08-19

### Changed
- **Restored Original Leaderboard Functionality**
  - Restored Pro League, House League, and All Time tabs
  - Re-added TrackMan embed support for league leaderboards
  - Removed standalone challenges page from navigation
  
- **Integrated Challenges into Friends System**
  - Added Challenges tab to Friends page for better integration
  - Shows active challenges with friends and CC balance
  - Create Challenge button links to challenge creation
  - Challenge friends directly from friend details view

## [1.14.1] - 2025-08-19

### Fixed
- **Backend TypeScript Compilation Errors**
  - Fixed all import statements for database, logger, and services
  - Changed from default exports to named exports for consistency
  - Removed Redis dependency from rate limiting (using memory store)
  - Fixed Date type conversion issues in seasons route
  
- **Database Migrations**
  - Successfully deployed challenge system tables to production
  - Created seasons, challenges, badges, and related tables
  - Active Winter 2025 season now running
  - All challenge backend services now operational

## [1.14.0] - 2025-08-19

### Added
- **Clubhouse Challenges System - Complete Implementation (91% of spec)**
  - Database migrations for complete challenge system (004, 005, 006)
  - Rank system with 8 tiers (House → Legend) 
  - Seasonal tracking with configurable resets (monthly/quarterly/semi-annual)
  - ClubCoin (CC) economy with full transaction ledger
  - Challenge lifecycle: create, accept, play, resolve with 50/50 stake split
  - 18 initial badges with dry, adult clubhouse tone
  - Champion markers for tournament winners with 20% defeat bonus
  - ClubCoin service for balance management and transactions
  - Challenge service for core challenge operations
  - Comprehensive audit trails for disputes
  - No-show penalties and credibility scoring system
  - Badge rules engine for automatic achievement tracking
  - TrackMan integration points for settings and verification

### Frontend
- **Clean, Professional Challenge UI**
  - Challenge list page with active/pending/history tabs
  - Leaderboard page with seasonal/all-time/activity views
  - Professional rank tier display (no emojis)
  - CC balance tracking in navigation
  - Clean card-based challenge display
  - Accept/decline functionality with visual feedback
  - Mobile-first responsive design matching existing UI

### API Layer
- Complete challenge REST API endpoints
- Leaderboard and seasons API routes
- CC balance management endpoints
- Challenge creation, acceptance, and play-sync APIs
- Dispute submission system

### Navigation Updates
- Added Challenges and Leaderboard to customer navigation
- Maintained consistent design language
- Professional icons (no emojis)

### Database Changes
- Created rank_tier enum (house, amateur, bronze, silver, gold, pro, champion, legend)
- Created challenge_status enum for full lifecycle tracking
- Added cc_balance and credibility_score to customer_profiles
- New tables: seasons, rank_assignments, challenges, stakes, challenge_results, badges, user_badges, champion_markers
- Helper functions for percentile calculation and rank assignment

### Enhanced (Phase 2 Complete)
- **Profile Page Enhancements**
  - Three-tab layout (Profile, Challenge Stats, Badges)
  - Rank and CC balance display in header
  - Champion marker badge display
  - Comprehensive challenge statistics
  - Badge showcase with tier-based coloring

- **Challenge System Features**
  - 4-step challenge creation wizard
  - Challenge detail page with all states
  - Accept/decline modals with stake preview
  - Dispute filing interface
  - Auto-expiry job running hourly
  - Rank calculation job (every 6 hours)
  - Seasonal reset job with data archiving
  - Badge rules engine with automatic awarding
  - TrackMan integration service with webhook support
  - Rate limiting for challenge creation (10/hour, 5 high-value/day)
  - Credibility-based restrictions for low-score users
  - Champion marker displays throughout UI (leaderboard, challenges, profiles)

## [1.13.0] - 2025-08-19

### Security - CRITICAL
- **Customer Role Access Control**
  - Implemented whitelist-based routing for customer accounts
  - Created customerRouteGuard utility to enforce allowed routes
  - Customers can ONLY access: /customer/*, /login, /logout
  - Added security blocks to all operator pages (messages, tickets, checklists, operations, commands)
  - Fixed authentication middleware to properly validate customer role
  - Enhanced role-based redirects - customers go to /customer/, operators to /
  - Prevented customers from accessing sensitive operational data
  - Added console warnings for security violation attempts
  - Full audit trail in SECURITY-AUDIT.md

### Fixed
- **Customer Authentication Issues**
  - Fixed 401 errors on customer login (auth middleware was rejecting customer role)
  - Fixed "session expired" false positives for customer accounts
  - Proper error messages for wrong passwords and account status
  - Customer dashboard now properly retrieves auth tokens

## [1.12.6] - 2025-08-18

### Added
- **Configurable Customer Approval Settings**
  - Added toggle in Operations Center to control customer auto-approval
  - System settings infrastructure for global configuration storage
  - Admin can enable/disable auto-approval for customer accounts
  - Settings persist in database and apply immediately to new signups
  - When disabled, customers require admin approval before login

## [1.12.5] - 2025-08-18

### Changed
- **Customer Account Auto-Approval**
  - Customer accounts now auto-approve on signup for immediate access
  - Signup returns JWT token immediately for seamless onboarding
  - Removed pending approval workflow for customer accounts
  - Admin approval workflow still available for other user roles

## [1.12.4] - 2025-08-18

### Fixed
- **Customer Signup Functionality**
  - Fixed database schema issues preventing customer account creation
  - Added 'customer' role to Users table enum type
  - Added status, signup_date, and signup_metadata columns for approval workflow
  - Fixed customer_profiles table foreign key reference to Users table
  - Customer accounts now properly created with pending_approval status
  - Login correctly validates account status before allowing access

## [1.12.3] - 2025-08-17

### Changed
- **Operations Center Streamlining**
  - Removed Dashboard tab as it provided no actionable value
  - Made Users the default first tab for immediate access
  - Reduced bundle size by 2.7 kB (20.6 kB → 17.9 kB)
  - Simplified navigation with 4 focused tabs instead of 5

## [1.12.2] - 2025-08-17

### Changed
- **Leaderboard Page Optimization**
  - Renamed "Join Event" to "Leaderboard" throughout customer interface
  - Removed "Local Tournaments" title for cleaner design
  - Compressed tournament instructions to single-line format
  - Minimized TrackMan app download button (Get App)
  - Maximized leaderboard iframe to 70vh minimum height
  - Reduced header size to prioritize live rankings display
  - Streamlined page to focus on the main leaderboard content

## [1.12.1] - 2025-08-17

### Changed
- **Customer UI Modernization**
  - Unified navigation style between operator and customer views for consistency
  - Reduced card sizes by 40% for better information density
  - Implemented compact typography (smaller fonts, tighter spacing)
  - Streamlined quick action cards with horizontal layout
  - Minimized button sizes while maintaining touch targets
  - Updated welcome section to single-line format
  - Compressed stats display with inline metrics
  - Reduced padding throughout interface (p-6 → p-4, p-3 → p-2)
  - Maintained all functionality while improving visual hierarchy

## [1.12.0] - 2025-08-17

### Added
- **HubSpot Booking Integration**
  - Created customer bookings API endpoint to fetch bookings from HubSpot CRM
  - Integrated real-time booking data into customer dashboard
  - Added automatic HubSpot contact ID caching for performance

### Changed
- **Customer Experience Improvements**
  - Removed "Book a Box" title and booking tips from bookings page for cleaner UI
  - Fixed RemoteActionsBar to never show in customer mode (including for operators testing)
  - Combined Profile and Settings into single menu item in navigation dropdown
  - Fixed operator/customer toggle visibility in dropdown menu with proper styling
  - Mobile navigation consistency improvements across all views

### Fixed
- **Navigation Issues**
  - Fixed operator/customer toggle not working in user dropdown
  - Fixed mobile navigation menu Profile/Settings inconsistency
  - Ensured RemoteActionsBar hidden for all users when in customer view mode
  - Fixed mobile navigation dropdown collapsible behavior

## [Refactor Phase 1] - 2025-08-17

### Database Schema Consolidation
- **Migration System Overhaul**
  - Created consolidated baseline schema (001_consolidated_baseline_v2.sql)
  - Implemented new migration runner with rollback support
  - Added checksum validation for migration integrity
  - Created migration tracking table for version control
  - Fixed 56+ conflicting migration files
  - Resolved duplicate table creation issues
  
- **Schema Improvements**
  - Standardized all table structures
  - Added proper indexes for performance
  - Fixed foreign key relationships
  - Implemented update triggers for all tables
  - Added migration audit documentation

- **New CLI Commands**
  - `npm run db:status` - Check migration status
  - `npm run db:migrate` - Run pending migrations
  - `npm run db:rollback` - Rollback migrations
  - `npm run db:validate` - Validate checksums
  - `npm run db:reset` - Reset database (dev only)
  
### Technical Debt Addressed
- Consolidated 56+ migration files into single baseline
- Fixed naming inconsistencies (snake_case standardization)
- Removed duplicate CREATE TABLE statements
- Added proper rollback support for all migrations

## [1.11.24] - 2025-08-15

### Added
- **UniFi Access Developer API Integration**
  - Implemented official UniFi Access Developer API for door control
  - Added remote door unlock capability for Dartmouth location
  - Created multi-location service architecture for managing multiple sites
  - Added door_access_log table for audit trail
  - New API endpoints: `/api/unifi-doors/doors`, `/api/unifi-doors/doors/:location/:doorKey/unlock`

### Changed
- **Commands Page Door Controls**
  - Updated Dartmouth door controls to use new UniFi API
  - Added "Active" indicator for working door locations
  - Disabled non-functional door buttons for locations pending setup
  - Changed Dartmouth "Main" door label to "Office" to match actual door

### Technical
- Added services: unifiAccessAPI, unifiMultiLocation, unifiAccessDirect
- Configured port forwarding for remote access (port 12445 → 443)
- Created test scripts for API validation and door discovery
- Added tough-cookie dependency for session management

### Pending
- Bedford location requires UniFi OS authentication layer (not just API token)
- Other locations need API tokens and port forwarding configuration

## [1.7.1] - 2025-08-14

### Added
- **Two-Way Slack Communication**
  - Integrated Slack conversation directly into RequestForm card
  - Added ability to reply to Slack threads from within ClubOS
  - Real-time polling for new Slack replies (5-second intervals)
  - Clean message bubble UI with sender distinction
  - Thread conversation history display
  - Reply input field with send button
  - Backend `/slack/reply` endpoint for sending messages to Slack threads
  - Authentication-protected reply functionality

### Changed
- **UI Improvements**
  - Slack conversation now integrated into main response area instead of separate card
  - Messages use clean bubble design matching Messages card style
  - Staff messages left-aligned, ClubOS user messages right-aligned with accent color
  - Expandable/collapsible conversation view

### Removed
- Removed unused SlackConversation component
- Cleaned up redundant imports

## [1.7.0] - 2025-08-14

### Fixed
- **Messages UI Improvements**
  - Fixed AI response handling for Trackman and technical issues
  - Added debug logging to trace assistant responses
  - Prevented over-aggressive filtering that replaced good technical responses
  - Improved routing detection for Trackman, frozen, stuck, error keywords

- **API Endpoint Corrections**
  - Fixed 404 errors in Operations Users tab by correcting API endpoint URLs
  - Removed duplicate /api prefix from auth endpoints

- **Ticket System Updates**
  - Fixed ticket status update not reflecting in UI immediately
  - Added "Old Tickets" tab for resolved/closed tickets older than 7 days
  - Fixed checkbox quick resolve functionality
  - Improved comment persistence and display with latest comment preview

- **UI/UX Enhancements**
  - Updated Messages card styling to match consistent design with border-2 and rounded-xl
  - Changed AI suggestion to manual trigger instead of auto-fetch
  - Added caching for AI suggestions to avoid redundant API calls
  - Replaced person icons with minimal location/bay badges (B1, B2, GEN, etc.)
  - Changed AI suggestion button icon from sparkles to robot head
  - Made design more minimal and text-based without colorful icons

### Added
- **Comment System Improvements**
  - Latest comment preview in main ticket list (desktop only)
  - Better state management for comments
  - Instant updates without full reload

- **Old Tickets Management**
  - New tab for viewing archived tickets (resolved/closed > 7 days)
  - Client-side filtering for better performance
  - Clear empty state messaging

### Changed
- **AI Suggestions Behavior**
  - Now manual with "Get AI Suggestion" button
  - Suggestions cached per conversation
  - Clear on message send or new incoming messages
  - Better performance with reduced API calls

## [1.12.0] - 2025-08-13 (Completed)

### Major Refactor - Operations Page Consolidation

#### Added
- **AI Automation Message Sending** (Completed)
  - AI can now actually send messages via OpenPhone (not just suggest)
  - Added `sendAutomaticResponse()` and `executeAction()` methods
  - Migration 056 enables auto-send for gift cards (safe starting point)
  - Full action logging to `ai_automation_actions` table for audit trail

#### Changed
- **Operations Page Refactor** (Completed)
  - ✅ Consolidated complex multi-level navigation into 5 clean tabs
  - ✅ Dashboard - System overview with live metrics and activity feed
  - ✅ Users - User management, access control, backup/restore
  - ✅ AI Center - Merged Knowledge + AI Automations + Prompts into single tab
  - ✅ Integrations - All external services (Slack, OpenPhone, Push, HubSpot, NinjaOne)
  - ✅ Analytics - Routing analytics, AI performance, usage reports, export tools
  - Removed redundant sub-tabs and navigation levels
  - Admin-only tabs hidden from operators for cleaner interface
  - Mobile-responsive design with overflow scrolling for tabs

#### Documentation
- Created comprehensive Operations Audit & Consolidation Plan
- Created detailed Implementation Plan with 9 phases
- Archived old planning documents to `/archive` folder
- Created continuation context file for resuming work

## [1.11.25] - 2025-08-10

### Added
- **NinjaOne-Ready Remote Desktop Integration**
  - Created unified remote desktop system supporting both NinjaOne and Splashtop
  - Added NinjaOne remote session API endpoint (`/api/ninjaone-remote`)
  - Integrated with existing NinjaOne device registry for bay computers
  - Smart provider selection: tries NinjaOne first, falls back to Splashtop
  - Configuration via `NEXT_PUBLIC_REMOTE_DESKTOP_PROVIDER` environment variable
  - Automatic fallback chain: NinjaOne session → NinjaOne console → Splashtop portal

- **Bay-Specific Remote Desktop Buttons**
  - Added "Remote" button for each bay in Commands page (replaced "Other" button)
  - Added "Remote" button for each bay in RemoteActionsBar
  - Direct connection to specific bay computers
  - Loading indicators and success/error toasts for better UX
  - Works with both NinjaOne and Splashtop providers

- **Splashtop Fallback Support**
  - Direct connection using MAC address deep linking (when configured)
  - URL format: `st-business://com.splashtop.business?account=EMAIL&mac=MACADDRESS`
  - Configuration via environment variables for each bay's MAC address
  - Automatic fallback to web portal with helpful computer selection message
  - Created comprehensive setup documentation (SPLASHTOP-SETUP.md)
  - Added PowerShell and Batch scripts for easy MAC address collection
  - Quick 5-minute setup process with automated helper scripts

### Improved
- **Complete Splashtop Integration for All Platforms**
  - Implemented smart deep linking for Splashtop Business app across all platforms
  - **iOS**: Attempts multiple URL schemes (`splashtopbusiness://`, `splashtop://`, `stbusiness://`) using iframe method
  - **Android**: Uses intent URL for Splashtop Business app (`com.splashtop.remote.business`) with automatic web fallback
  - **Mac/Windows Desktop**: Attempts to open Splashtop Business desktop app before falling back to web portal
  - Automatic fallback to web portal if native app is not installed on any platform
  - Added comprehensive platform detection (iOS vs iPad vs Mac, Windows, Android)
  - Added PWA detection to optimize for installed app experience
  - Works in both ExternalTools and DatabaseExternalTools components
  - Created comprehensive test page for validating URL schemes across all platforms

## [1.11.24] - 2025-08-09

### Added
- **Ubiquiti UniFi Access Door Control**
  - Staff doors now fully operational at Bedford and Dartmouth locations
  - Remote unlock capability for all configured doors (30-second default)
  - Real-time door status monitoring (locked/unlocked, online/offline)
  - Door access integrated into Remote Actions bar at bottom of screen
  - Role-based access: Operators can unlock staff doors, Admins have full control
  - Audit logging for all door access operations
  - Slack notifications for non-main door unlocks
  - Emergency unlock all doors function for admins
  - Demo mode when UniFi not configured for testing
  - Interactive setup script (`npm run setup:unifi`) for easy configuration
  - Connection test script (`npm run test:unifi`) to verify setup
  - Quick setup guide for 5-minute deployment
  - Comprehensive setup documentation (UBIQUITI-DOOR-ACCESS-SETUP.md)
  - Foundation laid for future customer self-service door access

## [1.11.23] - 2025-08-08

### Fixed
- **Customer Names Not Displaying in Messages**
  - Enhanced OpenPhone webhook data extraction to check more contact fields
  - Added comprehensive logging to identify available name fields
  - Fixed database update logic that was preventing name updates
  - HubSpot lookup now runs for all messages (not just inbound)
  - Added automatic name sync service that runs every 5 minutes
  - Syncs names from HubSpot for conversations showing "Unknown" or phone numbers
  - Added manual sync endpoint for admins at `/api/openphone/sync-names`
  - Fixed TypeScript types for projector control actions

## [1.11.22] - 2025-08-08

### Fixed
- **UniFi Access Module Import Error**
  - Fixed ESM module import error preventing backend startup
  - Converted static import to dynamic import for unifi-access package
  - Service now properly handles ES module loading asynchronously
  - Backend can now start successfully with UniFi Access integration

### Added
- **Door Access Controls in Commands Page**
  - Added prominent door unlock buttons for all locations
  - Main entrance, staff door, and location-specific doors (bay/loading/emergency)
  - Blue-themed door access section for easy visibility
  - 30-second unlock duration for all doors
  - Condensed layout to fit door controls alongside existing bay controls
  - Full UniFi Access setup documentation (UNIFI-ACCESS-SETUP.md)
  
- **Projector Control Buttons**
  - Added compact projector controls to each bay (Power, Input, Auto-size)
  - Purple-themed mini buttons to save space
  - Integrated with NinjaOne for remote projector control
  - Positioned below main bay controls with projector icon

## [1.11.21] - 2025-08-07

### Fixed
- **Duplicate Messages Issue**
  - Fixed duplicate messages appearing when only one was sent
  - Added message ID deduplication in OpenPhone webhook handler
  - Prevents processing the same message multiple times from webhook retries
  - Checks for existing message IDs before adding to conversations
  - Added logging for webhook retry headers (x-openphone-delivery-attempt)

- **Customer Name Display**
  - Fixed customer names showing as phone numbers instead of actual names
  - Removed phone number fallback when customer name is not available
  - Fixed COALESCE logic preventing name updates from overwriting phone numbers
  - Names now properly update when received from OpenPhone webhooks

### Improved
- **AI Assistant Performance**
  - Fixed slow BrandTone assistant responses (was taking 53+ seconds)
  - Added 20-second hard timeout on OpenAI API calls
  - Improved timeout handling with proper run cancellation
  - Added detailed logging for response times and slow responses
  - Reduced API retry attempts from default to 1
  - Increased polling interval from 250ms to 500ms for better efficiency

## [1.11.20] - 2025-08-07

### Fixed
- **Push Notification Improvements**
  - Added vibration patterns to push notifications (200ms pattern)
  - Notifications now include action buttons (View, Mark Read)
  - Added requireInteraction flag to keep notifications visible
  - Included sound configuration for notifications
  - Enhanced notification payload from backend with all options
  - Service worker now properly handles vibration and sound
  - Test notifications now include vibration for testing

## [1.11.19] - 2025-08-07

### Added
- **Mobile Navigation Enhancement**
  - Added booking icon (Calendar) to mobile navigation bar on dashboard
  - Quick access to Skedda booking system directly from mobile dashboard
  - Icon positioned next to Messages for easy thumb reach
  - Opens booking site in new tab to preserve app state

### Fixed
- **Splashtop Control Button**
  - Fixed Control button in Messages page not opening Splashtop app on mobile
  - Implemented iframe-based URL scheme launching for better reliability
  - Added automatic fallback to web interface if app doesn't open
  - Works with Splashtop Business app (splashtopbusiness:// scheme)

- **Messaging System Improvements**
  - Fixed dashboard message selection not loading full conversation history
  - Dashboard now properly calls selectConversation to fetch complete history
  - Fixed notification badge not clearing when conversations are marked as read
  - Implemented centralized MessagesContext for consistent unread count management
  - Badge now updates immediately when marking conversations as read
  - Reduced polling frequencies to prevent rate limiting:
    - Messages page: 5s → 15s
    - Unread count check: 30s → 60s
    - MessagesCard refresh: 30s → 60s
  - **Improved Message Loading UX**:
    - Only loads last 30 messages initially (standard messaging app behavior)
    - No more scrolling animation through entire conversation history
    - Added "Load earlier messages" button for viewing older messages
    - Instant scroll to bottom on conversation selection (no animation)

## [1.11.18] - 2025-08-06

### Testing Infrastructure - Phase 4
- **Service Tests Added**
  - HubSpot integration tests (12 test cases)
  - Push Notification service tests (14 test cases)
  - Comprehensive security vulnerability tests (20+ test cases)
  
- **CI/CD Pipeline**
  - GitHub Actions workflow for automated testing
  - Backend tests with PostgreSQL service container
  - Frontend test execution
  - Code quality and linting checks
  - Security vulnerability scanning
  - Build verification
  - Coverage report generation and artifacts
  - Deployment readiness checks

- **Security Testing**
  - SQL injection prevention tests
  - XSS protection validation
  - Authentication bypass prevention
  - CSRF token validation
  - Rate limiting enforcement
  - Input validation tests
  - Path traversal prevention
  - Sensitive data exposure checks
  - Session security tests
  - Security headers validation

### Added
- 3 new test files (hubspotService, notificationService, vulnerabilities)
- 46+ new test cases
- GitHub Actions CI/CD pipeline configuration
- Automated testing on every push/PR
- Security vulnerability test suite

### Improved
- Auth route tests updated for new API response formats
- Test coverage now includes critical services
- Automated quality gates for deployment
- Documentation for Phase 4 completion

## [1.11.17] - 2025-08-06

### Testing Infrastructure - Phase 3
- **Integration Tests Created**
  - Complete message flow integration test suite
  - End-to-end testing from webhook to response
  - Conversation history and context handling tests
  - Error handling and fallback scenarios
  - Multi-message conversation grouping tests

- **Test Fixes**
  - Fixed LLMService tests for new router pattern
  - Updated AssistantService test mocking
  - Improved middleware mock patterns
  - Better test isolation and cleanup

### Added
- 16 total test files now in the codebase
- Integration test suite for message processing flow
- Enhanced mock patterns for service singletons

### Improved
- Test structure and organization
- Mock dependency management
- Test coverage documentation

## [1.11.16] - 2025-08-06

### Testing Infrastructure - Phase 2
- **Messages API Test Suite**
  - Comprehensive test coverage for /api/messages endpoints
  - Tests for conversations list with pagination and search
  - Single conversation and full history endpoint tests
  - AI response suggestion endpoint testing
  - Message sending with validation tests
  - Unread count tracking tests
  - HubSpot enrichment testing
  - Snake_case format preservation verification

- **AI Automation Service Tests**
  - Assistant type detection tests (booking, emergency, tech support)
  - Pattern matching for gift cards, trackman issues, hours info
  - Confidence scoring and threshold testing
  - Feature flag respecting tests
  - Statistics tracking verification
  - Slack fallback handling tests

### Improved
- **Test Infrastructure**
  - Fixed middleware mocking issues (authenticate, roleGuard)
  - Improved service singleton mocking patterns
  - Better test isolation with proper cleanup
  - Updated test coverage from ~40% to ~45%

### Fixed
- OpenPhone test HubSpot contact mock to include required fields
- Messages test proper middleware mocking order
- AI Automation service mock imports

## [1.11.15] - 2025-08-06

### Testing Infrastructure
- **Phase 1 Testing Improvements Completed**
  - Fixed Jest configuration with coverage reporting and open handle detection
  - Created comprehensive test environment setup with .env.test
  - Improved test cleanup to prevent resource leaks
  - Added proper mocking for all external services
  - Set initial coverage thresholds at 40%

### Added
- **OpenPhone Webhook Test Suite**
  - Complete test coverage for webhook v3 format processing
  - Phone number extraction from multiple fields
  - Message grouping within 1-hour time windows
  - Incoming vs outgoing message handling
  - Webhook signature verification
  - HubSpot integration during message processing
  - Debug endpoint testing

### Fixed
- Auth route tests updated to use correct HTTP methods (POST vs PUT)
- Test module import paths corrected
- Mock service configurations aligned with actual service names
- Test database setup and teardown issues resolved

### Documentation
- Created comprehensive TESTING-IMPROVEMENT-PLAN.md
- Defined 4-phase testing improvement strategy
- Established testing goals: 80% coverage target

## [1.11.14] - 2025-08-06

### Fixed
- **OpenPhone Integration Critical Fixes**
  - Fixed webhook data extraction for OpenPhone v3 format
  - Properly handle webhook structure where data is in `object` field directly
  - Added comprehensive fallback fields for phone number extraction
  - Fixed snake_case/camelCase conversion issue that broke conversations display
  - Restored proper phone number and customer name display in Messages
  - All conversations now show correct data instead of "Unknown"

### Added
- **OpenAI API Key Handling**
  - Made OpenAI API key optional for application startup
  - Created centralized OpenAI client utility with lazy initialization
  - Application can now run without AI features when key is missing
  - Fixed startup "Overloaded" API errors

### Technical
- Added webhook-debug endpoint for troubleshooting OpenPhone webhooks
- Enhanced logging for webhook data extraction debugging
- Fixed environment validation to allow missing OPENAI_API_KEY and ENCRYPTION_KEY

## [1.11.13] - 2025-08-06

### Performance & Monitoring
- **Database Connection Consolidation**
  - Unified pool configuration with optimized settings (max 20 connections)
  - Query performance tracking with slow query detection (>1s warnings)
  - Transaction helper with automatic rollback support
  - Database health check and graceful shutdown
  - Eliminated duplicate connection patterns

- **Performance Logging Middleware**
  - Request duration tracking for all endpoints
  - System metrics monitoring (CPU, memory usage)
  - Database query statistics and slow query analysis
  - Memory leak detection with growth monitoring
  - New `/api/admin/performance` endpoint for real-time metrics

- **Frontend Logging Service**
  - Professional logging with debug/info/warn/error levels
  - Environment-aware (debug logs only in development)
  - Remote error logging capability for production
  - Console.log override to capture all logs in production
  - Helper script for bulk console.log replacement

### Technical Improvements
- Performance metrics collection with 1000-entry history
- Endpoint performance analytics with failure rates
- System resource monitoring (memory, CPU, uptime)
- Query performance insights with average duration tracking

## [1.11.12] - 2025-08-06

### Security
- **Critical Security Improvements**
  - Removed hardcoded admin password - now generates cryptographically secure random password
  - Admin credentials saved to gitignored file on first run
  - Removed all token logging from frontend to prevent exposure in browser console
  - Implemented proper session validation with user existence checks
  - Enabled Content Security Policy (CSP) headers with comprehensive directives
  - Added HSTS headers for secure transport enforcement
  - Created comprehensive security audit report (SECURITY-AUDIT-2025-08.md)

### Added
- **Desktop Dashboard Messages Card**
  - Compact Messages card showing 2 most recent conversations
  - Positioned under Request form on desktop
  - Moved Suggested Actions to sidebar for better layout

### Fixed
- TypeScript compilation errors in messages.tsx
- Removed duplicate mobile title bar in RemoteActionsBar

## [1.11.11] - 2025-08-06

### Enhanced
- **RemoteActionsBar Mobile Visibility**
  - Added darker background (bg-primary) when expanded for better contrast
  - Added accent border color and shadow effects for visual prominence
  - Implemented chevron rotation animation when expanding/collapsing
  - Applied slideUp animation for smooth panel opening
  - Enhanced hover states for better interactivity on desktop
  - Improved mobile user experience with clearer visual feedback

## [1.11.10] - 2025-08-06

### Added
- **Complete Conversation History**
  - New `/conversations/:phoneNumber/full-history` endpoint fetches all conversations
  - Messages page now shows complete customer history across all conversations
  - Visual separators indicate when new conversations started (after 1-hour gaps)
  - Header shows total conversation count for customers with multiple sessions
  - Preserves context from all previous interactions for better support

### Enhanced
- **Message Display**
  - Conversation separators show time gap between sessions
  - Both desktop and mobile views support full history
  - Auto-loads complete history when selecting a conversation
  - Maintains chronological order across all conversations

## [1.11.9] - 2025-08-06

### Fixed
- **Gift Card Automation Database Issues**
  - Removed incorrect phone_number column reference in incrementResponseCount
  - Created force migration (051) to ensure missing tables are created
  - Fixed ai_automation_response_tracking table creation
  - Fixed assistant_type columns in openphone_conversations
  - Migrations now handle cases where previous migrations failed

## [1.11.8] - 2025-08-05

### Fixed
- **Gift Card Automation**
  - Fixed AssistantService initialization timing issue with Railway environment variables
  - Implemented lazy loading pattern using JavaScript Proxy for on-demand initialization
  - Fixed database column references from `active` to `is_active` in OpenPhone routes
  - Lowered confidence threshold from 0.7 to 0.5 for gift card pattern matching
  - Enabled LLM analysis for all messages, not just initial conversations
  - Added missing `ai_automation_response_tracking` table for response counting
  - Added missing `assistant_type` columns to `openphone_conversations` table
  - Fixed migration 010 execution order by wrapping in DO blocks with existence checks

### Technical
- Fixed migration runner to handle DO blocks and complex SQL statements properly
- Added proper table/index existence checks before creation in migrations
- Ensured triggers are only created when target tables exist
- Gift card automation now fully functional with proper confidence scoring

## [1.11.7] - 2025-08-05

### Enhanced
- **Push Notifications for OpenPhone Messages**
  - Added support role to receive push notifications (previously only admin/operator)
  - Improved notification formatting with clearer title "New OpenPhone Message"
  - Enhanced message preview with sender name and truncated body
  - Added deep link data to navigate directly to /messages page on click
  - Notifications now include conversation ID for future direct navigation
  - Created test script `test-openphone-push.js` to simulate incoming messages
  - Full documentation in `push-notify-openphone.md`

### Technical
- Updated OpenPhone webhook handler to send notifications to all relevant roles
- Notification payload includes proper PWA deep linking with `url: '/messages'`
- Service worker already handles click navigation to messages page
- Push notifications work on Android, iOS (16.4+ PWA), and desktop browsers

## [1.11.6] - 2025-08-04

### Added
- **AI Processing for OpenPhone Conversations**
  - Created new endpoint `/api/openphone-processing/process-conversations` to extract knowledge from unprocessed conversations
  - Added support for processing up to 50 conversations at a time using GPT-4
  - Extracts common questions, solutions, and reusable knowledge with confidence scoring
  - Stores extracted knowledge in `extracted_knowledge` table for future reference
  - Updated frontend "AI Processing" button to call the new endpoint
  - Added `processed_at` timestamp column to track when conversations were processed
  - Knowledge extraction focuses on: gift cards, booking, access, technical issues, hours, membership

### Fixed
- **Gift Card Automation Not Working**
  - Fixed assistant service initialization to use process.env directly instead of config object
  - This resolves timing issues with Railway where environment variables weren't available at module load time
  - Changed OPENAI_API_KEY checks from config.OPENAI_API_KEY to process.env.OPENAI_API_KEY
  - Applied same fix to llmService and knowledgeRouter services
  - Fixed knowledge search to handle route name variations (e.g., 'Booking & Access' vs 'booking')
  - Gift card knowledge stored as 'booking' will now be found when querying 'Booking & Access' assistant
  - Gift card automation should now properly detect API keys and respond to customer messages with the stored knowledge

## [1.11.5] - 2025-08-04

### Fixed
- **Messaging Module Backend Error**
  - Fixed incorrect parameter order in sendMessage call in messaging/handlers/messages.ts
  - Was passing (to, body, from) instead of correct order (to, from, body)
  - This was causing messages to fail when sent through certain endpoints
  - Backend now compiles and runs without errors

### Verified
- All other reported TypeScript errors in the changelog were already correct in the code
- AI automations feature is integrated into operations.tsx page (not a separate page)
- Backend builds successfully with `npm run build`
- Both frontend and backend servers start without critical errors

## [1.11.4] - 2025-08-03

### Fixed
- **AI Automations Module Import Error**
  - Fixed incorrect import from 'roleAuth' to 'roleGuard' in ai-automations.ts
  - This was preventing backend from starting with "Module not found" error
  - All requireRole calls updated to use roleGuard middleware
  - Production deployment should now work correctly

- **Messaging Module TypeScript Errors**
  - Fixed sendMessage call to use correct parameter order (3 params not object)
  - Changed generateResponse to generateSuggestedResponse method name
  - Fixed OpenPhoneService method calls (checkConnection → testConnection)
  - Updated notification payload structure (moved type field to data object)
  - Fixed insertOpenPhoneConversation to use camelCase parameters
  - Fixed NotificationService calls (broadcastToRole → sendToRole)
  - Commented out non-existent HubSpot updateLastContact method
  - Fixed SuggestedResponse property access (content → suggestedText)
  - Backend now builds successfully without TypeScript errors

### Known Issues
- Railway only has production environment, changes need to be merged to main branch
- Vercel has both production and refactor branch deployments
- AI automations page may not work until backend is deployed to production

## [1.11.3] - 2025-08-03

### Testing Improvements
- **Frontend Tests Added**
  - RoleTag component test with full coverage
  - Toggle component test with interaction testing
  - PasswordStrengthIndicator component test (comprehensive)
  - Improved from 0.32% baseline coverage

- **Backend Tests Fixed**
  - LLMService test updated for new route names
  - Fixed async test issues with isConfigured method
  - Updated expectations: 'booking' → 'Booking & Access', etc.
  - AI Automations routes test suite added

- **Test Infrastructure**
  - Created TEST-COVERAGE-UPDATE.md with roadmap to 80% coverage
  - Identified failing tests and created fix plan
  - Estimated 1 week effort to reach 80% coverage target

### Fixed
- Backend test TypeScript imports and expectations
- Frontend test mocking for next/router

### Known Issues
- Frontend store tests still failing (router.push issue)
- Backend integration tests need module import fixes
- Overall coverage still below target (Backend: ~4%, Frontend: <5%)

## [1.11.2] - 2025-08-03

### Added
- **AI Automation Safety & Configuration**
  - Response limit tracking (configurable 1-10 per conversation)
  - Toggle between AI assistant knowledge and custom hardcoded responses
  - Per-feature response limits (e.g., gift cards: 2 to allow thank you response)
  - Response tracking table to prevent spam
  - UI configuration panel with settings gear icon
  - Edit custom responses directly in the interface
  - Helper text explaining response limits use case

### Enhanced
- **Customer-Facing Response Transformation**
  - Automatically converts "Tell them..." to direct "You..." format
  - Ensures all automated responses speak directly to customers
  - Proper context passing with `isCustomerFacing` flag

### Simplified
- Removed extra automations (hours, membership, simulator, TV)
- Only keeping gift cards and trackman as originally requested
- Gift cards can trigger from any conversation context
- Trackman only triggers in tech support context

### Fixed
- All automations now use actual assistant knowledge (no hardcoded defaults)
- Gift card automation pulls from Booking & Access assistant
- Pattern matching for all automations (not just keywords)
- Fixed method name from queryAssistant to getAssistantResponse

### Technical
- Migration `031_add_automation_response_limits.sql` adds response tracking
- Migration `032_remove_extra_automations.sql` removes unused features
- New API endpoint `/api/ai-automations/:featureKey/config`
- Response count tracking per conversation and per feature
- Advanced pattern matching in `aiAutomationPatterns.ts`

## [1.11.1] - 2025-08-03

### Added
- **Conversation Categorization System**
  - New database columns to track which assistant type handles each conversation
  - Automatic categorization of all incoming messages (Emergency, Booking & Access, TechSupport, BrandTone)
  - Routing history tracking to see how conversations are categorized over time
  - API endpoint `/api/ai-automations/conversation-stats` for analytics by assistant type
  - Enhanced learning system that tracks patterns by conversation category
  - Migration `028_add_conversation_categorization.sql` adds necessary database fields

### Enhanced
- **AI Learning System**
  - Now tracks assistant type for all missed automation opportunities
  - Groups learning patterns by conversation category for better accuracy
  - Enables category-specific automation improvements

### Fixed
- Updated OpenPhone webhook handler to store conversation types
- Enhanced aiAutomationService to include assistant type in all responses

## [1.11.0] - 2025-08-03

### Added
- **AI Automation System** - Configurable automated responses and actions
  - New database schema for automation features and usage tracking
  - Admin/Operator settings page at `/ai-automations`
  - Toggle individual features or entire categories on/off
  - Usage statistics and success rate tracking
  - Required user confirmation for sensitive actions

- **Initial Automations**
  - **Gift Cards** - Auto-respond with purchase link when customers ask about gift cards
  - **Hours of Operation** - Automatically provide business hours
  - **Membership Info** - Share membership benefits and options
  - **Trackman Reset** - Reset frozen Trackman units via NinjaOne (requires confirmation)
  - **Simulator Reboot** - Remotely reboot simulator PCs (requires confirmation)
  - **TV System Restart** - Fix display issues remotely (requires confirmation)

- **Backend Infrastructure**
  - `/api/ai-automations` endpoints for managing features
  - `aiAutomationService` for processing messages and executing actions
  - Integration with OpenPhone webhook for automatic message processing
  - Confirmation workflow for sensitive actions
  - Comprehensive usage logging and analytics

- **Frontend Components**
  - AI Automations settings page with toggle switches
  - Real-time usage statistics display
  - Category-based bulk toggle controls
  - Mobile-responsive design

### Technical Details
- Database migration: `026_ai_automation_features.sql`
- New routes: `ai-automations.ts`
- New service: `aiAutomationService.ts`
- OpenPhone webhook enhanced to process automations
- Navigation updated to include AI Automations for admin/operator roles

## [1.10.5] - 2025-08-03

### Testing Infrastructure
- **Backend Testing**
  - Fixed TypeScript configuration issues for Jest
  - Created separate tsconfig.test.json for test compilation
  - Added @jest/globals imports to fix type errors
  - Created .env.test for isolated test environment
  - Exported app instance from index.ts for testing
  - Backend tests now run (with some failures due to API changes)

- **Frontend Testing**
  - Set up complete Jest + React Testing Library infrastructure
  - Created jest.config.js with Next.js configuration
  - Added comprehensive jest.setup.js with mocks for Next.js router
  - Created initial component tests (Button, Input)
  - Created state management tests (useStore)
  - Achieved basic test coverage reporting (0.32% starting point)

### Security Improvements
- **Rate Limiting**
  - Enabled production-only rate limiting
  - General: 100 requests/15 minutes
  - Auth endpoints: 5 attempts/15 minutes
  - LLM endpoints: 5 requests/minute (production)
  - Public endpoints: 20 requests/minute
  - Rate limiting automatically disabled in development

### Documentation
- **Testing Guide** (TESTING-GUIDE.md)
  - Comprehensive testing instructions
  - Backend and frontend test commands
  - Writing test examples
  - Known issues and solutions
  - Coverage improvement roadmap

- **Security Audit Report** (SECURITY-AUDIT-REPORT.md)
  - Full security analysis (91% security score)
  - Test coverage assessment
  - Detailed findings for all security measures
  - Recommendations for improvements

### Added
- Frontend testing dependencies (@testing-library/react, jest, etc.)
- Test scripts in frontend package.json
- Backend tsconfig.test.json for test compilation
- Sample component tests for Button and Input components
- State management tests for Zustand stores
- Production-only rate limiting configuration

### Fixed
- Jest setup file TypeScript errors
- Backend test compilation issues
- Frontend router mocking for tests
- CSRF token handling in test environment

### Known Issues
- Backend tests have some failures due to changed API routes
- Frontend store tests have issues with dynamic router imports
- Overall test coverage still low (needs to reach 80%)

## [1.10.4] - 2025-08-02

### Security
- **Critical Security Updates**
  - Updated Next.js from 14.0.4 to 15.4.5 fixing multiple critical vulnerabilities (SSRF, cache poisoning, DoS)
  - Changed X-Frame-Options from ALLOWALL to SAMEORIGIN to prevent clickjacking attacks
  - Implemented proper CSRF protection with custom token generation and validation
  - Added comprehensive security test suite covering SQL injection, XSS, authentication, and more
  - Created environment security validator to ensure secure configuration
  - Added security verification script for automated security checks
  - Removed deprecated csurf package, using custom CSRF implementation

### Added
- Security test directory with comprehensive test utilities
- Environment security validation on startup
- CSRF token generation and validation system
- Security verification script (verify-security.sh)
- Cookie-parser middleware for CSRF token handling

### Improved
- Security headers now properly restrict iframe embedding
- Frontend axios client configured for CSRF token inclusion
- All POST/PUT/DELETE requests now require CSRF validation
- Environment variables validated for security on startup

### Fixed
- All npm vulnerabilities resolved (0 vulnerabilities in both frontend and backend)
- Next.js critical security vulnerabilities patched
- X-Frame-Options header properly configured

## [1.10.3] - 2025-08-01

### Added
- **High Performance Animations**
  - GPU-accelerated animations for 60fps+ performance
  - Adaptive animation timing for 120Hz/144Hz displays
  - Hardware acceleration using CSS transforms
  - RequestAnimationFrame optimization
  - Performance monitoring system
  - Reduced motion support for accessibility

### Added
- **Quick Messages Access**
  - Prominent "Open Messages" button on dashboard
  - Shows unread message count badge
  - One-tap access without navigation menu
  - Only visible for admin, operator, and support roles

- **Swipe Navigation for PWA**
  - Native-feeling swipe gestures between pages
  - Swipe right to go back, left to go forward
  - Visual indicators show swipe availability
  - Bottom dots show current page position
  - Respects user role permissions
  - Works seamlessly with vertical scrolling

### Improved
- Mobile navigation experience
- PWA feels more like a native app
- Faster access to critical features

### Fixed
- Messages now properly align to bottom when keyboard opens
- Fixed issue where few messages stayed at top of screen
- Improved scroll behavior when selecting conversations

## [1.10.2] - 2025-08-01

### Fixed
- **Ticket Page Mobile Experience**
  - Increased touch targets to minimum 44px for better mobile usability
  - Improved spacing and padding throughout ticket cards
  - Larger, more readable text sizes (16px titles, 14px body)
  - Enhanced filter pills with better visual feedback
  - Modal redesign with proper mobile safe areas
  - Consistent design language matching dashboard and messages pages

- **Messages Duplicate Display Bug**
  - Fixed issue where sent messages appeared twice in the UI
  - Added message deduplication by ID to prevent duplicates
  - Resolved race condition between local state updates and server refresh
  - Messages now display correctly without duplication

### Improved
- Ticket cards now have better breathing room and visual hierarchy
- Search bar and filter controls are more touch-friendly
- Empty states have clearer messaging and larger icons
- Loading states are more prominent and consistent

## [1.10.1] - 2025-08-01

### Added
- **PWA Support Phase 1**
  - Valid PNG icons in multiple sizes (192x192, 512x512)
  - Maskable icon variants for Android adaptive icons
  - Web app manifest with full Android compliance
  - PWA meta tags in document head
  - Middleware updated to allow public file access
  - All Android installability requirements met

- **PWA Support Phase 2**
  - Service worker with offline caching support
  - Push notification handling infrastructure
  - Offline page with auto-reload functionality
  - Background sync capabilities
  - Service worker registration for all users

### Technical
- Added prefer_related_applications: false for Chrome compliance
- Icons configured with "any maskable" purpose for Android
- Theme color set to ClubOS brand color (#0B3D3A)
- Display mode set to standalone for app-like experience
- Service worker handles offline/online states
- Smart caching strategy for static assets

## [1.10.0] - 2025-07-31

### Added
- **AI-Assisted Customer Messaging**
  - AI suggestion button in message interface for generating contextual responses
  - Integration with ClubOS assistants for knowledge-based responses
  - Customer safety filter ensures only public information is shared
  - Edit suggestions before sending for personalization
  - Confidence scores displayed for each suggestion
  - Automatic route selection based on message content (Booking, Tech Support, etc.)

- **OpenPhone API Enhancements**
  - User ID support for proper message attribution
  - Call transcript retrieval (requires Business plan)
  - Call listing with transcript availability status
  - Knowledge extraction from call transcripts using AI
  - Rate limiting (10 requests/second) with exponential backoff
  - Enhanced error handling for all API status codes
  - International phone number formatting support

- **Data Privacy & Security**
  - AES-256-GCM encryption for sensitive conversation data
  - Phone number anonymization in logs (country code + last 4 digits)
  - Comprehensive audit logging for all data access
  - GDPR compliance features:
    - Data export (right to access)
    - Data deletion/anonymization (right to erasure)
    - Automated retention policies
    - Consent management system
  - Data retention policies:
    - Conversations: 2 years
    - Call transcripts: 1 year
    - AI suggestions: 90 days
    - Auth logs: 1 year

### Fixed
- CORS configuration for Vercel deployments
- Added proper error response headers for 401/403 errors
- React hydration errors in messages page
- Phone number validation for E.164 format

### Security
- Customer safety filter for AI responses (no internal info shared)
- Encrypted storage for AI-generated suggestions
- Secure token generation for sensitive operations
- Enhanced logging with data masking

## [1.9.2] - 2025-07-30

### Added (Push Notifications - Phase 3)
- **Frontend Implementation**
  - Service worker (sw.js) for handling push notifications
  - React hook (usePushNotifications) for subscription management
  - Notification permission UI in Messages page
  - Bell/BellOff icons for clear notification status
  - Auto-registration of service worker on login
  
- **PWA Support**
  - Web app manifest for installability
  - Apple touch icon support
  - Standalone display mode
  - Theme color matching ClubOS brand (#0B3D3A)
  
- **User Experience**
  - Simple on/off toggle in Messages header
  - Loading states during subscription changes
  - Toast notifications for success/error feedback
  - Automatic focus to Messages page when notification clicked
  
### Technical Details
- ✅ Service worker created with push event handling
- ✅ Notification click actions route to appropriate pages
- ✅ VAPID public key integrated in frontend
- ✅ PWA manifest for iOS/Android support
- ✅ Placeholder icons created (need real icons in production)

### Next Steps
- Replace placeholder icons with actual ClubOS branded icons
- Test push notifications end-to-end with real messages
- Add notification preferences UI for granular control
- Monitor notification delivery rates in production

## [1.9.1] - 2025-07-30

### Added (Push Notifications - Phase 1)
- **Database Infrastructure**
  - Migration 019: push_subscriptions, notification_history, notification_preferences tables
  - Indexes for performance optimization
  - User notification preference storage
  
- **Backend Services**
  - NotificationService with web-push integration
  - VAPID key generation script
  - Environment validation for push notification config
  - Quiet hours support for notifications
  - Failed subscription handling and retry logic

### Added (Push Notifications - Phase 2)
- **API Endpoints**
  - GET /api/notifications/vapid-key - Get public key for frontend
  - POST /api/notifications/subscribe - Subscribe to push notifications
  - DELETE /api/notifications/subscribe - Unsubscribe
  - GET /api/notifications/subscription-status - Check subscription status
  - PUT /api/notifications/preferences - Update notification preferences
  - POST /api/notifications/test - Send test notification (admin only)
  - GET /api/notifications/history - View notification history (admin only)
  - GET /api/notifications/analytics - Notification analytics (admin only)

- **OpenPhone Integration**
  - Webhook now sends push notifications for inbound messages
  - Notifications sent to all admin, operator, and support users
  - Separate notifications for new conversations vs existing ones
  - Message preview in notification body (truncated to 100 chars)

### Technical Progress
- ✅ Database migration created
- ✅ VAPID keys generated
- ✅ web-push package installed
- ✅ NotificationService implemented
- ✅ API endpoints created
- ✅ OpenPhone webhook integration
- ⏳ Service worker (Phase 3 - next chat)
- ⏳ Frontend implementation (Phase 3 - next chat)

### Environment Variables Required
Add these to your .env files:
```bash
# Backend .env
VAPID_PUBLIC_KEY=BPSi4FpNO9pAc_g9_I0rvF5krHxRrh-d2Kl5c1p8tznb87J4JtM8XYLmG2dylr0pfU9vuOPBc_850xkCOdnnhdU
VAPID_PRIVATE_KEY=N8VNoI2cR_2Y3O9FJG7PszhLYSIomo09Sp0nSB43AzQ
VAPID_EMAIL=mailto:support@clubhouse247golf.com

# Frontend .env.local
NEXT_PUBLIC_VAPID_PUBLIC_KEY=BPSi4FpNO9pAc_g9_I0rvF5krHxRrh-d2Kl5c1p8tznb87J4JtM8XYLmG2dylr0pfU9vuOPBc_850xkCOdnnhdU
```

### Next Steps for New Chat
1. Create service worker in public/sw.js
2. Add push notification React hooks
3. Create notification permission UI in Messages page
4. Test end-to-end push notifications
5. Add PWA manifest for iOS support

## [1.9.0] - 2025-07-30

### Added
- **OpenPhone Messages Integration**
  - Two-way SMS messaging interface at `/messages`
  - Real-time conversation view with chat interface
  - Send and receive messages directly from ClubOS
  - Unread message counts and badges
  - Message notifications throughout the app
  - Auto-refresh every 10 seconds for new messages
  - Mobile-optimized responsive design
  - Contact name resolution with phone number fallback
  - Rate limiting: 30 messages per minute per user

### Features
- **Navigation Enhancements**
  - Messages added to main navigation with 💬 icon
  - Red badge shows unread message count
  - Works on both desktop and mobile views
  - Operations reordered next to ClubOS Boy

- **Real-time Notifications**
  - Toast notifications for new messages
  - Only shows when not on Messages page
  - Polls for new messages every 30 seconds
  - Integrates with existing notification system

- **Public ClubOS Boy**
  - Available without authentication for HubSpot
  - 60-second auto-timeout for public safety
  - Rate limiting to prevent abuse
  - Contact details added to interface

### Changed
- Checklists now support admin-only task editing
- Navigation order optimized for workflow
- Operations page defaults to Analytics view

### Fixed
- Database schema compatibility for different versions
- React hydration errors in Messages interface
- Null safety throughout Messages components
- Date formatting with proper validation

### Technical
- Added migrations 017 and 018 for Messages support
- Enhanced OpenPhone webhook handling
- Improved error handling and logging
- Added verification and update scripts

## [1.8.5] - 2025-07-29

### Added
- Natural language knowledge update system with GPT-4o router
- Database-first search to reduce OpenAI API calls  
- Knowledge audit log table for complete update history
- Assistant knowledge persistence in PostgreSQL
- Markdown formatting support for assistant responses
- Archive folder structure for old scripts and docs

### Changed
- Replaced vector-based SOP system with assistant-routed architecture
- Simplified assistantFileManager to use database storage
- Improved response formatting with ReactMarkdown
- Cleaned up codebase - archived 50+ old test scripts

### Fixed
- TypeScript compilation errors in backend
- Assistant response formatting in dashboard
- Knowledge router validation middleware

### Removed
- Old SOP module and vector database dependencies
- Unnecessary file management code for OpenAI assistants
- Redundant test and debug shell scripts

## [1.8.3] - 2025-07-28

### Added
- **Knowledge Management Section**
  - New Knowledge toggle under Operations (admin only)
  - Card-based layout for better organization
  - Recent Messages component with live OpenPhone conversations
  - Auto-refresh every 8 seconds for real-time updates
  - Manual refresh button for testing
  - Debug endpoint for troubleshooting connection issues

### Changed
- **Knowledge Center Restructuring**
  - Moved Knowledge from top-level navigation to Operations section
  - Split into separate cards: SOP Control, Knowledge Extraction, Recent Messages, Feedback
  - Removed money saved calculations from shadow mode performance
  - Updated empty states with more informative messages

### Improved
- **Feedback Section**
  - Added Refresh, Export for Claude, and Clear All buttons
  - Proper button states and loading indicators
  - Responsive design with mobile-friendly buttons
  - Updated title to "Not Helpful Feedback"
  - Better empty state messaging

### Fixed
- TypeScript errors in Knowledge page with FeedbackResponse component
- Recent Messages now shows historical data from database
- Proper error handling and debugging features
- Consistent UI patterns across Operations and Knowledge sections

## [1.8.1] - 2025-07-28

### Added
- **Dashboard Enhancements**
  - ClubOS logo with version display (Clubhouse Green #0B3D3A)
  - Weekly checklist submissions counter card
  - Slack connection status indicator
  - Quick access button to checklists page
  - Mobile-friendly 2-column grid for dashboard cards

### Fixed
- Vercel build error - useStore/useAuthState hook usage in ChecklistSystem
- Dashboard cards now display on mobile devices

### Changed
- Replaced "Active Bookings" card with "Weekly Checklists" 
- Replaced "Avg Response Time" with "Slack Status"
- Dashboard cards are now visible on all screen sizes
- ClubOS logo aligned left with proper brand guidelines

### Improved
- Mobile UI for quick access to cleaning checklists
- Root folder organization - moved scripts to appropriate directories
- Documentation structure - archived old deployment docs

## [1.8.0] - 2025-07-28

### Added
- **Enhanced Checklist System**
  - Comment field for adding notes about issues or maintenance needs
  - Automatic ticket creation from checklists with comments
  - Delete functionality for checklist submissions (admin/operator only)
  - Integration with existing ticket system
  - Ticket includes incomplete tasks and user comments
  - Database columns: comments, ticket_created, ticket_id

- **Checklist Improvements**
  - Fixed "Failed to load submission history" error
  - Changed date filters to show current week/month instead of last 7/30 days
  - Fixed 500 error when filtering by date
  - Fixed React hydration errors
  - Improved error handling to prevent false error messages

### Fixed
- Checklist submissions count query parameter handling
- Date filtering now properly shows "This Week" and "This Month"
- Backend compilation errors for deployment
- Sentry integration updated to v9 compatibility

### Changed
- Checklist tracker now defaults to current week
- Better TypeScript type definitions for Express middleware

## [1.7.1] - 2025-07-28

### Added
- **Sentry Error Tracking**
  - Real-time error monitoring for both frontend and backend
  - Automatic error grouping and alerting
  - Performance monitoring with transaction tracing
  - Session replay for debugging user issues
  - Environment-specific configuration (dev/prod)
  - Sensitive data filtering (auth tokens, cookies)

- **Enhanced Rate Limiting**
  - Re-enabled production rate limiting (100 req/15min)
  - Separate limits for auth endpoints (5 attempts/15min)
  - LLM-specific rate limiting (10 req/min)
  - Skip for admin users and health checks
  - Sentry integration for tracking violations

- **Graceful Shutdown**
  - Proper connection draining on SIGTERM/SIGINT
  - Database connection cleanup
  - Sentry event flushing
  - 30-second timeout for forced shutdown
  - Keep-alive timeout optimization

- **Request Validation & Sanitization**
  - Input sanitization middleware for XSS prevention
  - Script tag and JavaScript URL filtering
  - Common validation utilities
  - Express-validator integration

### Improved
- **System Stability**
  - Better error handling for uncaught exceptions
  - Unhandled promise rejection tracking
  - Health check endpoint reliability
  - Server startup logging improvements
  - Production-ready error recovery

### Security
- Rate limiting properly configured for production
- Input sanitization on all endpoints
- Enhanced error logging without exposing sensitive data

## [1.7.0] - 2025-07-27

### Added
- **NinjaOne Remote Actions Integration**
  - Remote control of simulator PCs and facility systems
  - Support for TrackMan, music system, and TV controls
  - PowerShell scripts for automated actions
  - Real-time job status tracking
  - Demo mode with simulated responses
  - Comprehensive action logging to database
  - Slack notifications for critical actions
  - Location-based device management (Bedford, Dartmouth, Stratford, Bayers Lake, Truro)
  - Role-based access control (operator+ required)

- **Remote Actions UI**
  - New Remote Actions tab in Commands page
  - Location-grouped control interface
  - Bay-specific controls with multiple action types
  - System-wide controls for music and TV
  - Visual feedback with loading states
  - Confirmation dialogs for destructive actions

### Technical
- 7 PowerShell scripts for different action types
- NinjaOne API service with OAuth2 authentication
- Database migration for action history tracking
- Full integration with existing auth system

## [1.6.1] - 2025-07-27

### Changed
- **Commands Page Redesign**
  - Modern UI matching Dashboard's minimalist style
  - Renamed "Triggers" to "Remote Actions" for clarity
  - Implemented pill-style category tabs
  - Added collapsible sections for Remote Actions
  - Updated typography and spacing throughout
  - Improved button styles with consistent hover states

### Fixed
- TypeScript compilation errors in backend (AppError class constructor)
- Vercel deployment issues (removed experimental CSS optimization)
- Import errors in commands.tsx (removed non-existent Header component)
- Various type errors in auth.ts, slack.ts, tone.ts, and gptWebhook.ts

## [1.6.0] - 2025-07-26

### Added
- **PostgreSQL Integration**
  - Migrated from JSON file storage to PostgreSQL
  - Automatic table creation and migrations
  - Connection pooling for better performance
  - Database backup/restore functionality

- **System Configuration UI**
  - Operations page system config tab
  - Slack notification controls
  - Feature toggles for system components
  - Real-time configuration updates

- **Enhanced LLM System**
  - All GPT Assistant IDs configured in Railway
  - Context injection from conversation history
  - Route normalization for consistency
  - Improved error handling and fallbacks
  - Session tracking for multi-turn conversations

### Changed
- **Documentation Overhaul**
  - Consolidated 30+ markdown files into organized structure
  - Created archive for completed features
  - Updated README with current system state
  - Added comprehensive testing guide

- **Security Improvements**
  - Fixed trust proxy settings for Railway
  - Enhanced rate limiting configuration
  - Improved input validation

### Fixed
- LLM response display now shows full structured data
- Route naming inconsistencies (Booking&Access vs Booking & Access)
- Authentication token handling in frontend
- Slack notification logic for different scenarios

## [1.5.0] - 2025-01-25

### Added
- **ClubOS Boy**: Customer-facing kiosk interface
  - Simplified question/answer interface
  - Auto-reset after 30 seconds of inactivity
  - Direct routing to Slack for all customer queries
  - Touch-friendly design for public terminals

- **Kiosk Role**: New user role for customer terminals
  - Restricted access to ClubOS Boy only
  - Automatic redirect from other pages
  - Easy creation via Operations page

- **Ticket System Enhancements**
  - Ticket count badges on filter buttons
  - Improved empty state messaging
  - Persistent "New Ticket" button
  - Visual grouping of active/historical statuses
  - Auto-enable ticket mode when navigating from Ticket Center

### Changed
- Updated location examples to match facility naming (Bedford Box 2, Dartmouth Box 4)
- Improved Smart Assist helper text visibility
- Enhanced ticket preview format with time ago display
- Better tab highlighting in Ticket Center

### Fixed
- Smart Assist toggle text positioning
- Ticket list UI improvements for better readability

## [1.4.0] - 2025-01-24

### Added
- **Comprehensive Ticket Management System**
  - Create support tickets for facilities and tech issues
  - Priority levels: Low, Medium, High, Urgent
  - Status tracking: Open, In Progress, Resolved, Closed
  - Comment system for ticket updates
  - Filtering by status and category
  - Admin ability to clear tickets

- **Ticket Mode Toggle**
  - Switch between request processing and ticket creation
  - Integrated into main RequestForm
  - Visual indicators for current mode

### Changed
- Migrated from JSON file storage to PostgreSQL
- Deployed on Railway platform
- Updated all data persistence to use database

## [1.3.0] - 2025-01-23

### Added
- **Feedback System**
  - Users can mark AI responses as helpful/not helpful
  - Feedback tracking in Operations dashboard
  - Export feedback for AI training
  - Unhelpful response alerts to Slack

- **User Management UI**
  - Full CRUD operations for users
  - Role assignment (Admin, Operator, Support)
  - Password reset functionality
  - User creation from Operations page

### Changed
- Enhanced Operations page with tabbed interface
- Added feedback log section
- Improved user table with inline editing

## [1.2.0] - 2025-01-22

### Added
- **Role-Based Access Control (RBAC)**
  - Three roles: Admin, Operator, Support
  - Route-level permissions
  - UI elements hidden based on role
  - Secure middleware for API protection

- **Operations Dashboard**
  - System status monitoring
  - User management interface
  - Quick stats display
  - Backup/restore functionality

### Security
- JWT authentication implementation
- Secure password hashing with bcrypt
- Session management
- Protected API endpoints

## [1.1.0] - 2025-01-21

### Added
- **Smart Assist Toggle**
  - Switch between AI processing and Slack routing
  - Visual indicators for current mode
  - Smooth transition animations

- **Enhanced UI/UX**
  - Dark/light theme support
  - Responsive design for mobile
  - Loading animations
  - Keyboard shortcuts (Ctrl+Enter, Esc, Ctrl+D)

### Changed
- Improved error handling and user feedback
- Better form validation
- Enhanced visual hierarchy

## [1.0.0] - 2025-01-20

### Initial Release
- **Multi-Agent LLM Routing**
  - Automatic request classification
  - Four specialized routes: Emergency, Booking & Access, Tech Support, Brand Tone
  - Confidence scoring
  - Manual route override option

- **Slack Integration**
  - Fallback for human support
  - Structured message formatting
  - Thread tracking preparation

- **Core Features**
  - Request processing interface
  - Response display with metadata
  - Demo mode for testing
  - Basic logging system

### Technical Foundation
- Next.js frontend with TypeScript
- Express backend with TypeScript
- OpenAI GPT-4 integration
- Modular architecture

---

## Version History

- **1.8.3** - Knowledge Center Restructuring & Live Updates
- **1.8.2** - Intelligent SOP System & OpenPhone Integration
- **1.8.1** - Dashboard Enhancements & Weekly Checklists
- **1.8.0** - Enhanced Checklist System with Comments & Ticket Creation
- **1.7.1** - System Stability & Error Tracking
- **1.7.0** - NinjaOne Remote Actions Integration
- **1.6.1** - Commands Page Redesign
- **1.6.0** - PostgreSQL & Enhanced LLM System
- **1.5.0** - Customer Kiosk & Enhanced Tickets
- **1.4.0** - Ticket Management System
- **1.3.0** - Feedback System & User Management
- **1.2.0** - RBAC & Operations Dashboard
- **1.1.0** - Smart Assist & UI Enhancements
- **1.0.0** - Initial Release

For detailed commit history, see the Git log.
