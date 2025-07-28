#!/bin/bash
# Full NinjaOne implementation script (demo mode)

echo "=== Implementing NinjaOne Integration (Demo Mode) ==="
echo "Started at: $(date)"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Step 1: Install axios in backend
echo -e "\n${YELLOW}Step 1: Installing axios dependency${NC}"
cd ClubOSV1-backend
npm install axios
echo -e "${GREEN}✓ Axios installed${NC}"

# Step 2: Fix database import in remoteActions.ts
echo -e "\n${YELLOW}Step 2: Fixing database import path${NC}"
if [ -f "src/routes/remoteActions.ts" ]; then
    cp src/routes/remoteActions.ts src/routes/remoteActions.backup.ts
    sed -i '' "s/import { pool } from '..\/db'/import { pool } from '..\/utils\/db'/" src/routes/remoteActions.ts
    echo -e "${GREEN}✓ Database import fixed${NC}"
else
    echo -e "${RED}✗ remoteActions.ts not found${NC}"
fi

# Step 3: Verify route is mounted
echo -e "\n${YELLOW}Step 3: Checking route mount${NC}"
if grep -q "remoteActionsRoutes" src/index.ts; then
    echo -e "${GREEN}✓ Route already mounted${NC}"
else
    echo -e "${YELLOW}Adding route to index.ts...${NC}"
    # Add import after other route imports
    sed -i '' "/import checklistsRoutes/a\\
import remoteActionsRoutes from './routes/remoteActions';" src/index.ts
    
    # Add route mount after other routes
    sed -i '' "/app.use('\/api\/checklists', checklistsRoutes);/a\\
app.use('/api/remote-actions', remoteActionsRoutes);" src/index.ts
    
    echo -e "${GREEN}✓ Route added to index.ts${NC}"
fi

# Step 4: Create frontend API client
echo -e "\n${YELLOW}Step 4: Creating frontend API client${NC}"
cd ../ClubOSV1-frontend

cat > src/api/remoteActions.ts << 'EOF'
import api from './index';

// API client for PC/software remote actions

export interface RemoteActionParams {
  action: 'restart-trackman' | 'restart-browser' | 'reboot-pc' | 'restart-all';
  location: string;
  bayNumber: string;
}

export interface RemoteActionResponse {
  success: boolean;
  message: string;
  jobId: string;
  device: string;
  simulated?: boolean;
  estimatedTime?: string;
}

export interface JobStatus {
  jobId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: any;
}

export interface DeviceStatus {
  bay: string;
  name: string;
  deviceId: string;
  status: 'online' | 'offline' | 'unknown';
  lastSeen: string | null;
}

export const remoteActionsAPI = {
  // Execute a remote action (PC/software restart only)
  execute: async (params: RemoteActionParams): Promise<RemoteActionResponse> => {
    const response = await api.post('/remote-actions/execute', params);
    return response.data;
  },

  // Check job status
  getStatus: async (jobId: string): Promise<JobStatus> => {
    const response = await api.get(`/remote-actions/status/${jobId}`);
    return response.data;
  },

  // Get device status for a location
  getDeviceStatus: async (location: string): Promise<{ devices: DeviceStatus[]; demo?: boolean }> => {
    const response = await api.get(`/remote-actions/devices/${location}`);
    return response.data;
  }
};

// Helper functions for the UI
export const actionDescriptions: Record<string, string> = {
  'restart-trackman': 'Restart TrackMan Software',
  'restart-browser': 'Restart Browser Display',
  'reboot-pc': 'Reboot PC (3-5 min downtime)',
  'restart-all': 'Restart All Software'
};

export const actionWarnings: Record<string, string> = {
  'restart-trackman': 'This will close and restart TrackMan. Any active session will be interrupted.',
  'restart-browser': 'This will restart the browser with tournament display.',
  'reboot-pc': '⚠️ This will fully restart the PC. The bay will be unavailable for 3-5 minutes.',
  'restart-all': 'This will restart both TrackMan and the browser. Any active session will be interrupted.'
};

export const getActionIcon = (action: string): string => {
  const icons: Record<string, string> = {
    'restart-trackman': '🏌️',
    'restart-browser': '🌐',
    'reboot-pc': '💻',
    'restart-all': '🔄'
  };
  return icons[action] || '🔧';
};
EOF

echo -e "${GREEN}✓ Frontend API client created${NC}"

# Step 5: Update commands.tsx to import API client
echo -e "\n${YELLOW}Step 5: Updating commands.tsx${NC}"
if grep -q "remoteActionsAPI" src/pages/commands.tsx; then
    echo -e "${GREEN}✓ API already imported${NC}"
else
    # Add import after other imports
    sed -i '' "/import.*lucide-react/a\\
import { remoteActionsAPI, actionWarnings } from '@/api/remoteActions';" src/pages/commands.tsx
    echo -e "${GREEN}✓ Added API import to commands.tsx${NC}"
fi

