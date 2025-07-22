# ClubOS UI Testing Guide

## Quick UI Tests

### 1. Basic Request Flow
1. Open http://localhost:3000
2. Enter: "I need to book bay 3 for tomorrow at 2pm"
3. Click "Process Request"
4. **Expected**: 
   - Routes to Booking bot
   - Shows confirmation or availability

### 2. Emergency Test
1. Enter: "There's water leaking in bay 2"
2. Click "Process Request"
3. **Expected**: 
   - Routes to Emergency bot
   - Shows P1 priority
   - Escalation message

### 3. Tech Support Test
1. Enter: "Screen frozen"
2. Add location: "Bay 3"
3. Click "Process Request"
4. **Expected**: 
   - Routes to Tech Support
   - Shows troubleshooting steps
   - Customer script: "I'll reset the system for you..."

### 4. Manual Route Override
1. Enter: "What are the membership options?"
2. Select "BrandTone" route (instead of Auto)
3. Click "Process Request"
4. **Expected**: 
   - Routes to Brand bot
   - Shows membership information

### 5. Slack Fallback Test
1. Toggle "Smart Assist (AI)" OFF
2. Enter any request
3. Click "Send to Slack"
4. **Expected**: 
   - Message about sending to Slack
   - No AI processing

### 6. Navigation Tests
- Click "Command Reference" - should show available commands
- Click "Operations Center" - should show system status
- Click "Pro Tips" - should show usage tips
- Test dark/light mode toggle

### 7. Keyboard Shortcuts
- `Ctrl/Cmd + Enter`: Submit request
- `Esc`: Reset form
- `Ctrl/Cmd + D`: Demo mode

### 8. Edge Cases
- Try very long request (>500 chars)
- Try very short request (<10 chars)
- Try special characters
- Try multiple submissions quickly

## What's Currently Broken/Limited

1. **Response Display**: Not showing full KB details
2. **Dark Mode**: Commands page resets to light
3. **History**: Not fully implemented
4. **Analytics**: Dashboard incomplete
5. **User Management**: No UI for this

## What's Working Well

1. **Routing**: Accurately routes to correct bot
2. **Validation**: Input validation works
3. **UI Design**: Clean and responsive
4. **Demo Mode**: Knowledge base integration
5. **Error Handling**: Shows appropriate errors