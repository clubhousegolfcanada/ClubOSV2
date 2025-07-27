# NinjaOne Remote Actions Integration - Complete Implementation Plan

## Overview
Integrate NinjaOne RMM platform to enable remote control of TrackMan simulators, PCs, music systems, and TVs across all Clubhouse 24/7 Golf locations through ClubOS's Remote Actions interface.

## Current Status
- ✅ NinjaOne service class created (`/src/services/ninjaone.ts`)
- ✅ Frontend UI ready with Remote Actions tab
- ⏳ Need to connect backend endpoints
- ⏳ Need device ID mapping
- ⏳ Need PowerShell scripts deployed in NinjaOne

## Phase 1: Complete Backend Integration

### 1.1 Create Remote Actions Router
```typescript
// ClubOSV1-backend/src/routes/remoteActions.ts
import express from 'express';
import { requireAuth, requireRole } from '../middleware/auth';
import ninjaOneService from '../services/ninjaone';
import { logSystemEvent } from '../services/logger';
import { sendSlackMessage } from '../services/slack';

const router = express.Router();

// Device ID mapping (update with real NinjaOne device IDs)
const DEVICE_MAP = {
  'Bedford': {
    'bay-1': { deviceId: 'BEDFORD-SIM1-PC', name: 'Bedford Bay 1 PC' },
    'bay-2': { deviceId: 'BEDFORD-SIM2-PC', name: 'Bedford Bay 2 PC' },
    'music': { deviceId: 'BEDFORD-MUSIC-PC', name: 'Bedford Music System' },
    'tv': { deviceId: 'BEDFORD-TV-PC', name: 'Bedford Tournament TV' }
  },
  'Dartmouth': {
    'bay-1': { deviceId: 'DART-SIM1-PC', name: 'Dartmouth Bay 1 PC' },
    'bay-2': { deviceId: 'DART-SIM2-PC', name: 'Dartmouth Bay 2 PC' },
    'bay-3': { deviceId: 'DART-SIM3-PC', name: 'Dartmouth Bay 3 PC' },
    'bay-4': { deviceId: 'DART-SIM4-PC', name: 'Dartmouth Bay 4 PC' },
    'music': { deviceId: 'DART-MUSIC-PC', name: 'Dartmouth Music System' },
    'tv': { deviceId: 'DART-TV-PC', name: 'Dartmouth Tournament TV' }
  },
  'Stratford': {
    'bay-1': { deviceId: 'STRAT-SIM1-PC', name: 'Stratford Bay 1 PC' },
    'bay-2': { deviceId: 'STRAT-SIM2-PC', name: 'Stratford Bay 2 PC' },
    'bay-3': { deviceId: 'STRAT-SIM3-PC', name: 'Stratford Bay 3 PC' },
    'music': { deviceId: 'STRAT-MUSIC-PC', name: 'Stratford Music System' },
    'tv': { deviceId: 'STRAT-TV-PC', name: 'Stratford Tournament TV' }
  },
  'Bayers Lake': {
    'bay-1': { deviceId: 'BAYERS-SIM1-PC', name: 'Bayers Lake Bay 1 PC' },
    'bay-2': { deviceId: 'BAYERS-SIM2-PC', name: 'Bayers Lake Bay 2 PC' },
    'bay-3': { deviceId: 'BAYERS-SIM3-PC', name: 'Bayers Lake Bay 3 PC' },
    'bay-4': { deviceId: 'BAYERS-SIM4-PC', name: 'Bayers Lake Bay 4 PC' },
    'bay-5': { deviceId: 'BAYERS-SIM5-PC', name: 'Bayers Lake Bay 5 PC' },
    'music': { deviceId: 'BAYERS-MUSIC-PC', name: 'Bayers Lake Music System' },
    'tv': { deviceId: 'BAYERS-TV-PC', name: 'Bayers Lake Tournament TV' }
  },
  'Truro': {
    'bay-1': { deviceId: 'TRURO-SIM1-PC', name: 'Truro Bay 1 PC' },
    'bay-2': { deviceId: 'TRURO-SIM2-PC', name: 'Truro Bay 2 PC' },
    'bay-3': { deviceId: 'TRURO-SIM3-PC', name: 'Truro Bay 3 PC' },
    'music': { deviceId: 'TRURO-MUSIC-PC', name: 'Truro Music System' },
    'tv': { deviceId: 'TRURO-TV-PC', name: 'Truro Tournament TV' }
  }
};

// NinjaOne script IDs (update with real script IDs after deployment)
const SCRIPT_MAP = {
  'restart-sim': 'SCRIPT-RESTART-TRACKMAN',
  'reboot-pc': 'SCRIPT-REBOOT-PC',
  'restart-music': 'SCRIPT-RESTART-MUSIC',
  'restart-tv': 'SCRIPT-RESTART-TV'
};

// Execute remote action
router.post('/execute', requireAuth, requireRole('operator'), async (req, res) => {
  try {
    const { action, location, bayNumber, systemType } = req.body;
    
    // Validate inputs
    if (!action || !location) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    // Determine device
    const locationDevices = DEVICE_MAP[location];
    if (!locationDevices) {
      return res.status(404).json({ error: 'Invalid location' });
    }

    let device;
    if (bayNumber) {
      device = locationDevices[`bay-${bayNumber}`];
    } else if (systemType) {
      device = locationDevices[systemType];
    }

    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }

    // Check device is online
    const isOnline = await ninjaOneService.validateDeviceOnline(device.deviceId);
    if (!isOnline) {
      return res.status(503).json({ 
        error: 'Device is offline',
        message: `${device.name} is not currently accessible`
      });
    }

    // Determine script
    const scriptId = SCRIPT_MAP[action];
    if (!scriptId) {
      return res.status(400).json({ error: 'Invalid action' });
    }

    // Execute action
    const job = await ninjaOneService.executeScript(
      device.deviceId,
      scriptId,
      {
        initiatedBy: req.user.email,
        timestamp: new Date().toISOString(),
        reason: 'Manual trigger from ClubOS Remote Actions'
      }
    );

    // Log to database
    await logSystemEvent({
      type: 'REMOTE_ACTION_EXECUTED',
      user: req.user.email,
      action,
      location,
      device: device.name,
      jobId: job.jobId,
      status: 'initiated'
    });

    // Send Slack notification
    await sendSlackMessage({
      channel: '#tech-alerts',
      text: `🔧 Remote Action: ${req.user.email} executed "${action}" on ${device.name}`,
      attachments: [{
        color: 'warning',
        fields: [
          { title: 'Location', value: location, short: true },
          { title: 'Device', value: device.name, short: true },
          { title: 'Action', value: action, short: true },
          { title: 'Job ID', value: job.jobId, short: true }
        ]
      }]
    });

    res.json({
      success: true,
      message: `${action} initiated on ${device.name}`,
      jobId: job.jobId,
      device: device.name
    });

  } catch (error) {
    console.error('Remote action error:', error);
    res.status(500).json({ 
      error: 'Failed to execute remote action',
      message: error.message 
    });
  }
});

// Check job status
router.get('/status/:jobId', requireAuth, async (req, res) => {
  try {
    const job = await ninjaOneService.getJobStatus(req.params.jobId);
    res.json({
      jobId: job.jobId,
      status: job.status,
      result: job.result
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to check job status' });
  }
});

// Get device status
router.get('/devices', requireAuth, requireRole('operator'), async (req, res) => {
  try {
    const devices = await ninjaOneService.getDevices();
    res.json({ devices });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get device list' });
  }
});

export default router;
```

