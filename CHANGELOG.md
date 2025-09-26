# Changelog

All notable changes to ClubOS will be documented in this file.

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