# Contractor User Account Implementation Plan

## Overview
Add a new "contractor" user role with restricted access to only the checklists feature, including Ubiquiti door unlock functionality for cleaning staff at various locations.

## 1. Database Changes

### Migration File: `216_add_contractor_role.sql`
```sql
-- UP
-- Add contractor role to users table constraint
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check 
  CHECK (role IN ('admin', 'operator', 'support', 'kiosk', 'customer', 'contractor'));

-- Create contractor_permissions table for granular control
CREATE TABLE IF NOT EXISTS contractor_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  location VARCHAR(100) NOT NULL,
  can_unlock_doors BOOLEAN DEFAULT true,
  can_submit_checklists BOOLEAN DEFAULT true,
  can_view_history BOOLEAN DEFAULT false,
  active_from TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  active_until TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by UUID REFERENCES users(id),
  UNIQUE(user_id, location)
);

-- Add index for performance
CREATE INDEX idx_contractor_permissions_user_location ON contractor_permissions(user_id, location);
CREATE INDEX idx_contractor_permissions_active ON contractor_permissions(active_from, active_until);

-- Track contractor checklist submissions separately for auditing
CREATE TABLE IF NOT EXISTS contractor_checklist_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id UUID NOT NULL REFERENCES users(id),
  checklist_submission_id UUID REFERENCES checklist_submissions(id),
  location VARCHAR(100) NOT NULL,
  door_unlocks JSONB DEFAULT '[]', -- Track which doors were unlocked
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- DOWN
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check 
  CHECK (role IN ('admin', 'operator', 'support', 'kiosk', 'customer'));
DROP TABLE IF EXISTS contractor_checklist_submissions;
DROP TABLE IF EXISTS contractor_permissions;
```

## 2. Backend Changes

### 2.1 Update Type Definitions
**File: `/ClubOSV1-backend/src/types/index.ts`**
```typescript
// Update UserRole type
export type UserRole = 'admin' | 'operator' | 'support' | 'kiosk' | 'customer' | 'contractor';

// Add contractor permission interface
export interface ContractorPermission {
  id: string;
  userId: string;
  location: string;
  canUnlockDoors: boolean;
  canSubmitChecklists: boolean;
  canViewHistory: boolean;
  activeFrom: Date;
  activeUntil?: Date;
}
```

### 2.2 Update Auth Middleware
**File: `/ClubOSV1-backend/src/middleware/auth.ts`**
```typescript
// Update role validation in authenticate function (line 156)
if (!decoded.role || !['admin', 'operator', 'support', 'kiosk', 'customer', 'contractor'].includes(decoded.role)) {
  return res.status(401).json({
    error: 'Unauthorized',
    message: 'Invalid token: missing or invalid role'
  });
}

// Add contractor-specific token expiration (line 44)
case 'contractor':
  expiresIn = '8h';  // 8 hours for contractors
  break;
```

### 2.3 Create Contractor Service
**File: `/ClubOSV1-backend/src/services/contractorService.ts`**
```typescript
import { db } from '../utils/database';
import { logger } from '../utils/logger';

export class ContractorService {
  async getPermissions(userId: string, location?: string) {
    const query = location
      ? `SELECT * FROM contractor_permissions 
         WHERE user_id = $1 AND location = $2 
         AND (active_until IS NULL OR active_until > NOW())`
      : `SELECT * FROM contractor_permissions 
         WHERE user_id = $1 
         AND (active_until IS NULL OR active_until > NOW())`;
    
    const params = location ? [userId, location] : [userId];
    const result = await db.query(query, params);
    return result.rows;
  }

  async canUnlockDoor(userId: string, location: string): Promise<boolean> {
    const permissions = await this.getPermissions(userId, location);
    return permissions.length > 0 && permissions[0].can_unlock_doors;
  }

  async logDoorUnlock(userId: string, location: string, doorId: string) {
    await db.query(
      `INSERT INTO contractor_checklist_submissions 
       (contractor_id, location, door_unlocks, start_time)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (contractor_id, location) 
       DO UPDATE SET door_unlocks = jsonb_insert(
         contractor_checklist_submissions.door_unlocks, 
         '{-1}', 
         $4::jsonb
       )`,
      [userId, location, JSON.stringify([{ doorId, timestamp: new Date() }]), 
       JSON.stringify({ doorId, timestamp: new Date() })]
    );
  }
}

export const contractorService = new ContractorService();
```

