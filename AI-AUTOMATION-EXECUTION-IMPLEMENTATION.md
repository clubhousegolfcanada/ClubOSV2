# AI Automation Execution Implementation Plan

## Current State
The AI automation system can:
- ✅ Detect patterns (gift cards, trackman issues, etc.)
- ✅ Generate responses from knowledge store or assistants
- ✅ Track usage and statistics
- ❌ Actually send messages to customers
- ❌ Execute actions (reset trackman, unlock doors, etc.)

## What Needs Implementation

### 1. Enable Automatic Message Sending
Currently, `aiAutomationService.ts` returns `{ handled: true, response: "text" }` but never sends the message.

### 2. Enable Action Execution
The service detects patterns but doesn't execute actions like:
- Reset trackman via NinjaOne
- Unlock doors via UniFi
- Create tickets
- Send notifications

### 3. Add Confirmation Workflow
For sensitive actions, implement:
- Store pending actions in database
- Send confirmation request to customer
- Execute on confirmation
- Expire after timeout

## Implementation Steps

### Step 1: Update aiAutomationService.ts
Add methods to actually send messages and execute actions:

```typescript
private async sendAutomaticResponse(
  phoneNumber: string, 
  message: string, 
  conversationId: string,
  featureKey: string
): Promise<boolean> {
  try {
    // Check if we can send automatic responses
    const canSend = await this.canSendAutomaticResponse(featureKey);
    if (!canSend) return false;
    
    // Actually send the message via OpenPhone
    await openPhoneService.sendMessage(
      phoneNumber,
      process.env.OPENPHONE_DEFAULT_NUMBER,
      message
    );
    
    // Log the action
    await this.logAutomationAction({
      feature_key: featureKey,
      conversation_id: conversationId,
      phone_number: phoneNumber,
      action_type: 'send_message',
      action_details: { message },
      status: 'completed',
      executed_by: 'ai_auto'
    });
    
    return true;
  } catch (error) {
    logger.error('Failed to send automatic response:', error);
    return false;
  }
}

private async executeAction(
  action: DetectedAction,
  phoneNumber: string,
  conversationId: string
): Promise<boolean> {
  try {
    // Check if we can execute actions
    const canExecute = await this.canExecuteActions(action.featureKey);
    if (!canExecute) return false;
    
    let success = false;
    let responseText = '';
    
    switch (action.type) {
      case 'trackman_reset':
        if (action.bayNumber) {
          success = await ninjaoneService.resetTrackman(action.bayNumber);
          responseText = success 
            ? `I've reset the Trackman in Bay ${action.bayNumber}. It should be working now!`
            : `I couldn't reset the Trackman automatically. A staff member will help you shortly.`;
        }
        break;
        
      case 'door_unlock':
        if (action.location) {
          success = await unifiService.unlockDoor(action.location);
          responseText = success
            ? `I've unlocked the door at ${action.location}. You have 30 seconds to enter.`
            : `I couldn't unlock the door automatically. Please call us for assistance.`;
        }
        break;
    }
    
    // Send response to customer
    if (responseText) {
      await this.sendAutomaticResponse(phoneNumber, responseText, conversationId, action.featureKey);
    }
    
    // Log the action
    await this.logAutomationAction({
      feature_key: action.featureKey,
      conversation_id: conversationId,
      phone_number: phoneNumber,
      action_type: action.type,
      action_details: action,
      status: success ? 'completed' : 'failed',
      executed_by: 'ai_auto'
    });
    
    return success;
  } catch (error) {
    logger.error('Failed to execute action:', error);
    return false;
  }
}
```

### Step 2: Update OpenPhone Webhook Handler
Modify `routes/openphone.ts` to actually send responses:

```typescript
// In the webhook handler where we process incoming messages
const automationResult = await aiAutomationService.processMessage(
  phoneNumber,
  messageText,
  conversationId,
  isInitialMessage
);

if (automationResult.handled && automationResult.response) {
  // Check if auto-send is enabled
  const canAutoSend = await aiAutomationService.canSendAutomaticResponse();
  
  if (canAutoSend) {
    // Actually send the response
    await openPhoneService.sendMessage(
      phoneNumber,
      process.env.OPENPHONE_DEFAULT_NUMBER,
      automationResult.response
    );
    
    logger.info('Sent automatic response', {
      phoneNumber: phoneNumber.slice(-4),
      responseLength: automationResult.response.length
    });
  } else {
    // Store as suggestion for manual review
    await db.query(
      'INSERT INTO message_suggestions (conversation_id, suggested_response, confidence) VALUES ($1, $2, $3)',
      [conversationId, automationResult.response, automationResult.confidence || 0.8]
    );
  }
}
```

### Step 3: Add Configuration UI
Update the AI Automations page to show:
- Toggle for "Send Automatic Responses"
- Toggle for "Execute Actions Automatically"
- Confidence threshold slider
- Max auto-responses per conversation
- Action confirmation requirements

### Step 4: Database Updates
The migration 055 already has the schema, but we need to use it:
- Track all actions in `ai_automation_actions` table
- Update feature configurations
- Store pending confirmations

### Step 5: Safety Features
- Rate limiting (max X messages per hour)
- Confidence thresholds (only send if > 0.85)
- Human review queue for low confidence
- Emergency stop button
- Audit trail of all actions

## Testing Plan
1. Test with gift card inquiries (safe, read-only)
2. Test trackman reset with confirmation
3. Test door unlock with high security
4. Monitor success rates and adjust thresholds

## Rollout Strategy
1. Enable for gift cards only (low risk)
2. Add hours/membership info (read-only)
3. Add trackman reset with confirmation
4. Add door unlock (admin only)

## Success Metrics
- Response time: < 2 seconds
- Accuracy: > 95% correct responses
- Cost savings: 70% reduction in OpenAI calls
- Customer satisfaction: Track feedback