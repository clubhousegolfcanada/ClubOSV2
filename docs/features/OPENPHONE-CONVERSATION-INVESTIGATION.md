# OpenPhone Conversation Investigation: Why Old Messages Don't Show

## Summary
When a customer messages after more than 1 hour, their old messages don't appear because the system creates a NEW conversation record instead of showing the previous one. The UI only shows the most recent conversation per phone number.

## The Complete Flow

### 1. Message Arrives via Webhook (`/src/routes/openphone.ts`)

When OpenPhone sends a webhook for an incoming message:

```javascript
// Line 178: Generate conversation ID based on phone number
const conversationId = `conv_${phoneNumber.replace(/[^0-9]/g, '')}`;

// Lines 182-193: Check for existing conversation
const existingConv = await db.query(`
  SELECT id, messages, conversation_id, created_at, updated_at,
    CASE 
      WHEN jsonb_array_length(messages) > 0 
      THEN EXTRACT(EPOCH FROM (NOW() - (messages->-1->>'createdAt')::timestamp)) / 60
      ELSE EXTRACT(EPOCH FROM (NOW() - created_at)) / 60
    END as minutes_since_last_message
  FROM openphone_conversations 
  WHERE phone_number = $1
  ORDER BY updated_at DESC 
  LIMIT 1
`, [phoneNumber]);
```

### 2. Decision Point: Append or Create New

```javascript
// Line 196: One hour threshold
const ONE_HOUR_IN_MINUTES = 60;

if (existingConv.rows.length > 0 && existingConv.rows[0].minutes_since_last_message < ONE_HOUR_IN_MINUTES) {
  // Lines 199-223: APPEND to existing conversation
  const updatedMessages = [...existingMessages, newMessage];
  await updateOpenPhoneConversation(existingConv.rows[0].id, { messages: updatedMessages });
} else {
  // Lines 310-312: CREATE NEW conversation with timestamp
  const timestamp = Date.now();
  const newConversationId = `conv_${phoneNumber.replace(/[^0-9]/g, '')}_${timestamp}`;
  
  // Lines 320-335: Insert new conversation
  await insertOpenPhoneConversation({
    conversationId: newConversationId,
    phoneNumber,
    messages: [newMessage],
    // ... other fields
  });
}
```

### 3. UI Fetches Conversations (`/src/routes/messages.ts`)

When the Messages page loads:

```javascript
// Lines 86-110: Get conversations - ONLY ONE PER PHONE NUMBER
query = `
  SELECT DISTINCT ON (phone_number)
    id, phone_number, customer_name, messages, unread_count, created_at, updated_at
  FROM openphone_conversations
  WHERE phone_number IS NOT NULL 
  ORDER BY phone_number, updated_at DESC
`;
```

**Critical Issue**: `DISTINCT ON (phone_number)` means it only returns the MOST RECENT conversation for each phone number.

### 4. What Happens to Old Conversations

- Customer texts at 2:00 PM → Creates `conv_1234567890_1704567890123`
- Customer texts at 3:30 PM (90 min later) → Creates `conv_1234567890_1704573890456` 
- UI shows only the 3:30 PM conversation
- The 2:00 PM conversation still exists in the database but is NOT displayed

### 5. When User Clicks a Conversation

```javascript
// Line 217: Get single conversation
const result = await db.query(
  `SELECT * FROM openphone_conversations WHERE phone_number = $1`,
  [phoneNumber]
);
```

**Issue**: This query could return multiple conversations, but the code assumes only one.

## Database Structure

Each conversation record contains:
- `id`: UUID
- `phone_number`: Customer's phone number
- `conversation_id`: Unique ID like `conv_1234567890_1704567890123`
- `messages`: JSONB array of all messages in that conversation
- `created_at`: When conversation started
- `updated_at`: Last message time

## Why This Design?

The 1-hour window creates logical "sessions":
- Prevents very old messages from cluttering current conversations
- Groups related messages together
- Creates natural conversation boundaries

## The Problem

1. **Lost Context**: Staff can't see previous conversation history
2. **Multiple Records**: Same customer has multiple conversation records
3. **No Navigation**: No way to view older conversations
4. **Confusion**: Staff might not realize there's prior history

## Data Example

Customer with phone +1234567890:
```
Table: openphone_conversations
- Row 1: conv_1234567890_1704567890123 (Jan 1, 2:00 PM) - 5 messages
- Row 2: conv_1234567890_1704573890456 (Jan 1, 3:30 PM) - 2 messages  
- Row 3: conv_1234567890_1704660290789 (Jan 2, 10:00 AM) - 3 messages

UI Shows: Only Row 3 (most recent)
Hidden: Rows 1 & 2
```

## Technical Details

- **Threshold**: 60 minutes (hardcoded in `openphone.ts` line 196)
- **ID Generation**: `conv_${phoneNumber}_${timestamp}` for new conversations
- **Query Method**: `DISTINCT ON (phone_number)` filters to most recent
- **Storage**: All messages stored in JSONB array within each conversation record