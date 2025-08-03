# Changelog

All notable changes to ClubOS will be documented in this file.

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
