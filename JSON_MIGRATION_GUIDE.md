# ClubOS Assistant JSON Migration Guide

## Overview
This guide helps you migrate your OpenAI assistants from text responses to structured JSON responses.

## Implementation Steps

### 1. Update Each Assistant in OpenAI Dashboard

For each of your assistants:
- `asst_MIBSjbcKE6mkJQnEKgLrfYE2` (Emergency)
- `asst_YeWa98dP4Dv0eXwyjMsCHeE7` (Booking & Access)
- `asst_Uwu1EQXHPYuW5Q06FKqya5Ak` (Tech Support)
- `asst_7YqDqjc4bmWk1kcvXVhecpTS` (Brand/Marketing)

#### Steps:
1. Go to https://platform.openai.com/assistants
2. Click on each assistant
3. Update the instructions with the content from the corresponding file in `/assistant-instructions/`
4. Change "Response format" from "text" to "json_object"
5. Save the assistant

### 2. Backend Updates (Already Complete)

The backend has been updated to:
- Parse JSON responses from assistants
- Extract structured data (category, priority, actions, etc.)
- Pass structured data to frontend
- Maintain backward compatibility with text responses

### 3. Frontend Benefits

With JSON responses, your frontend can now:

#### Display Priority Indicators
```typescript
// Show different UI based on priority
if (response.priority === 'urgent') {
  return <UrgentAlert response={response} />;
} else if (response.priority === 'high') {
  return <HighPriorityCard response={response} />;
}
```

#### Render Interactive Action Lists
```typescript
// Create checklist UI from actions
{response.actions?.map((action, index) => (
  <ActionItem 
    key={index}
    type={action.type}
    description={action.description}
    details={action.details}
    onComplete={() => markActionComplete(index)}
  />
))}
```

#### Handle Escalations Automatically
```typescript
// Auto-escalate if needed
if (response.escalation?.required) {
  if (response.escalation.to === 'emergency_services') {
    showEmergencyContactModal(response.escalation);
  } else {
    createSupportTicket(response.escalation);
  }
}
```

#### Show Metadata Insights
```typescript
// Display useful metadata
{response.metadata?.estimatedResolutionTime && (
  <TimeEstimate time={response.metadata.estimatedResolutionTime} />
)}

{response.metadata?.commonIssue && (
  <Badge>Common Issue - Quick Fix Available</Badge>
)}
```

## JSON Response Schema

All assistants return responses in this format:

```json
{
  "response": "Human-readable response text",
  "category": "solution|information|confirmation|escalation|error",
  "priority": "low|medium|high|urgent",
  "actions": [
    {
      "type": "user_action|system_action",
      "description": "What to do",
      "details": {
        // Action-specific data
      }
    }
  ],
  "metadata": {
    "requiresFollowUp": boolean,
    // Domain-specific metadata
  },
  "escalation": {
    "required": boolean,
    "to": "string",
    "reason": "string",
    "contactMethod": "string"
  }
}
```

## Testing

After updating the assistants:

1. Test each route type:
```bash
# Emergency
curl -X POST https://clubosv2-production.up.railway.app/api/llm/request \
  -H "Content-Type: application/json" \
  -d '{"requestDescription": "There is smoke in the building"}'

# Check for structured response with category: "escalation", priority: "urgent"
```

2. Verify structured data in response:
- Check for `structured` field
- Verify `category` and `priority` are populated
- Ensure `actions` array contains proper steps

## Benefits Summary

1. **Better UX**: Show urgency, progress, and next steps clearly
2. **Automation**: Auto-escalate, create tickets, send notifications
3. **Analytics**: Track resolution times, common issues, escalation rates
4. **Consistency**: All assistants follow the same response format
5. **Future-Proof**: Easy to add new fields without breaking existing code

## Next Steps

1. Update all 4 assistants with new instructions
2. Test each assistant to verify JSON responses
3. Update frontend to leverage structured data
4. Add analytics tracking for categories and priorities
5. Implement escalation automation

The system will continue to work with text responses during migration, so you can update assistants one at a time.
