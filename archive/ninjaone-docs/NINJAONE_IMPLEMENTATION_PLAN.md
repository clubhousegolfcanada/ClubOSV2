# NinjaOne Remote Actions Implementation Plan

## Overview
Integrate NinjaOne RMM API to execute remote commands on simulator PCs from ClubOS Remote Actions tab.

## Phase 1: NinjaOne API Setup

### 1.1 API Authentication
```bash
# Add to backend .env
NINJAONE_CLIENT_ID=your_client_id
NINJAONE_CLIENT_SECRET=your_client_secret
NINJAONE_BASE_URL=https://api.ninjarmm.com
NINJAONE_INSTANCE=your_instance
```

### 1.2 Create API Service
```typescript
// ClubOSV1-backend/src/services/ninjaone.ts
import axios from 'axios';

class NinjaOneService {
  private accessToken: string | null = null;
  private tokenExpiry: Date | null = null;

  async getAccessToken(): Promise<string> {
    if (this.accessToken && this.tokenExpiry && new Date() < this.tokenExpiry) {
      return this.accessToken;
    }

    const response = await axios.post(
      `${process.env.NINJAONE_BASE_URL}/oauth/token`,
      {
        grant_type: 'client_credentials',
        client_id: process.env.NINJAONE_CLIENT_ID,
        client_secret: process.env.NINJAONE_CLIENT_SECRET,
        scope: 'monitoring management'
      }
    );

    this.accessToken = response.data.access_token;
    this.tokenExpiry = new Date(Date.now() + response.data.expires_in * 1000);
    return this.accessToken;
  }

  async executeScript(deviceId: string, scriptId: string, parameters?: Record<string, any>) {
    const token = await this.getAccessToken();
    
    return axios.post(
      `${process.env.NINJAONE_BASE_URL}/v2/device/${deviceId}/script/${scriptId}/run`,
      { parameters },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
  }

  async getDevices() {
    const token = await this.getAccessToken();
    
    return axios.get(
      `${process.env.NINJAONE_BASE_URL}/v2/devices`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );
  }
}

export default new NinjaOneService();
```

## Phase 2: Device Mapping Configuration

### 2.1 Create Device Registry
```typescript
// ClubOSV1-backend/src/config/ninjaDevices.ts
export const DEVICE_REGISTRY = {
  'Bedford': {
    'bay-1': { deviceId: 'NINJA_DEVICE_ID_1', name: 'BEDFORD-BAY1-PC' },
    'bay-2': { deviceId: 'NINJA_DEVICE_ID_2', name: 'BEDFORD-BAY2-PC' },
    'music': { deviceId: 'NINJA_DEVICE_ID_3', name: 'BEDFORD-MUSIC-PC' },
    'tv': { deviceId: 'NINJA_DEVICE_ID_4', name: 'BEDFORD-TV-PC' }
  },
  'Dartmouth': {
    'bay-1': { deviceId: 'NINJA_DEVICE_ID_5', name: 'DART-BAY1-PC' },
    'bay-2': { deviceId: 'NINJA_DEVICE_ID_6', name: 'DART-BAY2-PC' },
    'bay-3': { deviceId: 'NINJA_DEVICE_ID_7', name: 'DART-BAY3-PC' },
    'bay-4': { deviceId: 'NINJA_DEVICE_ID_8', name: 'DART-BAY4-PC' },
    'music': { deviceId: 'NINJA_DEVICE_ID_9', name: 'DART-MUSIC-PC' },
    'tv': { deviceId: 'NINJA_DEVICE_ID_10', name: 'DART-TV-PC' }
  },
  // ... other locations
};

export const SCRIPT_REGISTRY = {
  'restart-trackman': 'SCRIPT_ID_RESTART_TRACKMAN',
  'reboot-pc': 'SCRIPT_ID_REBOOT_PC',
  'restart-music': 'SCRIPT_ID_RESTART_MUSIC',
  'restart-tv': 'SCRIPT_ID_RESTART_TV'
};
```

## Phase 3: Backend API Endpoints