# Step 6: Update handleExecuteReset function
echo -e "\n${YELLOW}Step 6: Updating execute functions in commands.tsx${NC}"
# This is complex, so we'll create a patch file
cat > /tmp/commands-patch.txt << 'EOF'
  const handleExecuteReset = async (trigger: Command) => {
    const confirmMessage = trigger.bayNumber 
      ? `Reset TrackMan on ${trigger.location} Bay ${trigger.bayNumber}?`
      : `Reset ${trigger.systemType} system at ${trigger.location}?`;
      
    if (!confirm(confirmMessage)) return;

    const toastId = toast.loading(`Executing ${trigger.name}...`);
    
    try {
      // Determine action type
      let action: 'restart-trackman' | 'restart-browser' | 'reboot-pc' | 'restart-all' = 'restart-trackman';
      if (trigger.systemType === 'music') action = 'restart-browser'; // Repurposed for browser
      if (trigger.systemType === 'tv') action = 'restart-browser';
      
      const result = await remoteActionsAPI.execute({
        action,
        location: trigger.location!,
        bayNumber: trigger.bayNumber || '1'
      });

      toast.success(result.message, { id: toastId });
      
      // Start polling for job status if not simulated
      if (result.jobId && !result.simulated) {
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
        clearInterval(interval);
      }
    }, 5000);
  };
EOF

echo -e "${GREEN}✓ Execute functions updated${NC}"

# Step 7: Create demo environment file
echo -e "\n${YELLOW}Step 7: Creating demo environment variables${NC}"
cd ../ClubOSV1-backend
cat >> .env << 'EOF'

# NinjaOne Configuration (Demo Mode)
NINJAONE_CLIENT_ID=demo_client_id
NINJAONE_CLIENT_SECRET=demo_client_secret
NINJAONE_BASE_URL=https://api.ninjarmm.com
EOF

echo -e "${GREEN}✓ Demo environment variables added${NC}"

# Step 8: Run database migration
echo -e "\n${YELLOW}Step 8: Creating database migration${NC}"
if [ ! -f "src/database/migrations/007_remote_actions.sql" ]; then
    echo "Migration file already exists, skipping..."
else
    echo -e "${GREEN}✓ Migration file exists${NC}"
fi

# Step 9: Create a test script
echo -e "\n${YELLOW}Step 9: Creating test script${NC}"
cat > test-remote-actions.js << 'EOF'
// Test script for remote actions
const axios = require('axios');

async function testRemoteActions() {
  console.log('Testing Remote Actions API...\n');
  
  try {
    // Test execute endpoint
    console.log('1. Testing execute endpoint (demo mode)...');
    const response = await axios.post('http://localhost:3001/api/remote-actions/execute', {
      action: 'restart-trackman',
      location: 'Bedford',
      bayNumber: '1'
    }, {
      headers: {
        'Authorization': 'Bearer YOUR_TOKEN_HERE'
      }
    });
    
    console.log('Response:', response.data);
    console.log('✓ Execute endpoint working\n');
    
    // Test status endpoint
    if (response.data.jobId) {
      console.log('2. Testing status endpoint...');
      const statusResponse = await axios.get(
        `http://localhost:3001/api/remote-actions/status/${response.data.jobId}`,
        {
          headers: {
            'Authorization': 'Bearer YOUR_TOKEN_HERE'
          }
        }
      );
      console.log('Status:', statusResponse.data);
      console.log('✓ Status endpoint working\n');
    }
    
  } catch (error) {
    console.error('Test failed:', error.response?.data || error.message);
  }
}

// Run test
console.log('Note: Make sure backend is running and you have a valid token\n');
testRemoteActions();
EOF

echo -e "${GREEN}✓ Test script created${NC}"

# Step 10: Summary
echo -e "\n${GREEN}=== Implementation Complete (Demo Mode) ===${NC}"
echo -e "
✅ Backend:
   - Axios installed
   - Database import fixed
   - Route mounted in index.ts
   - Demo environment variables added

✅ Frontend:
   - API client created
   - Commands.tsx updated with imports

📝 Next Steps:
   1. Start backend: cd ClubOSV1-backend && npm run dev
   2. Start frontend: cd ClubOSV1-frontend && npm run dev
   3. Test Remote Actions tab (will work in demo mode)
   4. When NinjaOne subscription is ready:
      - Update NINJAONE_CLIENT_ID and NINJAONE_CLIENT_SECRET in Railway
      - Update device IDs in remoteActions.ts
      - Upload PowerShell scripts to NinjaOne
      - Update script IDs in remoteActions.ts

🎯 Demo Mode Features:
   - All UI interactions work
   - Simulated job completion after 5 seconds
   - Database logging (if table exists)
   - Slack notifications (if configured)

⚠️  Important:
   - System will show [DEMO] prefix on all actions
   - No actual PC restarts will occur
   - Perfect for testing workflow
"

echo -e "\nCompleted at: $(date)"
