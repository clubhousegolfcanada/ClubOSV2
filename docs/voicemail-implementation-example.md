# Voicemail Implementation Example

## Quick Implementation for Voicemail Display

### 1. Backend Changes - Update Messages API

**File: `/ClubOSV1-backend/src/routes/messages.ts`**

Add voicemail indicator to conversations:

```typescript
// In the GET /conversations endpoint, after fetching conversations:

const validConversations = result.rows.map(row => {
  // Parse messages to check for voicemails
  const messages = row.messages || [];
  const hasVoicemail = messages.some(msg => 
    msg.type === 'call_transcript' || 
    msg.type === 'call_recording' ||
    (msg.type === 'call' && msg.transcript)
  );
  
  // Get latest voicemail if exists
  const latestVoicemail = messages
    .filter(msg => msg.type === 'call_transcript' || msg.type === 'call_recording')
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
  
  return {
    ...row,
    hasVoicemail,
    latestVoicemail,
    _debug_invalid_phone: !isValid
  };
});
```

### 2. Frontend Changes - Display Voicemails

**File: `/ClubOSV1-frontend/src/pages/messages.tsx`**

Add voicemail icon and handling:

```typescript
// Add Voicemail icon to imports
import { MessageCircle, Send, Search, Phone, Clock, User, ArrowLeft, Bell, BellOff, Sparkles, Check, X, Edit2, ChevronLeft, RefreshCw, ExternalLink, Plus, Monitor, Calendar, Voicemail } from 'lucide-react';

// In the conversation list item:
{filteredConversations.map(conv => (
  <div
    key={conv.id}
    onClick={() => selectConversation(conv)}
    className={`p-4 cursor-pointer hover:bg-[var(--bg-tertiary)] active:bg-[var(--bg-tertiary)] transition-colors ${
      selectedConversation?.id === conv.id ? 'bg-[var(--bg-tertiary)]' : ''
    }`}
  >
    <div className="flex items-start justify-between mb-1">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {conv.hasVoicemail && (
            <Voicemail className="w-4 h-4 text-[var(--accent)]" />
          )}
          <span className="font-medium text-[var(--text-primary)] truncate">
            {conv.customer_name || 'Unknown'}
          </span>
          {conv.unread_count > 0 && (
            <span className="bg-[var(--accent)] text-white text-xs px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
              {conv.unread_count}
            </span>
          )}
        </div>
        <p className="text-xs text-[var(--text-muted)] truncate">
          {conv.phone_number}
        </p>
      </div>
      <span className="text-xs text-[var(--text-muted)] ml-2 flex-shrink-0">
        {isClient && conv.updated_at ? formatDistanceToNow(new Date(conv.updated_at), { addSuffix: true }) : ''}
      </span>
    </div>
    {conv.latestVoicemail ? (
      <p className="text-sm text-[var(--text-secondary)] truncate">
        <span className="text-[var(--accent)]">Voicemail: </span>
        {conv.latestVoicemail.transcript || conv.latestVoicemail.summary || 'Voice message'}
      </p>
    ) : conv.lastMessage && (conv.lastMessage.text || conv.lastMessage.body) && (
      <p className="text-sm text-[var(--text-secondary)] truncate">
        {conv.lastMessage.direction === 'outbound' && <span className="text-[var(--text-muted)]">You: </span>}
        {conv.lastMessage.text || conv.lastMessage.body}
      </p>
    )}
  </div>
))}
```

### 3. Display Voicemail in Message Thread

```typescript
// In the messages display section:
{messages && messages.length > 0 ? (
  <div className="space-y-3">
    {messages.map((message, index) => {
      const isVoicemail = message.type === 'call_transcript' || 
                         message.type === 'call_recording' ||
                         message.type === 'call';
      
      if (isVoicemail) {
        return (
          <div key={message.id || index} className="flex justify-start">
            <div className="max-w-[85%] bg-[var(--bg-secondary)] rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <Voicemail className="w-4 h-4 text-[var(--accent)]" />
                <span className="text-sm font-medium text-[var(--accent)]">Voicemail</span>
                {message.duration && (
                  <span className="text-xs text-[var(--text-muted)]">
                    {Math.floor(message.duration / 60)}:{(message.duration % 60).toString().padStart(2, '0')}
                  </span>
                )}
              </div>
              <p className="text-sm text-[var(--text-primary)] whitespace-pre-wrap break-words">
                {message.transcript || message.summary || 'Voice message received - transcription pending'}
              </p>
              {message.recordingUrl && (
                <audio controls className="mt-2 max-w-full">
                  <source src={message.recordingUrl} type="audio/mpeg" />
                  Your browser does not support the audio element.
                </audio>
              )}
              <p className="text-xs mt-2 text-[var(--text-muted)]">
                {isClient && message.timestamp ? formatMessageDate(message.timestamp) : ''}
              </p>
            </div>
          </div>
        );
      }
      
      // Regular message display
      return (
        <div
          key={message.id || index}
          className={`flex ${message.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}
        >
          {/* ... existing message display ... */}
        </div>
      );
    })}
  </div>
) : (
  // ... empty state ...
)}
```

### 4. Enable Reply to Voicemail

The existing send message functionality will work automatically since voicemails are part of regular conversations with valid phone numbers.

### 5. Database Query to Check Existing Voicemails

```sql
-- Check if we already have voicemail data
SELECT 
  phone_number,
  customer_name,
  messages::text
FROM openphone_conversations
WHERE messages::text LIKE '%call_transcript%'
   OR messages::text LIKE '%call_recording%'
   OR messages::text LIKE '%"type":"call"%'
ORDER BY created_at DESC
LIMIT 10;
```

## Testing Steps

1. **Check if voicemails exist**: Run the SQL query above
2. **Update backend**: Add voicemail detection to messages API
3. **Update frontend**: Add voicemail display components
4. **Test locally**: 
   - Load messages page
   - Look for voicemail indicators
   - Try replying to a voicemail conversation
5. **Verify webhook**: Leave a test voicemail and check if it appears

## Notes

- OpenPhone automatically transcribes voicemails on Business plan
- Transcripts arrive via `call.transcript.completed` webhook
- Audio recordings available via `recordingUrl` field
- Can reply via SMS to any voicemail with valid phone number