### 1.2 Update Server.ts
```typescript
// Add to ClubOSV1-backend/src/server.ts
import remoteActionsRouter from './routes/remoteActions';

// Add after other routes
app.use('/api/remote-actions', remoteActionsRouter);
```

### 1.3 Environment Variables
```bash
# Add to Railway environment variables
NINJAONE_CLIENT_ID=your_client_id_here
NINJAONE_CLIENT_SECRET=your_client_secret_here
NINJAONE_BASE_URL=https://api.ninjarmm.com
```

## Phase 2: Frontend Integration

### 2.1 Create API Client
```typescript
// ClubOSV1-frontend/src/api/remoteActions.ts
import api from './index';

export const remoteActionsAPI = {
  execute: async (params: {
    action: string;
    location: string;
    bayNumber?: string;
    systemType?: string;
  }) => {
    const response = await api.post('/remote-actions/execute', params);
    return response.data;
  },

  getStatus: async (jobId: string) => {
    const response = await api.get(`/remote-actions/status/${jobId}`);
    return response.data;
  },

  getDevices: async () => {
    const response = await api.get('/remote-actions/devices');
    return response.data;
  }
};
```

### 2.2 Update Commands.tsx
```typescript
// Update handleExecuteReset function in commands.tsx
import { remoteActionsAPI } from '@/api/remoteActions';

const handleExecuteReset = async (trigger: Command) => {
  const confirmMessage = trigger.bayNumber 
    ? `Reset TrackMan on ${trigger.location} Bay ${trigger.bayNumber}?`
    : `Reset ${trigger.systemType} system at ${trigger.location}?`;
    
  if (!confirm(confirmMessage)) return;

  const toastId = toast.loading(`Executing ${trigger.name}...`);
  
  try {
    // Determine action type
    let action = 'restart-sim';
    if (trigger.systemType === 'music') action = 'restart-music';
    if (trigger.systemType === 'tv') action = 'restart-tv';
    
    const result = await remoteActionsAPI.execute({
      action,
      location: trigger.location!,
      bayNumber: trigger.bayNumber,
      systemType: trigger.systemType
    });

    toast.success(result.message, { id: toastId });
    
    // Start polling for job status
    if (result.jobId) {
      pollJobStatus(result.jobId, result.device);
    }
    
  } catch (error: any) {
    toast.error(error.response?.data?.message || 'Failed to execute action', { 
      id: toastId 
    });
  }
};

const pollJobStatus = async (jobId: string, deviceName: string) => {
  let attempts = 0;
  const maxAttempts = 24; // 2 minutes (5 second intervals)
  
  const interval = setInterval(async () => {
    attempts++;
    
    try {
      const status = await remoteActionsAPI.getStatus(jobId);
      
      if (status.status === 'completed') {
        toast.success(`✅ ${deviceName} action completed successfully`);
        clearInterval(interval);
      } else if (status.status === 'failed') {
        toast.error(`❌ ${deviceName} action failed`);
        clearInterval(interval);
      } else if (attempts >= maxAttempts) {
        toast.warning(`⏱️ ${deviceName} action is taking longer than expected`);
        clearInterval(interval);
      }
    } catch (error) {
      // Stop polling on error
      clearInterval(interval);
    }
  }, 5000);
};

// Add PC reboot handler
const handlePCReboot = async (location: string, bayNumber: string) => {
  if (!confirm(`⚠️ This will fully restart the PC for ${location} Bay ${bayNumber}. The bay will be unavailable for 3-5 minutes. Continue?`)) {
    return;
  }

  const toastId = toast.loading(`Rebooting PC for ${location} Bay ${bayNumber}...`);
  
  try {
    const result = await remoteActionsAPI.execute({
      action: 'reboot-pc',
      location,
      bayNumber
    });

    toast.success('PC reboot initiated. Bay will be back online in 3-5 minutes.', { 
      id: toastId,
      duration: 10000 
    });
    
  } catch (error: any) {
    toast.error(error.response?.data?.message || 'Failed to reboot PC', { 
      id: toastId 
    });
  }
};
```

