# NinjaOne Implementation Checklist (Demo Mode)

## ✅ Completed Setup Tasks

### Backend Implementation
- [x] Create `ninjaone.ts` service with OAuth2 authentication
- [x] Create `remoteActions.ts` route with demo mode support
- [x] Add database migration for `remote_actions_log` table
- [x] Fix database import path (`../utils/db`)
- [x] Add route to `index.ts`
- [x] Install axios dependency
- [x] Add demo environment variables

### Frontend Implementation
- [x] Create `remoteActions.ts` API client
- [x] Update `commands.tsx` with API imports
- [x] Implement `handleExecuteReset` function
- [x] Add job status polling
- [x] Add PC reboot confirmation dialog

### PowerShell Scripts Created
- [x] `Restart-TrackMan-Simple.ps1`
- [x] `Restart-Browser-Simple.ps1`
- [x] `Reboot-SimulatorPC.ps1`
- [x] `Restart-All-Software.ps1`

## 🎯 Demo Mode Features

### What Works Now:
1. **UI Functionality**
   - Remote Actions tab displays all locations and bays
   - Click any action button to simulate execution
   - Toast notifications show progress
   - Job status polling (simulates completion after 5 seconds)
   - PC reboot warning dialog

2. **Backend Simulation**
   - All API endpoints return demo responses
   - Actions show `[DEMO]` prefix
   - Simulated job IDs (format: `DEMO-{timestamp}`)
   - Slack notifications sent with demo flag
   - Database logging (if table exists)

3. **Security & Access**
   - Role-based access (operator+ only)
   - JWT authentication required
   - All security measures active

## 📋 When NinjaOne Subscription is Ready

### Step 1: Get Credentials
- [ ] Obtain from NinjaOne:
  - Client ID
  - Client Secret
  - Instance URL

### Step 2: Update Environment Variables
```bash
# In Railway dashboard, update:
NINJAONE_CLIENT_ID=real_client_id_here
NINJAONE_CLIENT_SECRET=real_secret_here
NINJAONE_BASE_URL=https://api.ninjarmm.com
```

### Step 3: Map Device IDs
- [ ] Log into NinjaOne dashboard
- [ ] List all simulator PCs
- [ ] Create mapping spreadsheet:
  ```
  Location    | Bay | Current Demo ID        | Real NinjaOne ID
  ------------|-----|------------------------|------------------
  Bedford     | 1   | DEMO-BEDFORD-SIM1-PC  | [actual ID]
  Bedford     | 2   | DEMO-BEDFORD-SIM2-PC  | [actual ID]
  Dartmouth   | 1   | DEMO-DART-SIM1-PC     | [actual ID]
  ...etc
  ```

### Step 4: Upload PowerShell Scripts
- [ ] Upload to NinjaOne script library:
  1. `Restart-TrackMan-Simple.ps1`
  2. `Restart-Browser-Simple.ps1`
  3. `Reboot-SimulatorPC.ps1`
  4. `Restart-All-Software.ps1`
- [ ] Note the Script IDs after upload

### Step 5: Update Code with Real IDs
- [ ] In `remoteActions.ts`, update:
  ```typescript
  // Replace demo IDs with real ones
  const DEVICE_MAP = {
    'Bedford': {
      'bay-1': { deviceId: 'REAL_ID_HERE', name: 'Bedford Bay 1 PC' },
      // ... etc
    }
  };
  
  // Replace demo script IDs with real ones
  const SCRIPT_MAP = {
    'restart-trackman': 'REAL_SCRIPT_ID_HERE',
    // ... etc
  };
  ```

### Step 6: Test with One Location
- [ ] Start with Bedford Bay 1
- [ ] Execute TrackMan restart
- [ ] Monitor NinjaOne dashboard
- [ ] Check Slack notifications
- [ ] Verify database logging

### Step 7: Roll Out
- [ ] Enable for all Bedford bays
- [ ] Test for 24 hours
- [ ] Enable next location
- [ ] Continue gradually

## 🔍 Testing Commands

### Start Development Environment:
```bash
# Terminal 1 - Backend
cd ClubOSV1-backend
npm run dev

# Terminal 2 - Frontend
cd ClubOSV1-frontend
npm run dev
```

### Test API Directly:
```bash
# Get auth token first (login as operator)
# Then test execute endpoint
curl -X POST http://localhost:3001/api/remote-actions/execute \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "restart-trackman",
    "location": "Bedford",
    "bayNumber": "1"
  }'
```

## 📊 Monitoring

### Check Recent Actions:
```sql
-- In PostgreSQL
SELECT * FROM remote_actions_log 
ORDER BY created_at DESC 
LIMIT 10;
```

### Slack Channels to Monitor:
- `#tech-alerts` - Critical actions (PC reboots)
- `#tech-actions-log` - All remote actions

## 🚨 Troubleshooting

### Common Issues:
1. **"Device not found"** - Check location/bay mapping
2. **"Unauthorized"** - Ensure operator role or higher
3. **No Slack notifications** - Check webhook configuration
4. **Database errors** - Run migration to create table

### Rollback Plan:
1. Set environment variables back to demo values
2. Or remove `/api/remote-actions` route from index.ts
3. UI will show errors but system continues working

## 📚 Documentation Updates Needed

- [ ] Update operator manual with Remote Actions section
- [ ] Create quick reference card for operators
- [ ] Document expected restart times:
  - TrackMan: 30-60 seconds
  - Browser: 10-20 seconds
  - PC Reboot: 3-5 minutes
  - All Software: 1-2 minutes

## ✨ Future Enhancements

1. **Bulk Actions** - Restart all bays at once
2. **Scheduled Restarts** - Nightly maintenance
3. **Status Dashboard** - Real-time device health
4. **Approval Workflow** - Require manager approval for reboots
5. **Mobile App** - Remote actions from phone

---

**Current Status**: Ready for demo testing
**Production Ready**: After NinjaOne credentials configured
**Estimated Time to Production**: 1-2 days after receiving credentials