### 2.4 Update Checklist Routes
**File: `/ClubOSV1-backend/src/routes/checklists-v2.ts`**
```typescript
// Add contractor role check for door unlock endpoint
router.post('/unlock-door', authenticate, async (req, res) => {
  const { location, doorId } = req.body;
  
  // Allow contractors with proper permissions
  if (req.user?.role === 'contractor') {
    const canUnlock = await contractorService.canUnlockDoor(req.user.id, location);
    if (!canUnlock) {
      return res.status(403).json({ 
        error: 'Forbidden', 
        message: 'No permission to unlock doors at this location' 
      });
    }
    
    // Log the door unlock for auditing
    await contractorService.logDoorUnlock(req.user.id, location, doorId);
  } else if (!['admin', 'operator'].includes(req.user?.role || '')) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  
  // Continue with existing door unlock logic...
});

// Update checklist routes to allow contractor access
router.get('/checklists', authenticate, authorize(['admin', 'operator', 'support', 'contractor']), ...);
router.post('/submit', authenticate, authorize(['admin', 'operator', 'support', 'contractor']), ...);
```

## 3. Frontend Changes

### 3.1 Update Type Definitions
**File: `/ClubOSV1-frontend/src/state/useStore.ts`**
```typescript
export type UserRole = 'admin' | 'operator' | 'support' | 'kiosk' | 'customer' | 'contractor';
```

### 3.2 Update Navigation Component
**File: `/ClubOSV1-frontend/src/components/Navigation.tsx`**
```typescript
// Add contractor-specific navigation
const getNavItems = (role: UserRole) => {
  // Contractor gets minimal navigation
  if (role === 'contractor') {
    return [
      { href: '/checklists', label: 'Checklists', icon: ClipboardList }
    ];
  }
  
  // Existing role navigation...
};

// Hide unnecessary UI elements for contractors
const showFullNav = !['kiosk', 'customer', 'contractor'].includes(role);
```

### 3.3 Update Checklists Page
**File: `/ClubOSV1-frontend/src/pages/checklists.tsx`**
```typescript
// Update role check to include contractors
useEffect(() => {
  if (user) {
    if (user.role === 'customer') {
      router.push('/customer/');
      return;
    }
    // Allow contractor role
    if (!['admin', 'operator', 'support', 'contractor'].includes(user.role)) {
      router.push('/login');
      return;
    }
  }
}, [user, router]);

// Update render check
if (!user || !['admin', 'operator', 'support', 'contractor'].includes(user.role)) {
  return null;
}
```

### 3.4 Create Contractor Dashboard
**File: `/ClubOSV1-frontend/src/pages/contractor/index.tsx`**
```typescript
import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuthState } from '@/state/useStore';

export default function ContractorDashboard() {
  const { user } = useAuthState();
  const router = useRouter();

  useEffect(() => {
    // Redirect contractors directly to checklists
    if (user?.role === 'contractor') {
      router.replace('/checklists');
    } else {
      router.replace('/login');
    }
  }, [user, router]);

  return null;
}
```

### 3.5 Update Login Redirect Logic
**File: `/ClubOSV1-frontend/src/pages/login.tsx`**
```typescript
// Add contractor redirect after login
const handleLoginSuccess = (userData: any) => {
  switch (userData.role) {
    case 'contractor':
      router.push('/checklists');
      break;
    // Existing cases...
  }
};
```

