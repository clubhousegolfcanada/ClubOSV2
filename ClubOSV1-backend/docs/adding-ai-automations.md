# Adding New AI Automations to Clubhouse OS

This guide explains how to add new AI automations that can detect customer messages, respond automatically, and integrate with external systems like NinjaOne.

## Overview

AI automations work by:
1. Pattern matching incoming messages to detect specific intents
2. Automatically responding with pre-configured or AI-generated responses
3. Optionally triggering actions in external systems
4. Learning from staff responses when patterns aren't matched

## Architecture

The AI automation system consists of several key components:

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│ Pattern Matcher │────▶│ Automation Engine│────▶│ Action Executor │
└─────────────────┘     └──────────────────┘     └─────────────────┘
         │                        │                        │
         ▼                        ▼                        ▼
  aiAutomationPatterns    aiAutomationService      External APIs
                                                   (NinjaOne, etc)
```

## Step-by-Step Guide: Adding a New Automation

Let's create a new automation for "computer_restart" that detects when customers report computer issues and can trigger a restart via NinjaOne.

### Step 1: Add Database Migration

Create a new migration file:

```sql
-- migrations/XXX_add_computer_restart_automation.sql

-- Add the automation feature
INSERT INTO ai_automation_features (
  feature_key, 
  feature_name, 
  description, 
  category, 
  enabled, 
  config, 
  required_permissions
) VALUES (
  'computer_restart',
  'Computer Restart Requests',
  'Automatically handle computer restart requests via NinjaOne',
  'technical',
  false,
  jsonb_build_object(
    'minConfidence', 0.7,
    'maxResponses', 1,
    'responseSource', 'hardcoded',
    'hardcodedResponse', 'I''ll restart that computer for you right away. This usually takes 2-3 minutes.',
    'allowFollowUp', false,
    'requiresAction', true,
    'actionType', 'ninjaone_restart',
    'actionConfig', jsonb_build_object(
      'requiresBayNumber', true,
      'confirmationRequired', true
    )
  ),
  ARRAY['admin', 'operator']
);

-- Add knowledge for the assistant
INSERT INTO assistant_knowledge (assistant_id, route, knowledge, version)
VALUES (
  'technical_assistant',
  'Technical Support',
  jsonb_build_object(
    'computer_restart', jsonb_build_object(
      'response', 'I''ll restart that computer for you right away. This usually takes 2-3 minutes.',
      'policy', 'Computers can be restarted remotely via NinjaOne. Always confirm the bay number.',
      'follow_up', 'Staff will monitor the restart and assist if issues persist.'
    )
  ),
  '1.0'
) ON CONFLICT (assistant_id) 
DO UPDATE SET 
  knowledge = assistant_knowledge.knowledge || EXCLUDED.knowledge,
  updated_at = CURRENT_TIMESTAMP;
