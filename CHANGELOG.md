# Changelog

All notable changes to ClubOS will be documented in this file.

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