### 3.6 Update ChecklistSystem Component
**File: `/ClubOSV1-frontend/src/components/ChecklistSystem.tsx`**
```typescript
// Add contractor-specific UI adjustments
const isContractor = user?.role === 'contractor';

// Show limited UI for contractors
{!isContractor && (
  // Admin controls, history view, etc.
)}

// Show door unlock button for contractors with permission
{(isContractor || ['admin', 'operator'].includes(user?.role)) && (
  <button onClick={handleDoorUnlock}>
    <DoorOpen className="w-4 h-4" />
    Unlock Door
  </button>
)}
```

## 4. Admin Management Features

### 4.1 Contractor Management Page
**File: `/ClubOSV1-frontend/src/pages/admin/contractors.tsx`**
```typescript
// Admin page to manage contractors
- Create contractor accounts
- Assign locations and permissions
- Set active dates (for temporary contractors)
- View contractor activity logs
- Revoke access
```

### 4.2 Backend Admin Routes
**File: `/ClubOSV1-backend/src/routes/admin/contractors.ts`**
```typescript
// CRUD operations for contractor management
router.post('/contractors', authenticate, authorize(['admin']), createContractor);
router.get('/contractors', authenticate, authorize(['admin']), listContractors);
router.put('/contractors/:id/permissions', authenticate, authorize(['admin']), updatePermissions);
router.delete('/contractors/:id', authenticate, authorize(['admin']), deactivateContractor);
router.get('/contractors/:id/activity', authenticate, authorize(['admin']), getContractorActivity);
```

## 5. Security Considerations

1. **Time-based Access**: Contractors can have time-limited access (active_from/active_until)
2. **Location-based Permissions**: Contractors only unlock doors at assigned locations
3. **Audit Trail**: All door unlocks and checklist submissions are logged
4. **No Access to Sensitive Data**: Contractors cannot access:
   - Customer data
   - Financial information
   - System settings
   - Other operational tools
5. **Session Management**: 8-hour token expiration for contractors
6. **IP Restrictions** (Optional): Can restrict contractor login to specific IP ranges

## 6. Testing Strategy

### Unit Tests
```typescript
// Test contractor permissions
describe('ContractorService', () => {
  test('should allow door unlock with valid permissions');
  test('should deny door unlock without permissions');
  test('should log door unlock activity');
  test('should respect time-based access');
});
```

### Integration Tests
```typescript
// Test contractor workflow
describe('Contractor Workflow', () => {
  test('contractor can login and access checklists');
  test('contractor cannot access other pages');
  test('contractor can unlock doors at assigned location');
  test('contractor cannot unlock doors at other locations');
});
```

## 7. Deployment Steps

1. **Create migration file** (216_add_contractor_role.sql)
2. **Update backend types and middleware**
3. **Create contractor service**
4. **Update checklist routes**
5. **Update frontend components**
6. **Test locally**:
   ```bash
   # Create test contractor
   npm run create:contractor -- --email contractor@test.com --location "Dartmouth"
   ```
7. **Deploy to production**:
   ```bash
   git add -A
   git commit -m "feat: add contractor user role with checklist-only access"
   git push origin main
   ```
8. **Run migration on production**:
   ```bash
   railway run npm run db:migrate
   ```
9. **Create first contractor account**
10. **Monitor and verify functionality**

## 8. Rollback Plan

If issues arise:
1. Revert git commit
2. Run down migration:
   ```sql
   -- Remove contractor role and related tables
   ```
3. Redeploy previous version
4. Investigate and fix issues
5. Re-attempt deployment

## 9. Future Enhancements

1. **Mobile App**: Dedicated contractor mobile app
2. **QR Code Check-in**: Contractors scan QR code to start shift
3. **GPS Verification**: Ensure contractor is at location
4. **Photo Verification**: Require before/after photos
5. **Performance Metrics**: Track contractor efficiency
6. **Scheduling Integration**: Link to contractor schedules
7. **Multi-language Support**: For diverse contractor workforce

## 10. Documentation Updates

1. Update README.md with new role
2. Create contractor onboarding guide
3. Add to operations manual
4. Update security documentation
5. Create contractor FAQ