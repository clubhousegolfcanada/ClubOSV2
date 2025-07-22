# Role-Based Access Control (RBAC) Documentation

## Overview
ClubOSV1 implements a comprehensive RBAC system across both backend and frontend to control access to features and routes based on user roles.

## Role Hierarchy
```
admin > operator > support
```

- **admin**: Full access to all features and routes
- **operator**: Standard access with some restrictions (default role)
- **support**: Read-only access to most features

## Backend Implementation

### JWT Structure
```typescript
interface JwtPayload {
  userId: string;
  email: string;
  role: UserRole;
  exp?: number;
}
```

### Protected Routes
| Route | Allowed Roles | Description |
|-------|---------------|-------------|
| `/api/access/unlock` | admin only | Door unlock functionality |
| `/api/llm/request` | admin, operator | LLM request processing |
| `/api/bookings/*` | all authenticated | Booking management |
| `/api/slack/message` | all authenticated | Slack messaging |
| `/api/auth/*` | unrestricted | Authentication endpoints |

### Middleware Usage
```typescript
// Example: Protecting a route
router.post('/unlock', 
  authenticate, 
  roleGuard(['admin']), 
  async (req, res) => {
    // Only admins can access this
  }
);
```

## Frontend Implementation

### Role State Management
Roles are stored in Zustand store and persisted in localStorage:
```typescript
const { user, role } = useStore();
```

### UI Behavior
- **Disabled with Tooltip**: Restricted features show but are disabled with explanatory tooltips
- **Lock Icons**: Visual indicator (🔒) for restricted features
- **Role Tag**: Current role displayed in navigation

### Component Role Checks
```typescript
// Check if user has required role
const canAccess = hasRole(currentRole, ['admin', 'operator']);

// Check if route is authorized
const isAuthorized = isRouteAuthorized('/access/unlock', currentRole);
```

## Testing Roles

### Development Role Switcher
In development mode, use the role switcher in the top-right corner to test different roles:
1. Click on the current role tag
2. Select a new role from the dropdown
3. The UI will update immediately

### Backend Testing
```bash
# Run role guard tests
npm test -- roleGuard.test.ts
```

### Manual Testing Checklist
- [ ] Login creates JWT with correct role
- [ ] Admin can access all routes
- [ ] Operator cannot access admin-only routes
- [ ] Support has read-only access
- [ ] UI shows lock icons for restricted features
- [ ] Tooltips explain access requirements
- [ ] Role tag displays current role

## Security Considerations
1. **Never trust client-side role checks alone** - Always validate on backend
2. **JWT expiration** - Tokens expire after 24 hours
3. **Role changes** - Require re-authentication for role changes
4. **Default deny** - Routes are restricted by default unless explicitly allowed

## Adding New Protected Routes

### Backend
1. Import roleGuard middleware
2. Add to route definition:
```typescript
router.post('/new-route', 
  authenticate, 
  roleGuard(['admin', 'operator']), 
  handler
);
```

### Frontend
1. Update `ROUTE_PERMISSIONS` in `roleUtils.ts`
2. Use `isRouteAuthorized()` in components
3. Add visual indicators for restricted access

## Troubleshooting

### Common Issues
1. **"Forbidden" errors**: Check JWT contains valid role
2. **UI not updating**: Clear localStorage and re-login
3. **Role not persisting**: Check auth state initialization

### Debug Mode
Enable debug logging:
```typescript
// Backend
process.env.DEBUG_RBAC = 'true';

// Frontend
localStorage.setItem('debug_rbac', 'true');
```