## Phase 3: NinjaOne PowerShell Scripts

### 3.1 TrackMan Restart Script
```powershell
# File: Restart-TrackMan.ps1
# Deploy to NinjaOne script library

param(
    [string]$InitiatedBy = "Unknown",
    [string]$Timestamp = (Get-Date -Format "yyyy-MM-dd HH:mm:ss"),
    [string]$Reason = "Manual restart requested"
)

try {
    Write-Output "=== TrackMan Restart Script ==="
    Write-Output "Initiated by: $InitiatedBy"
    Write-Output "Timestamp: $Timestamp"
    Write-Output "Reason: $Reason"
    
    # Stop TrackMan processes
    $processes = Get-Process -Name "TrackMan*", "TPS*", "FlightScope*" -ErrorAction SilentlyContinue
    
    if ($processes) {
        Write-Output "Found $($processes.Count) TrackMan processes to stop"
        $processes | Stop-Process -Force
        Start-Sleep -Seconds 5
    }
    
    # Clear TrackMan cache (optional)
    $cachePath = "$env:LOCALAPPDATA\TrackMan\Cache"
    if (Test-Path $cachePath) {
        Remove-Item "$cachePath\*" -Recurse -Force -ErrorAction SilentlyContinue
        Write-Output "Cleared TrackMan cache"
    }
    
    # Start TrackMan
    $trackmanPaths = @(
        "C:\Program Files\TrackMan\TrackMan Golf\TrackMan.exe",
        "C:\Program Files (x86)\TrackMan\TrackMan.exe",
        "D:\TrackMan\TrackMan.exe"
    )
    
    $trackmanPath = $trackmanPaths | Where-Object { Test-Path $_ } | Select-Object -First 1
    
    if ($trackmanPath) {
        Start-Process $trackmanPath
        Write-Output "TrackMan started successfully from: $trackmanPath"
        exit 0
    } else {
        Write-Error "TrackMan executable not found in standard locations"
        exit 1
    }
    
} catch {
    Write-Error "Script failed: $_"
    exit 1
}
```

