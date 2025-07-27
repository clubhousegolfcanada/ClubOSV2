# ClubOS Development - Complete Context Document

## Project Overview
ClubOS is a comprehensive golf simulator management system designed for ClubHouse247 Golf facilities. It streamlines operations by handling customer requests, equipment issues, bookings, and support tickets through an intelligent routing system that combines AI assistance with human support via Slack.

## Core Features
1. **Smart Request Processing**
   - AI-powered request routing to appropriate departments
   - Fallback to Slack for human support
   - Feedback system for continuous improvement

2. **Ticket Management System**
   - Create and track support tickets
   - Categorize by facilities or tech support
   - Priority levels and status tracking

3. **User Management**
   - Role-based access (admin, operator, support, kiosk)
   - Secure authentication with JWT
   - Kiosk mode for customer-facing terminals

4. **Operations Dashboard**
   - User management interface
   - Feedback analytics
   - System health monitoring

5. **ClubOS Boy**
   - Customer-facing kiosk interface
   - Simplified question/answer system
   - Auto-reset for public use

## Technical Stack

### Frontend
- **Framework**: Next.js 13+ with React 18
- **Language**: TypeScript
- **Styling**: Tailwind CSS with custom CSS variables
- **State Management**: Zustand
- **Forms**: React Hook Form
- **HTTP Client**: Axios
- **Animations**: Framer Motion
- **Icons**: Lucide React

### Backend
- **Runtime**: Node.js with Express
- **Language**: TypeScript
- **Database**: PostgreSQL (hosted on Railway)
- **ORM/Query Builder**: [Specify if using Prisma, TypeORM, Knex, etc.]
- **Authentication**: JWT with bcrypt
- **API Integration**: OpenAI GPT-4
- **External Services**: Slack Webhooks
- **Deployment**: Railway

## Project Structure
```
/Users/michaelbelairch1/Desktop/Clubhouse OS (Root)/CLUBOSV1/
├── ClubOSV1-frontend/          # Next.js frontend
│   ├── src/
│   │   ├── pages/             # Next.js pages
│   │   ├── components/        # React components
│   │   ├── state/            # Zustand stores
│   │   ├── hooks/            # Custom React hooks
│   │   ├── utils/            # Utility functions
│   │   ├── types/            # TypeScript types
│   │   └── styles/           # Global styles
│   └── public/               # Static assets
└── ClubOSV1-backend/          # Express backend
    ├── src/
    │   ├── routes/           # API routes
    │   ├── services/         # Business logic
    │   ├── middleware/       # Express middleware
    │   ├── utils/           # Utility functions
    │   ├── types/           # TypeScript types
    │   └── scripts/         # Admin scripts
    └── data/                # JSON data files
```

## Development Preferences

### Code Style
- **Complete Files**: Always provide complete file contents (no truncation or snippets)
- **TypeScript**: Use TypeScript for all new files
- **Error Handling**: Implement comprehensive error handling with proper logging
- **Comments**: Add comments for complex logic or business rules
- **Consistency**: Follow existing patterns in the codebase

### UI/UX Guidelines
- **Minimalist Design**: Clean, functional interface without decorative elements
- **No Unnecessary Icons**: Focus on text-based UI unless icons serve a clear purpose
- **Consistent Styling**: Use existing Tailwind classes and CSS variables
- **Responsive**: Ensure all interfaces work on mobile and desktop
- **Accessibility**: Proper ARIA labels and keyboard navigation

### Git Workflow
Always end implementations with a commit script:
```bash
cd /Users/michaelbelairch1/Desktop/Clubhouse\ OS\ \(Root\)/CLUBOSV1
git add -A
git commit -m "Brief description of change

- Detailed bullet point of what was added
- Another change that was made
- Any breaking changes or migrations needed
- Bug fixes or improvements included"
git push origin main
```

### Implementation Approach
1. **Explain Changes**: Describe what each change does and why
2. **Test Edge Cases**: Handle errors, empty states, and edge cases
3. **Backward Compatibility**: Ensure changes don't break existing features
4. **Update Types**: Keep TypeScript definitions in sync
5. **Performance**: Consider performance implications of changes

## Key APIs and Integrations

### OpenAI Integration
- Model: GPT-4 Turbo
- Used for intelligent request routing
- Fallback to manual routing if API fails
- Environment variable: `OPENAI_API_KEY`

### Slack Integration
- Webhook URL for sending messages
- Plans for Events API for reply tracking
- Environment variables:
  ```
  SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
  SLACK_CHANNEL=#clubos-requests
  ```

## Authentication & Security
- JWT-based authentication
- Role-based access control (RBAC)
- Password requirements: 8+ chars, uppercase, lowercase, number
- Token expiration: 7 days
- Secure password hashing with bcrypt

