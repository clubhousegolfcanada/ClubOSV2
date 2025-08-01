# Voicemail & HubSpot Integration Plan

## 1. OpenPhone Voicemail Integration

### Current State
- OpenPhone webhooks already handle:
  - `call.completed` - Stores call information
  - `call.transcript.completed` - Stores call transcripts
  - `call.recording.completed` - Stores recording URLs
  - `call.summary.completed` - Stores AI-generated summaries
- Transcripts are stored as messages with type `call_transcript`
- We have existing infrastructure to fetch and display call transcripts

### Implementation Plan

#### Phase 1: Display Voicemails in Messages
1. **Modify Messages Query**
   - Update the messages API to include voicemail/call transcript messages
   - Filter for messages where type = 'call_transcript' or contains voicemail indicators
   
2. **UI Changes**
   - Add voicemail indicator icon in messages list
   - Show "Voicemail" label instead of regular message
   - Display transcript text as the message content
   - Add play button for recording URL if available

3. **Database Updates**
   ```sql
   -- Add voicemail flag to messages
   ALTER TABLE openphone_conversations 
   ADD COLUMN has_voicemail BOOLEAN DEFAULT FALSE;
   
   -- Update existing call transcripts
   UPDATE openphone_conversations 
   SET has_voicemail = TRUE 
   WHERE messages::text LIKE '%call_transcript%' 
   OR messages::text LIKE '%voicemail%';
   ```

#### Phase 2: Enable Text Response to Voicemails
1. **Backend Changes**
   - Ensure voicemail conversations have valid phone numbers
   - Allow sending SMS responses to voicemail phone numbers
   - Track voicemail-to-text conversation flow

2. **Frontend Changes**
   - Enable reply functionality for voicemail messages
   - Add context indicator: "Replying to voicemail from [time]"
   - Show voicemail transcript above reply box

### Technical Requirements
- OpenPhone Business plan (for transcription features)
- Webhook handling for voicemail-specific events
- Update message deduplication to handle voicemail messages

## 2. HubSpot CRM Integration

### Current State
- Customer names are stored locally in OpenPhone conversations
- No external CRM integration exists
- Names default to phone numbers when unknown

### Implementation Plan

#### Phase 1: HubSpot API Integration
1. **Setup & Authentication**
   ```typescript
   // Environment variables needed:
   HUBSPOT_API_KEY=your-private-app-key
   HUBSPOT_PORTAL_ID=your-portal-id
   ```

2. **Create HubSpot Service**
   ```typescript
   class HubSpotService {
     // Search contacts by phone number
     async searchContactByPhone(phoneNumber: string)
     
     // Get contact details
     async getContact(contactId: string)
     
     // Create/update contact
     async upsertContact(phoneNumber: string, data: any)
     
     // Sync conversation history
     async logActivity(contactId: string, activity: any)
   }
   ```

3. **API Endpoints**
   - `GET /api/contacts/lookup?phone={number}` - Lookup contact by phone
   - `POST /api/contacts/sync` - Sync all unknown contacts
   - `GET /api/contacts/{phone}/profile` - Get full contact profile

#### Phase 2: Auto-populate Customer Names
1. **Real-time Lookup**
   - When receiving new message, check HubSpot for contact
   - Cache results for 24 hours to reduce API calls
   - Update local database with customer name

2. **Batch Sync Process**
   - Daily job to sync all "Unknown" contacts
   - Update existing conversations with proper names
   - Log sync results for monitoring

3. **Database Schema**
   ```sql
   -- Add HubSpot tracking
   ALTER TABLE openphone_conversations 
   ADD COLUMN hubspot_contact_id VARCHAR(255),
   ADD COLUMN hubspot_last_sync TIMESTAMP,
   ADD COLUMN hubspot_sync_status VARCHAR(50);
   
   -- Create contacts cache table
   CREATE TABLE hubspot_contacts_cache (
     phone_number VARCHAR(20) PRIMARY KEY,
     hubspot_contact_id VARCHAR(255),
     contact_name VARCHAR(255),
     company VARCHAR(255),
     email VARCHAR(255),
     properties JSONB,
     cached_at TIMESTAMP DEFAULT NOW(),
     expires_at TIMESTAMP DEFAULT NOW() + INTERVAL '24 hours'
   );
   ```

#### Phase 3: Enhanced Features
1. **Contact Details Display**
   - Show company name, email in message sidebar
   - Display recent interactions from HubSpot
   - Show deal/booking information if available

2. **Activity Logging**
   - Log all SMS conversations to HubSpot timeline
   - Create tasks for follow-ups
   - Track customer engagement metrics

3. **Two-way Sync**
   - Update HubSpot when new booking made
   - Create contacts for new phone numbers
   - Sync tags and properties

### Implementation Priority
1. **Quick Win**: Basic phone lookup for names (1-2 days)
2. **Phase 1**: Full voicemail display in messages (3-4 days)
3. **Phase 2**: HubSpot name resolution (1 week)
4. **Phase 3**: Advanced CRM features (2-3 weeks)

### Security Considerations
- Encrypt HubSpot API keys
- Rate limit API calls (100/second for v3 API)
- Implement proper error handling
- Add audit logging for CRM access
- Follow GDPR compliance for data sync

### Next Steps
1. Get OpenPhone Business plan confirmation
2. Obtain HubSpot API credentials
3. Create feature flags for gradual rollout
4. Set up monitoring for API usage
5. Plan customer communication about new features