```

### Step 2: Add Pattern Matching

Edit `src/services/aiAutomationPatterns.ts`:

```typescript
export const automationPatterns = {
  // ... existing patterns ...
  
  computer_restart: {
    patterns: [
      // Direct restart requests
      { pattern: /(?:restart|reboot|power\s+cycle).*(?:computer|pc|machine|system)/i, weight: 0.9, description: 'Restart computer' },
      { pattern: /(?:computer|pc|machine|system).*(?:restart|reboot|power\s+cycle)/i, weight: 0.9, description: 'Computer restart' },
      
      // Computer issues that might need restart
      { pattern: /(?:computer|pc|machine).*(?:frozen|stuck|freeze|hang|not\s+responding)/i, weight: 0.8, description: 'Computer frozen' },
      { pattern: /(?:computer|pc|machine).*(?:slow|lagging|sluggish)/i, weight: 0.7, description: 'Computer slow' },
      
      // Bay-specific mentions
      { pattern: /bay\s+\d+.*(?:computer|pc).*(?:restart|reboot|frozen|stuck)/i, weight: 0.85, description: 'Bay X computer issue' },
      { pattern: /(?:computer|pc).*bay\s+\d+.*(?:restart|reboot|frozen|stuck)/i, weight: 0.85, description: 'Computer bay X issue' },
      
      // Can you/please requests
      { pattern: /(?:can\s+you|could\s+you|please).*(?:restart|reboot).*(?:computer|pc)/i, weight: 0.8, description: 'Can you restart computer' },
      { pattern: /(?:need|want).*(?:computer|pc).*(?:restart|reboot)/i, weight: 0.8, description: 'Need computer restart' }
    ],
    negative: [
      { pattern: /(?:computer|pc).*(?:working|fine|good|fast)/i, weight: -0.8, description: 'Computer working fine' },
      { pattern: /(?:don't|dont|no).*(?:restart|reboot)/i, weight: -0.9, description: 'Don\'t restart' },
      { pattern: /(?:just|already).*(?:restart|reboot)/i, weight: -0.7, description: 'Already restarted' }
    ],
    minConfidence: 0.7
  }
};
```

### Step 3: Add NinjaOne Integration Service

Create `src/services/ninjaOneService.ts`:

```typescript
import axios from 'axios';
import { logger } from '../utils/logger';

interface NinjaOneDevice {
  id: string;
  systemName: string;
  organizationId: string;
  locationId: string;
  status: string;
  lastContact: Date;
}

interface RestartOptions {
  deviceId: string;
  forcedRestart?: boolean;
  message?: string;
}

class NinjaOneService {
  private baseUrl: string;
  private apiKey: string;
  private organizationId: string;

  constructor() {
    this.baseUrl = process.env.NINJAONE_API_URL || 'https://api.ninjarmm.com/v2';
    this.apiKey = process.env.NINJAONE_API_KEY || '';
    this.organizationId = process.env.NINJAONE_ORG_ID || '';
  }

  /**
   * Get device by bay number
   */
  async getDeviceByBay(bayNumber: number): Promise<NinjaOneDevice | null> {
    try {
      // Assuming devices are named like "BAY-01-PC", "BAY-02-PC", etc.
      const deviceName = `BAY-${bayNumber.toString().padStart(2, '0')}-PC`;
      
      const response = await axios.get(
        `${this.baseUrl}/organization/${this.organizationId}/devices`,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          params: {
            systemName: deviceName
          }
        }
      );

      const devices = response.data.devices || [];
      return devices.find((d: NinjaOneDevice) => 
        d.systemName.toUpperCase() === deviceName.toUpperCase()
      ) || null;
    } catch (error) {
      logger.error('Failed to get NinjaOne device:', error);
      return null;
    }
  }

  /**
   * Restart a device
   */
  async restartDevice(options: RestartOptions): Promise<{
    success: boolean;
    message: string;
    taskId?: string;
  }> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/device/${options.deviceId}/reboot`,
        {
          forced: options.forcedRestart || false,
          message: options.message || 'Restart requested by Clubhouse OS'
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return {
        success: true,
        message: 'Restart command sent successfully',
        taskId: response.data.taskId
      };
    } catch (error) {
      logger.error('Failed to restart device:', error);
      return {
        success: false,
        message: 'Failed to send restart command'
      };
    }
  }

  /**
   * Check device status
   */
  async checkDeviceStatus(deviceId: string): Promise<{
    online: boolean;
    lastSeen: Date | null;
  }> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/device/${deviceId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return {
        online: response.data.status === 'ONLINE',
        lastSeen: response.data.lastContact ? new Date(response.data.lastContact) : null
      };
    } catch (error) {
      logger.error('Failed to check device status:', error);
      return {
        online: false,
        lastSeen: null
      };
    }
  }
}

export const ninjaOneService = new NinjaOneService();
```

### Step 4: Add Action Handler to AI Automation Service

Edit `src/services/aiAutomationService.ts` to add action handling:

```typescript
import { ninjaOneService } from './ninjaOneService';

// Add to the processMessage method, after getting the automation response:

if (automation.config.requiresAction && automation.config.actionType) {
  const actionResult = await this.executeAction(
    automation.config.actionType,
    automation.config.actionConfig,
    message,
    phoneNumber
  );
  
  if (!actionResult.success) {
    // If action fails, append error to response
    response += `\n\nNote: ${actionResult.message}`;
  }
}

// Add new method for executing actions:
private async executeAction(
  actionType: string,
  actionConfig: any,
  message: string,
  phoneNumber: string
): Promise<{ success: boolean; message: string }> {
  try {
    switch (actionType) {
      case 'ninjaone_restart':
        return await this.handleComputerRestart(message, actionConfig);
      
      // Add more action types here
      default:
        return {
          success: false,
          message: 'Unknown action type'
        };
    }
  } catch (error) {
    logger.error('Action execution failed:', error);
    return {
      success: false,
      message: 'Failed to execute action'
    };
  }
}

private async handleComputerRestart(
  message: string,
  config: any
): Promise<{ success: boolean; message: string }> {
  // Extract bay number from message
  const bayMatch = message.match(/bay\s+(\d+)/i);
  
  if (!bayMatch && config.requiresBayNumber) {
    return {
      success: false,
      message: 'Please specify which bay number needs the computer restarted.'
    };
  }

  const bayNumber = parseInt(bayMatch[1]);
  
  // Get device from NinjaOne
  const device = await ninjaOneService.getDeviceByBay(bayNumber);
  
  if (!device) {
    return {
      success: false,
      message: `Could not find computer for bay ${bayNumber}.`
    };
  }

  // Check if device is online
  const status = await ninjaOneService.checkDeviceStatus(device.id);
  
  if (!status.online) {
    return {
      success: false,
      message: `Bay ${bayNumber} computer appears to be offline. Please check manually.`
    };
  }

  // Restart the device
  const result = await ninjaOneService.restartDevice({
    deviceId: device.id,
    message: `Restart requested via Clubhouse OS`
  });

  if (result.success) {
    // Log the action
    await this.logAutomationUsage(
      'computer_restart',
      message,
      `Restarted bay ${bayNumber} computer`,
      { 
        bayNumber, 
        deviceId: device.id,
        taskId: result.taskId 
      }
    );
  }

  return result;
}
```

### Step 5: Add Frontend UI Components

1. The automation will automatically appear in the AI Automations settings page
2. Add any custom configuration UI if needed in `src/components/settings/AIAutomationSettings.tsx`
3. Add monitoring for action results if desired

### Step 6: Add Tests

Create `src/__tests__/unit/services/computerRestartAutomation.test.ts`:

```typescript
import { findBestAutomation } from '../../../services/aiAutomationPatterns';
import { aiAutomationService } from '../../../services/aiAutomationService';
import { ninjaOneService } from '../../../services/ninjaOneService';

jest.mock('../../../services/ninjaOneService');

describe('Computer Restart Automation', () => {
  describe('Pattern Detection', () => {
    it('should detect computer restart requests', () => {
      const testCases = [
        'Can you restart the computer on bay 5?',
        'Computer frozen on bay 3',
        'Please reboot bay 2 PC',
        'Bay 7 computer not responding'
      ];

      testCases.forEach(message => {
        const result = findBestAutomation(message);
        expect(result?.feature).toBe('computer_restart');
        expect(result?.confidence).toBeGreaterThanOrEqual(0.7);
      });
    });
  });

  describe('Action Execution', () => {
    it('should restart computer when bay number provided', async () => {
      // Mock NinjaOne responses
      (ninjaOneService.getDeviceByBay as jest.Mock).mockResolvedValue({
        id: 'device-123',
        systemName: 'BAY-05-PC'
      });
      
      (ninjaOneService.checkDeviceStatus as jest.Mock).mockResolvedValue({
        online: true,
        lastSeen: new Date()
      });
      
      (ninjaOneService.restartDevice as jest.Mock).mockResolvedValue({
        success: true,
        message: 'Restart command sent',
        taskId: 'task-456'
      });

      const result = await aiAutomationService.processMessage(
        '+1234567890',
        'Please restart the computer on bay 5',
        'conv123'
      );

      expect(result.handled).toBe(true);
      expect(ninjaOneService.restartDevice).toHaveBeenCalled();
    });
  });
});
```

### Step 7: Environment Configuration

Add to `.env`:

```bash
# NinjaOne Configuration
NINJAONE_API_URL=https://api.ninjarmm.com/v2
NINJAONE_API_KEY=your-api-key-here
NINJAONE_ORG_ID=your-organization-id
```

### Step 8: Deploy and Test

1. Run the migration to add the feature to the database
2. Deploy the code changes
3. Enable the automation in the settings UI
4. Test with various messages to ensure pattern matching works
5. Verify NinjaOne integration triggers correctly

## Best Practices

1. **Pattern Design**
   - Include multiple variations of how users might phrase requests
   - Add negative patterns to avoid false positives
   - Test patterns with real customer messages

2. **Action Safety**
   - Always require confirmation for destructive actions
   - Log all automated actions for audit trail
   - Implement rate limiting to prevent abuse

3. **Error Handling**
   - Gracefully handle external API failures
   - Provide clear error messages to customers
   - Alert staff when automated actions fail

4. **Testing**
   - Unit test pattern matching thoroughly
   - Mock external services in tests
   - Test edge cases and error scenarios

## Adding More Action Types

To add more action types beyond NinjaOne:

1. Create a new service class (e.g., `hubspotService.ts`)
2. Add the action type to the switch statement in `executeAction`
3. Implement the action handler method
4. Add appropriate configuration in the database migration

## Monitoring and Analytics

The system automatically tracks:
- Pattern match rates
- Response success rates
- Action execution results
- Learning opportunities (when no pattern matches)

View these metrics in the AI Automations dashboard.