### 3.1 Create Remote Actions Controller
```typescript
// ClubOSV1-backend/src/routes/remoteActions.ts
import express from 'express';
import { requireAuth, requireRole } from '../middleware/auth';
import ninjaOneService from '../services/ninjaone';
import { DEVICE_REGISTRY, SCRIPT_REGISTRY } from '../config/ninjaDevices';
import { logSystemEvent } from '../services/systemLog';

const router = express.Router();

router.post('/execute', requireAuth, requireRole('operator'), async (req, res) => {
  try {
    const { action, location, target, targetType } = req.body;
    
    // Validate request
    if (!action || !location || (!target && !targetType)) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    // Map to NinjaOne device
    const locationDevices = DEVICE_REGISTRY[location];
    if (!locationDevices) {
      return res.status(404).json({ error: 'Location not found' });
    }

    const deviceKey = target ? `bay-${target}` : targetType;
    const device = locationDevices[deviceKey];
    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }

    // Map action to script
    const scriptId = SCRIPT_REGISTRY[action];
    if (!scriptId) {
      return res.status(404).json({ error: 'Action not supported' });
    }

    // Execute via NinjaOne
    const result = await ninjaOneService.executeScript(
      device.deviceId,
      scriptId,
      {
        initiatedBy: req.user.email,
        timestamp: new Date().toISOString(),
        reason: 'Manual trigger from ClubOS'
      }
    );

    // Log the action
    await logSystemEvent({
      type: 'REMOTE_ACTION',
      action,
      location,
      target: device.name,
      user: req.user.email,
      status: 'success',
      ninjaJobId: result.data.jobId
    });

    res.json({
      success: true,
      message: `${action} initiated for ${device.name}`,
      jobId: result.data.jobId
    });

  } catch (error) {
    console.error('Remote action error:', error);
    
    await logSystemEvent({
      type: 'REMOTE_ACTION_ERROR',
      action: req.body.action,
      location: req.body.location,
      user: req.user.email,
      error: error.message
    });

    res.status(500).json({ 
      error: 'Failed to execute remote action',
      details: error.message 
    });
  }
});

// Get action status
router.get('/status/:jobId', requireAuth, async (req, res) => {
  try {
    const token = await ninjaOneService.getAccessToken();
    const response = await axios.get(
      `${process.env.NINJAONE_BASE_URL}/v2/job/${req.params.jobId}`,
      {
        headers: { 'Authorization': `Bearer ${token}` }
      }
    );

    res.json({
      status: response.data.status,
      result: response.data.result
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get job status' });
  }
});

export default router;
```

## Phase 4: Frontend Integration

### 4.1 Update Commands Page
```typescript
// Add to commands.tsx handleExecuteReset function
const handleExecuteReset = async (trigger: Command) => {
  const toastId = toast.loading(`Executing ${trigger.name}...`);
  
  try {
    const response = await fetch('/api/remote-actions/execute', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getAuthToken()}`
      },
      body: JSON.stringify({
        action: trigger.action === 'ninjaone' ? 'restart-trackman' : trigger.action,
        location: trigger.location,
        target: trigger.bayNumber,
        targetType: trigger.systemType
      })
    });

    if (!response.ok) throw new Error('Failed to execute action');
    
    const result = await response.json();
    toast.success(result.message, { id: toastId });
    
    // Optional: Poll for status
    if (result.jobId) {
      pollJobStatus(result.jobId);
    }
  } catch (error) {
    toast.error('Failed to execute action', { id: toastId });
    console.error('Remote action error:', error);
  }
};

