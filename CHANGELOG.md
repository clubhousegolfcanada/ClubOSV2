# Changelog

All notable changes to ClubOS will be documented in this file.

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