### 3.2 PC Reboot Script
```powershell
# File: Reboot-SimulatorPC.ps1
# Deploy to NinjaOne script library

param(
    [string]$InitiatedBy = "Unknown",
    [string]$Timestamp = (Get-Date -Format "yyyy-MM-dd HH:mm:ss"),
    [string]$Reason = "Manual reboot requested"
)

Write-Output "=== PC Reboot Script ==="
Write-Output "Initiated by: $InitiatedBy"
Write-Output "Timestamp: $Timestamp"
Write-Output "Reason: $Reason"

# Send notification to logged-in users
msg * /TIME:30 "This computer will restart in 30 seconds for maintenance. Please save your work."

# Wait 30 seconds
Start-Sleep -Seconds 30

# Force restart
Restart-Computer -Force
```

### 3.3 Music System Restart
```powershell
# File: Restart-MusicSystem.ps1
# Deploy to NinjaOne script library

param(
    [string]$InitiatedBy = "Unknown",
    [string]$Timestamp = (Get-Date -Format "yyyy-MM-dd HH:mm:ss"),
    [string]$Reason = "Manual restart requested"
)

try {
    Write-Output "=== Music System Restart Script ==="
    Write-Output "Initiated by: $InitiatedBy"
    Write-Output "Timestamp: $Timestamp"
    
    # Restart audio services
    $audioServices = @(
        "AudioSrv",
        "AudioEndpointBuilder",
        "ClubhouseMusicService"
    )
    
    foreach ($service in $audioServices) {
        $svc = Get-Service -Name $service -ErrorAction SilentlyContinue
        if ($svc) {
            Restart-Service -Name $service -Force
            Write-Output "Restarted service: $service"
        }
    }
    
    # Restart music application
    $musicApp = Get-Process -Name "SpotifyWebHelper", "Spotify" -ErrorAction SilentlyContinue
    if ($musicApp) {
        $musicApp | Stop-Process -Force
        Start-Sleep -Seconds 3
        Start-Process "spotify://"
        Write-Output "Restarted Spotify"
    }
    
    Write-Output "Music system restart completed"
    exit 0
    
} catch {
    Write-Error "Script failed: $_"
    exit 1
}
```

### 3.4 TV System Restart
```powershell
# File: Restart-TVSystem.ps1
# Deploy to NinjaOne script library

param(
    [string]$InitiatedBy = "Unknown",
    [string]$Timestamp = (Get-Date -Format "yyyy-MM-dd HH:mm:ss"),
    [string]$Reason = "Manual restart requested"
)

try {
    Write-Output "=== TV System Restart Script ==="
    Write-Output "Initiated by: $InitiatedBy"
    Write-Output "Timestamp: $Timestamp"
    
    # Restart display drivers
    $device = Get-PnpDevice | Where-Object {$_.FriendlyName -like "*Display*" -and $_.Status -eq "OK"}
    if ($device) {
        $device | Disable-PnpDevice -Confirm:$false -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 2
        $device | Enable-PnpDevice -Confirm:$false -ErrorAction SilentlyContinue
        Write-Output "Reset display adapter"
    }
    
    # Restart streaming apps
    $streamingApps = @("chrome", "msedge", "firefox")
    foreach ($app in $streamingApps) {
        $process = Get-Process -Name $app -ErrorAction SilentlyContinue
        if ($process) {
            $process | Stop-Process -Force
            Write-Output "Stopped $app"
        }
    }
    
    # Restart Chrome in kiosk mode for tournament display
    Start-Process "chrome.exe" -ArgumentList "--kiosk", "https://tournament.clubhouse247golf.com"
    
    Write-Output "TV system restart completed"
    exit 0
    
} catch {
    Write-Error "Script failed: $_"
    exit 1
}
```

## Phase 4: Database Schema

```sql
-- Add remote actions tracking table
CREATE TABLE IF NOT EXISTS remote_actions_log (
  id SERIAL PRIMARY KEY,
  action_type VARCHAR(50) NOT NULL,
  location VARCHAR(100) NOT NULL,
  device_name VARCHAR(200) NOT NULL,
  device_id VARCHAR(100) NOT NULL,
  initiated_by VARCHAR(255) NOT NULL,
  ninja_job_id VARCHAR(100),
  status VARCHAR(50) NOT NULL DEFAULT 'initiated',
  error_message TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_remote_actions_created ON remote_actions_log(created_at DESC);
CREATE INDEX idx_remote_actions_user ON remote_actions_log(initiated_by);
CREATE INDEX idx_remote_actions_location ON remote_actions_log(location);
CREATE INDEX idx_remote_actions_job ON remote_actions_log(ninja_job_id);

-- Add to system_events for unified logging
ALTER TABLE system_events 
ADD COLUMN IF NOT EXISTS remote_action_data JSONB;
```

