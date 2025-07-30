# NinjaOne Integration Audit & Simplified Implementation

## Current Status
- ✅ remoteActions.ts already exists in routes
- ✅ ninjaone.ts service exists
- ⚠️ Need to fix database import path
- ⚠️ Need to ensure axios is installed
- ⚠️ Frontend integration needs to be connected

## Simplified Scope - PC/Software Restarts Only

### Actions to Implement:
1. **Restart TrackMan** - Closes and restarts TrackMan software
2. **Restart Browser** - Closes all browsers and restarts with tournament display
3. **Reboot PC** - Full system restart with 30-second warning
4. **Restart All Software** - Combination restart of TrackMan + browsers

### File Structure Issues Found:

#### 1. Database Import Path
Current: `import { pool } from '../db';`
Should be: `import { pool } from '../utils/db';` or `import { getPool } from '../utils/db-pool';`

#### 2. Missing Dependencies
```bash
cd ClubOSV1-backend
npm install axios  # Required for NinjaOne API calls
```

#### 3. Frontend API Client Missing
Need to create: `/ClubOSV1-frontend/src/api/remoteActions.ts`

## Corrected Implementation Files

### 1. Fixed remoteActions.ts (Simplified)