## Current Limitations & Constraints
1. **No WebSockets**: Currently no real-time communication
2. **No Email Service**: No automated email notifications
3. **Single Region**: Railway deployment in one region
4. **Rate Limiting**: Need to implement for public endpoints

## Common Development Tasks

### Adding a New Route
1. Create route file in `backend/src/routes/`
2. Add validation middleware
3. Implement business logic in services
4. Update types in `types/index.ts`
5. Add route to `index.ts`
6. Test with Postman or frontend

### Creating a New Page
1. Create page in `frontend/src/pages/`
2. Add navigation in `Navigation.tsx`
3. Implement role-based access if needed
4. Use existing components and styles
5. Add to router configuration

### Modifying Data Schema
1. Update TypeScript interfaces
2. Create migration script if needed
3. Update all affected routes/services
4. Test data integrity
5. Document changes

## Environment Setup
```bash
# Frontend (.env.local)
NEXT_PUBLIC_API_URL=http://localhost:3001/api

# Backend (.env)
PORT=3001
NODE_ENV=development
DATABASE_URL=postgresql://user:pass@host:5432/dbname
JWT_SECRET=your-secret-key
OPENAI_API_KEY=sk-...
SLACK_WEBHOOK_URL=https://hooks.slack.com/...

# Railway automatically provides DATABASE_URL
```

## Testing Approach
- Manual testing for UI/UX
- API testing with Postman
- Error scenario testing
- Cross-browser compatibility
- Mobile responsiveness

## Deployment Considerations
- Platform: Railway for both frontend and backend
- Database: PostgreSQL on Railway
- Environment variables set in Railway dashboard
- Automatic deployments from GitHub
- SSL/TLS handled by Railway
- Custom domains supported

## Sample Opening Message for New Development

```
I'm working on ClubOS, a golf simulator management system with the following setup:

Tech Stack:
- Frontend: Next.js, TypeScript, Tailwind CSS, Zustand
- Backend: Express, TypeScript, PostgreSQL on Railway
- Auth: JWT with role-based access (admin, operator, support, kiosk)

Current Task: [Describe what you want to build]

Key Constraints:
- Using PostgreSQL (not JSON files)
- No WebSockets currently
- Must maintain backward compatibility
- Clean, minimalist UI (no unnecessary icons)

Preferences:
- Provide complete file contents
- End with a git commit script
- Explain implementation decisions
- Handle errors gracefully

File paths:
- Frontend: /Users/michaelbelairch1/Desktop/Clubhouse OS (Root)/CLUBOSV1/ClubOSV1-frontend/
- Backend: /Users/michaelbelairch1/Desktop/Clubhouse OS (Root)/CLUBOSV1/ClubOSV1-backend/

[Specific question or implementation request]
```

## Frequently Needed Information

### User Roles & Permissions
- **Admin**: Full system access, user management, system settings
- **Operator**: Ticket management, operations dashboard, most features
- **Support**: Basic features, can't manage users or system settings
- **Kiosk**: Only access to ClubOS Boy interface

### Request Routing
- **Auto**: AI determines best route
- **Emergency**: Urgent facility/safety issues
- **Booking&Access**: Reservation and access control
- **TechSupport**: Equipment and technical issues
- **BrandTone**: Marketing and communication

### File Storage Patterns (PostgreSQL)
```typescript
// Example using raw SQL
const result = await pool.query(
  'SELECT * FROM users WHERE email = $1',
  [email]
);

// Example using query builder (if using Knex)
const users = await db('users')
  .where('role', 'admin')
  .orderBy('created_at', 'desc');

// Example using ORM (if using Prisma)
const user = await prisma.user.findUnique({
  where: { email }
});
```

### Common API Patterns
```typescript
// Route structure
router.post('/endpoint',
  authenticate,           // Check JWT
  roleGuard(['admin']),  // Check role
  validate([...]),       // Validate input
  async (req, res, next) => {
    try {
      // Implementation
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
);
```

## Recent Features & Updates
1. **Kiosk Role**: Special role for customer-facing terminals
2. **Ticket System**: Full ticket management with categories and priorities
3. **ClubOS Boy**: Customer kiosk interface with auto-reset
4. **Feedback System**: Track helpful/not helpful responses
5. **Smart Assist Toggle**: Switch between AI and Slack routing

## Known Issues & TODOs
- Implement Slack reply tracking
- Add WebSocket support for real-time updates
- Improve error handling in some edge cases
- Add data export functionality
- Implement automated backups
- Add email notification support

---
Last Updated: January 2025
Version: 1.0
Use this document when starting any new ClubOS development task.
