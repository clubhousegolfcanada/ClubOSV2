# Messages Page Auto-Refresh Bug Investigation Report

## Executive Summary
The Messages page has a critical bug where it automatically resets to the first conversation during refresh cycles, causing users to lose their place when viewing other conversations.

## Root Cause Analysis

### The Problem
Located in `/src/pages/messages.tsx`, lines 282-288:

```javascript
// Auto-select first conversation if none selected
if (!selectedConversation && sortedConversations.length > 0) {
  const firstConversation = sortedConversations[0];
  // Use selectConversation to fetch full history
  selectConversation(firstConversation);
  logger.debug('Auto-selected first conversation:', firstConversation.customer_name);
}
```

### What's Happening

1. **Auto-refresh runs every 15 seconds** (line 133):
   - `setInterval` calls `loadConversations(false)` every 15000ms
   
2. **The bug occurs in `loadConversations` function** (lines 246-376):
   - Fetches fresh conversation list from API
   - Sorts conversations by most recent
   - **PROBLEM**: Line 283 checks `if (!selectedConversation && sortedConversations.length > 0)`
   - This condition can become true if `selectedConversation` reference gets lost during state updates

3. **State reference issue**:
   - When conversations are updated (line 280), React re-renders
   - The `selectedConversation` reference in the closure might be stale
   - If the reference is lost or undefined momentarily, the auto-select triggers
   - This causes the page to jump back to the first conversation

## Additional Findings

### 1. Refresh Mechanism
- **Interval**: 15 seconds (increased from 5s to reduce rate limiting)
- **Visibility check**: Only refreshes when tab is visible
- **Rate limiting**: Has backoff mechanism if too many requests

### 2. Conversation Updates
- Lines 291-341: Updates selected conversation if it exists
- Uses phone number normalization for matching
- Shows notifications for new messages
- Scrolls to bottom when new messages arrive

### 3. State Management Issues
- Multiple state updates happening in sequence
- No preservation of selected conversation ID across refreshes
- Relies on phone number matching which can fail

## Impact
- **User Experience**: Users lose their place every 15 seconds when reading older conversations
- **Productivity**: Makes it difficult to review conversation history
- **Frustration**: Users must repeatedly navigate back to their desired conversation

## Recommended Fix

### Option 1: Preserve Selection State (Quick Fix)
```javascript
// Replace lines 282-288 with:
if (!selectedConversation && sortedConversations.length > 0 && !conversations.length) {
  // Only auto-select on initial load, not on refresh
  const firstConversation = sortedConversations[0];
  selectConversation(firstConversation);
  logger.debug('Auto-selected first conversation on initial load');
}
```

### Option 2: Use Stable ID Reference (Better Fix)
```javascript
// Add state to track selected conversation ID
const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);

// In loadConversations:
if (!selectedConversationId && sortedConversations.length > 0 && !conversations.length) {
  const firstConversation = sortedConversations[0];
  setSelectedConversationId(firstConversation.id);
  selectConversation(firstConversation);
}

// When selecting conversation:
const selectConversation = async (conversation: Conversation) => {
  setSelectedConversationId(conversation.id);
  setSelectedConversation(conversation);
  // ... rest of function
}
```

### Option 3: Disable Auto-Select on Refresh (Simplest)
```javascript
// Add flag to track if initial load is complete
const [initialLoadComplete, setInitialLoadComplete] = useState(false);

// In loadConversations:
if (!selectedConversation && sortedConversations.length > 0 && !initialLoadComplete) {
  const firstConversation = sortedConversations[0];
  selectConversation(firstConversation);
  setInitialLoadComplete(true);
  logger.debug('Auto-selected first conversation on initial load');
}
```

## Testing Recommendations

1. **Test conversation persistence**:
   - Select a conversation other than the first
   - Wait 15 seconds for auto-refresh
   - Verify conversation selection remains

2. **Test with multiple scenarios**:
   - New messages arriving
   - Rate limiting conditions
   - Tab visibility changes
   - Network interruptions

3. **Performance testing**:
   - Monitor memory usage with long-running sessions
   - Check for memory leaks from interval handlers

## Additional Improvements Suggested

1. **Add conversation ID to URL**:
   - Use query parameter to maintain selection
   - Allow direct linking to conversations

2. **Optimize refresh strategy**:
   - Only fetch conversation list updates (not full reload)
   - Use WebSocket for real-time updates instead of polling

3. **Add user preference**:
   - Allow users to disable auto-refresh
   - Let users set refresh interval

## Conclusion
The bug is caused by the auto-select logic triggering on every refresh cycle when the `selectedConversation` state reference is lost or evaluated as falsy. The fix requires ensuring the auto-select only runs on initial page load, not on subsequent refreshes.