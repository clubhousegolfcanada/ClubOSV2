# Ubiquiti Access Integration Plan for ClubOS Remote Actions

## Executive Summary
Integrate Ubiquiti UniFi Access door control system into the existing Remote Actions page to enable remote door unlock/lock capabilities per location.

## Current State Analysis

### Existing Remote Actions Architecture
- **Frontend**: RemoteActionsBar component (`ClubOSV1-frontend/src/components/RemoteActionsBar.tsx`)
- **Backend**: Remote actions route handler (`ClubOSV1-backend/src/routes/remoteActions.ts`)
- **Integration**: Currently using NinjaOne for PC/software restarts
- **Locations**: Bedford, Dartmouth, Stratford, Bayers Lake, Truro
- **Actions**: TrackMan restart, music/TV system control, PC reboot

### Key Components
1. Location-based device mapping
2. Role-based access control (operator/admin)
3. Action logging to database
4. Slack notifications for actions
5. Real-time status updates

## Ubiquiti Access Integration Architecture

### 1. Door Mapping Structure
```typescript
const DOOR_MAP: Record<string, Record<string, DoorConfig>> = {
  'Bedford': {
    'main-entrance': { 
      doorId: 'BEDFORD-MAIN-001',
      name: 'Main Entrance',
      type: 'exterior'
    },
    'staff-door': {
      doorId: 'BEDFORD-STAFF-001',
      name: 'Staff Door',
      type: 'staff'
    },
    'emergency-exit': {
      doorId: 'BEDFORD-EMRG-001',
      name: 'Emergency Exit',
      type: 'emergency'
    }
  },
  // Additional locations...
}
```

### 2. API Service Layer
Create new service: `ClubOSV1-backend/src/services/unifiAccess.ts`

```typescript
class UnifiAccessService {
  // Authentication with UniFi controller
  async authenticate()
  
  // Door control operations
  async unlockDoor(doorId: string, duration?: number)
  async lockDoor(doorId: string)
  async getDoorStatus(doorId: string)
  
  // Batch operations
  async unlockAllDoors(location: string)
  async lockdownLocation(location: string)
  
  // Monitoring
  async getDoorAccessLog(doorId: string, limit?: number)
  async getActiveAlarms()
}
```

### 3. Frontend UI Components

#### Door Control Section in RemoteActionsBar
- **Quick Actions**:
  - Unlock main entrance (30 seconds)
  - Unlock all doors (emergency)
  - Lock all doors (end of day)
  
- **Individual Door Controls**:
  - Status indicator (locked/unlocked/offline)
  - Unlock button with duration selector
  - Access log viewer (last 5 entries)

#### Visual Design
```tsx
// Add to RemoteActionsBar location card
<div className="space-y-2">
  <p className="text-xs text-muted uppercase">Door Access</p>
  <div className="grid grid-cols-2 gap-1.5">
    <button className="door-control-btn">
      <Lock className="w-3 h-3" />
      Main Door
    </button>
    <button className="door-control-btn">
      <Unlock className="w-3 h-3" />
      Staff Door
    </button>
  </div>
  <button className="emergency-unlock-btn">
    <AlertTriangle className="w-3 h-3" />
    Emergency Unlock All
  </button>
</div>
```

### 4. Backend API Endpoints

#### New Endpoints
```typescript
// Unlock door
POST /api/remote-actions/doors/unlock
{
  location: string,
  doorId: string,
  duration?: number, // seconds, default 30
  reason?: string
}

// Lock door
POST /api/remote-actions/doors/lock
{
  location: string,
  doorId: string
}

// Get door status
GET /api/remote-actions/doors/status/:location

// Emergency actions
POST /api/remote-actions/doors/emergency
{
  action: 'unlock_all' | 'lockdown',
  location: string
}
```

### 5. Security & Access Control

#### Permission Levels
- **Operator**: Can unlock main entrance doors only
- **Admin**: Full door control access
- **Emergency Override**: Special permission for emergency unlock all

#### Audit Requirements
- Log all door actions to database
- Include: user, timestamp, door, action, duration
- Send Slack notifications for:
  - Emergency unlock all
  - After-hours door access
  - Failed authentication attempts

### 6. Database Schema

```sql
CREATE TABLE door_access_log (
  id SERIAL PRIMARY KEY,
  action_type VARCHAR(50) NOT NULL,
  location VARCHAR(100) NOT NULL,
  door_id VARCHAR(100) NOT NULL,
  door_name VARCHAR(100),
  initiated_by VARCHAR(255) NOT NULL,
  duration_seconds INTEGER,
  reason TEXT,
  status VARCHAR(50) DEFAULT 'initiated',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP,
  metadata JSONB
);

CREATE INDEX idx_door_access_location ON door_access_log(location);
CREATE INDEX idx_door_access_created ON door_access_log(created_at DESC);
```

## Implementation Steps

### Phase 1: Setup & Authentication (Week 1)
1. Install UniFi Access npm package
2. Configure environment variables for UniFi controller
3. Create UnifiAccessService with authentication
4. Test connection to UniFi controller

### Phase 2: Backend Integration (Week 1-2)
1. Implement door control methods in service
2. Create API endpoints for door operations
3. Add database logging
4. Implement Slack notifications
5. Add error handling and fallbacks

### Phase 3: Frontend Development (Week 2)
1. Update RemoteActionsBar component
2. Add door control UI elements
3. Implement status indicators
4. Add unlock duration selector
5. Create emergency action confirmations

### Phase 4: Testing & Deployment (Week 3)
1. Unit tests for UnifiAccessService
2. Integration tests for API endpoints
3. UI testing on mobile devices
4. Security audit
5. Production deployment

## Environment Variables Required

```env
# UniFi Access Configuration
UNIFI_CONTROLLER_URL=https://unifi.example.com
UNIFI_CONTROLLER_PORT=8443
UNIFI_USERNAME=clubos_api
UNIFI_PASSWORD=secure_password
UNIFI_SITE_ID=default

# Door Control Settings
DEFAULT_UNLOCK_DURATION=30
MAX_UNLOCK_DURATION=300
EMERGENCY_UNLOCK_DURATION=60
```

## Risk Mitigation

### Potential Issues & Solutions
1. **Network Connectivity**: Implement offline mode with cached status
2. **API Rate Limits**: Add request throttling and queuing
3. **Security Breach**: Implement 2FA for emergency actions
4. **Hardware Failure**: Fallback to manual override codes
5. **Audit Compliance**: Ensure all actions are logged with retention policy

## Success Metrics
- Door control response time < 2 seconds
- 99.9% uptime for door access system
- Zero unauthorized access incidents
- Complete audit trail for all door operations
- User satisfaction score > 4.5/5

## Timeline
- **Week 1**: Backend setup and authentication
- **Week 2**: Frontend development and integration
- **Week 3**: Testing and deployment
- **Week 4**: Monitoring and optimization

## Next Steps
1. Obtain UniFi Access controller credentials
2. Map physical door IDs to system
3. Define emergency procedures
4. Train staff on new features
5. Create user documentation