const pollJobStatus = async (jobId: string) => {
  const interval = setInterval(async () => {
    try {
      const response = await fetch(`/api/remote-actions/status/${jobId}`, {
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`
        }
      });
      
      const data = await response.json();
      if (data.status === 'completed') {
        toast.success('Action completed successfully');
        clearInterval(interval);
      } else if (data.status === 'failed') {
        toast.error('Action failed');
        clearInterval(interval);
      }
    } catch (error) {
      clearInterval(interval);
    }
  }, 5000); // Poll every 5 seconds
  
  // Stop polling after 2 minutes
  setTimeout(() => clearInterval(interval), 120000);
};
```

## Phase 5: NinjaOne Scripts

### 5.1 TrackMan Restart Script (PowerShell)
```powershell
# restart-trackman.ps1
param(
    [string]$InitiatedBy,
    [string]$Timestamp,
    [string]$Reason
)

# Log the action
Write-Output "TrackMan restart initiated by $InitiatedBy at $Timestamp"
Write-Output "Reason: $Reason"

# Kill TrackMan processes
Get-Process -Name "TrackMan*" -ErrorAction SilentlyContinue | Stop-Process -Force

# Wait for processes to terminate
Start-Sleep -Seconds 5

# Start TrackMan
$trackmanPath = "C:\Program Files\TrackMan\TrackMan.exe"
if (Test-Path $trackmanPath) {
    Start-Process $trackmanPath
    Write-Output "TrackMan restarted successfully"
} else {
    Write-Error "TrackMan executable not found"
    exit 1
}
```

### 5.2 Music System Restart Script
```powershell
# restart-music.ps1
# Stop music service
Stop-Service -Name "ClubhouseMusicService" -Force
Start-Sleep -Seconds 3
Start-Service -Name "ClubhouseMusicService"
```

## Phase 6: Deployment Steps

### 6.1 Backend Deployment
```bash
# Add NinjaOne credentials to Railway
railway variables set NINJAONE_CLIENT_ID=xxx
railway variables set NINJAONE_CLIENT_SECRET=xxx
railway variables set NINJAONE_BASE_URL=https://api.ninjarmm.com
railway variables set NINJAONE_INSTANCE=xxx

# Update backend routes
# Add to ClubOSV1-backend/src/server.ts
import remoteActionsRouter from './routes/remoteActions';
app.use('/api/remote-actions', remoteActionsRouter);

# Deploy
git add .
git commit -m "feat: add NinjaOne remote actions integration"
git push origin main
railway up
```

### 6.2 Database Schema Updates
```sql
-- Add remote_actions_log table
CREATE TABLE IF NOT EXISTS remote_actions_log (
  id SERIAL PRIMARY KEY,
  action VARCHAR(100) NOT NULL,
  location VARCHAR(100) NOT NULL,
  target VARCHAR(100) NOT NULL,
  initiated_by VARCHAR(255) NOT NULL,
  ninja_job_id VARCHAR(100),
  status VARCHAR(50) NOT NULL,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add index for faster queries
CREATE INDEX idx_remote_actions_created ON remote_actions_log(created_at DESC);
CREATE INDEX idx_remote_actions_user ON remote_actions_log(initiated_by);
```

## Phase 7: Testing Plan

### 7.1 Unit Tests
```typescript
// ClubOSV1-backend/src/tests/ninjaone.test.ts
describe('NinjaOne Service', () => {
  it('should authenticate and get access token', async () => {
    const token = await ninjaOneService.getAccessToken();
    expect(token).toBeDefined();
  });

  it('should execute script on device', async () => {
    const result = await ninjaOneService.executeScript(
      'test-device-id',
      'test-script-id',
      { test: true }
    );
    expect(result.data.jobId).toBeDefined();
  });
});
```

### 7.2 Integration Testing Checklist
- [ ] Test each location's bay reset functionality
- [ ] Test music system restart
- [ ] Test TV system restart
- [ ] Verify error handling for offline devices
- [ ] Test permission restrictions (operator role required)
- [ ] Verify action logging in database
- [ ] Test job status polling

## Phase 8: Monitoring & Alerts

### 8.1 Add Slack Notifications
```typescript
// Add to remoteActions.ts
if (result.data.jobId) {
  // Send Slack notification
  await sendSlackMessage({
    channel: '#tech-alerts',
    text: `Remote action executed: ${action} on ${device.name} by ${req.user.email}`
  });
}
```

### 8.2 Dashboard Metrics
- Add "Remote Actions" widget to Operations dashboard
- Show last 24h action count
- Display success/failure rate
- List recent actions with status

## Security Considerations

1. **API Key Storage**: Use Railway's encrypted environment variables
2. **Rate Limiting**: Max 10 actions per minute per user
3. **Audit Trail**: All actions logged with user, timestamp, and result
4. **Role-Based Access**: Only operators and admins can execute
5. **Device Validation**: Strict mapping to prevent unauthorized access

## Timeline

- **Week 1**: NinjaOne API integration & testing
- **Week 2**: Frontend UI updates & backend endpoints
- **Week 3**: Script development & device mapping
- **Week 4**: Testing, deployment, and monitoring setup

## Next Steps

1. Obtain NinjaOne API credentials
2. Map all device IDs in NinjaOne dashboard
3. Create and test PowerShell scripts
4. Implement backend service
5. Update frontend with execution logic
6. Deploy and monitor