## Phase 5: Testing & Deployment

### 5.1 Testing Checklist
```bash
# Backend Tests
cd ClubOSV1-backend

# 1. Test NinjaOne authentication
npm run test:ninjaone:auth

# 2. Test device mapping
npm run test:ninjaone:devices

# 3. Test script execution (dry run)
npm run test:ninjaone:scripts

# 4. Integration tests
npm run test:integration:remote-actions
```

### 5.2 Deployment Steps
```bash
# 1. Update environment variables in Railway
railway variables set NINJAONE_CLIENT_ID=xxx
railway variables set NINJAONE_CLIENT_SECRET=xxx
railway variables set NINJAONE_BASE_URL=https://api.ninjarmm.com

# 2. Deploy backend
cd ClubOSV1-backend
git add .
git commit -m "feat: integrate NinjaOne remote actions"
git push origin main

# 3. Deploy frontend updates
cd ../ClubOSV1-frontend
git add .
git commit -m "feat: connect remote actions to NinjaOne API"
git push origin main

# 4. Run database migrations
railway run npm run migrate
```

## Phase 6: Monitoring & Alerts

### 6.1 Add Monitoring Dashboard
```typescript
// Add to Operations page
const RemoteActionsWidget = () => {
  const [stats, setStats] = useState({
    last24h: 0,
    successRate: 0,
    mostUsedAction: '',
    recentActions: []
  });

  useEffect(() => {
    fetchRemoteActionStats();
  }, []);

  return (
    <div className="card">
      <h3>Remote Actions (24h)</h3>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <p className="text-2xl">{stats.last24h}</p>
          <p className="text-sm">Total Actions</p>
        </div>
        <div>
          <p className="text-2xl">{stats.successRate}%</p>
          <p className="text-sm">Success Rate</p>
        </div>
        <div>
          <p className="text-2xl">{stats.mostUsedAction}</p>
          <p className="text-sm">Most Used</p>
        </div>
      </div>
    </div>
  );
};
```

### 6.2 Slack Alert Integration
```typescript
// Enhanced Slack notifications
const sendActionAlert = async (action: any, status: 'success' | 'failed') => {
  const color = status === 'success' ? 'good' : 'danger';
  const emoji = status === 'success' ? '✅' : '❌';
  
  await sendSlackMessage({
    channel: '#remote-actions-log',
    text: `${emoji} Remote Action ${status}`,
    attachments: [{
      color,
      fields: [
        { title: 'Action', value: action.type, short: true },
        { title: 'Location', value: action.location, short: true },
        { title: 'Device', value: action.device, short: true },
        { title: 'User', value: action.user, short: true },
        { title: 'Duration', value: `${action.duration}s`, short: true },
        { title: 'Time', value: new Date().toLocaleString(), short: true }
      ]
    }]
  });
};
```

## Security Considerations

1. **Role-Based Access**: Only operators and admins can execute remote actions
2. **Audit Trail**: Every action logged with user, timestamp, and result
3. **Rate Limiting**: Max 10 remote actions per minute per user
4. **Device Validation**: Strict device ID mapping prevents unauthorized access
5. **Confirmation Dialogs**: Critical actions (PC reboot) require explicit confirmation
6. **Timeout Protection**: Job polling stops after 2 minutes to prevent infinite loops

## Rollback Plan

If issues arise:
1. Disable remote actions in system config
2. Remove NinjaOne API credentials from Railway
3. Revert frontend to hide Remote Actions tab
4. All logging remains for audit purposes

## Next Steps

1. **Immediate Actions**:
   - Get NinjaOne API credentials from IT team
   - Map all device IDs in NinjaOne dashboard
   - Deploy PowerShell scripts to NinjaOne

2. **This Week**:
   - Complete backend integration
   - Test with one location first (Bedford)
   - Deploy to production

3. **Next Week**:
   - Roll out to all locations
   - Monitor usage and success rates
   - Gather operator feedback

## Support Documentation

For operators:
- Remote Actions execute immediately - ensure customers are aware
- TrackMan restart takes 30-60 seconds
- PC reboot takes 3-5 minutes
- Music/TV restart is usually instant
- Check device status before executing actions
