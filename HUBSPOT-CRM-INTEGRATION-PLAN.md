# HubSpot CRM Integration Plan - Production Ready

## Overview
Integrate HubSpot CRM with ClubOS Messages to automatically display customer names and enable contact search for outbound messaging.

## Critical Requirements
- **Data Security**: Customer data must be encrypted and handled securely
- **Privacy Compliance**: GDPR/privacy compliant with audit trails
- **Reliability**: Must not break existing messaging functionality
- **Performance**: Cannot slow down message loading
- **Fallback**: Graceful degradation if HubSpot is unavailable

## Architecture Design

### Data Flow
```
Inbound Message:
OpenPhone → Webhook → HubSpot Lookup → Cache → Display Name

Outbound Search:
User Search → HubSpot API → Filter Results → Display Contacts → Send Message

Cache Strategy:
- 24-hour TTL for contact data
- Encrypted storage in PostgreSQL
- Background refresh for active conversations
```

### Security Measures
1. **API Key Security**
   - Encrypted storage in environment variables
   - Separate keys for production/staging
   - Audit log all API access
   - Rate limiting per user

2. **Data Protection**
   - Encrypt cached contact data at rest
   - No sensitive data in logs
   - Phone numbers anonymized in error messages
   - SSL/TLS for all API calls

3. **Access Control**
   - Only admin/operator/support can search contacts
   - Role-based visibility of contact details
   - Audit trail for all lookups

## Implementation Phases

### Phase 1: Foundation (Day 1-2)
1. **Environment Setup**
   ```bash
   # Required environment variables
   HUBSPOT_API_KEY=pk_xxx  # Private app key
   HUBSPOT_PORTAL_ID=xxxxx
   HUBSPOT_API_VERSION=v3
   HUBSPOT_RATE_LIMIT=100  # requests per second
   ```

2. **Database Schema**
   ```sql
   -- Migration 022_hubspot_integration.sql
   
   -- Contact cache table
   CREATE TABLE hubspot_contacts_cache (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     phone_number VARCHAR(20) NOT NULL,
     phone_normalized VARCHAR(20) NOT NULL, -- E.164 format
     hubspot_contact_id VARCHAR(255),
     contact_data JSONB, -- Encrypted
     first_name VARCHAR(255),
     last_name VARCHAR(255),
     company VARCHAR(255),
     email VARCHAR(255),
     last_interaction TIMESTAMP,
     cache_created_at TIMESTAMP DEFAULT NOW(),
     cache_expires_at TIMESTAMP DEFAULT NOW() + INTERVAL '24 hours',
     lookup_count INTEGER DEFAULT 0,
     created_at TIMESTAMP DEFAULT NOW(),
     updated_at TIMESTAMP DEFAULT NOW()
   );
   
   -- Indexes for performance
   CREATE UNIQUE INDEX idx_hubspot_cache_phone ON hubspot_contacts_cache(phone_normalized);
   CREATE INDEX idx_hubspot_cache_expires ON hubspot_contacts_cache(cache_expires_at);
   CREATE INDEX idx_hubspot_cache_name ON hubspot_contacts_cache(first_name, last_name);
   
   -- Audit log for compliance
   CREATE TABLE hubspot_api_audit_log (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     user_id UUID REFERENCES users(id),
     action VARCHAR(50) NOT NULL, -- lookup, search, sync
     phone_number_hash VARCHAR(64), -- SHA-256 hash
     hubspot_contact_id VARCHAR(255),
     request_data JSONB,
     response_status INTEGER,
     error_message TEXT,
     ip_address INET,
     user_agent TEXT,
     created_at TIMESTAMP DEFAULT NOW()
   );
   
   -- Search history for UX
   CREATE TABLE contact_search_history (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     user_id UUID REFERENCES users(id),
     search_query VARCHAR(255),
     selected_contact_id VARCHAR(255),
     created_at TIMESTAMP DEFAULT NOW()
   );
   ```

3. **HubSpot Service Class**
   ```typescript
   // src/services/hubspotService.ts
   
   interface HubSpotContact {
     id: string;
     firstName: string;
     lastName: string;
     phone: string;
     email?: string;
     company?: string;
     lastInteraction?: Date;
   }
   
   class HubSpotService {
     private rateLimiter: RateLimiter;
     private cache: ContactCache;
     private encryption: EncryptionService;
     
     // Single contact lookup by phone
     async lookupByPhone(phoneNumber: string, userId: string): Promise<HubSpotContact | null>
     
     // Search contacts by name or phone
     async searchContacts(query: string, userId: string, limit: number = 20): Promise<HubSpotContact[]>
     
     // Batch lookup for efficiency
     async batchLookup(phoneNumbers: string[], userId: string): Promise<Map<string, HubSpotContact>>
     
     // Sync all unknown contacts (background job)
     async syncUnknownContacts(): Promise<SyncResult>
     
     // Validate phone number format
     private normalizePhone(phone: string): string
     
     // Audit logging
     private logApiCall(userId: string, action: string, data: any): Promise<void>
   }
   ```

### Phase 2: Inbound Integration (Day 3-4)
1. **Webhook Enhancement**
   ```typescript
   // In OpenPhone webhook handler
   async function handleInboundMessage(data: WebhookData) {
     // Existing message processing...
     
     // New: HubSpot lookup
     if (data.from && !isKnownContact(data.from)) {
       try {
         const contact = await hubspotService.lookupByPhone(
           data.from,
           'system' // System user for webhooks
         );
         
         if (contact) {
           await updateConversationName(data.from, contact);
         }
       } catch (error) {
         // Log but don't fail message processing
         logger.error('HubSpot lookup failed', { error, phone: anonymizePhone(data.from) });
       }
     }
   }
   ```

2. **Messages API Update**
   ```typescript
   // GET /api/messages/conversations
   async function getConversations(req: Request, res: Response) {
     const conversations = await fetchConversations(req.user.id);
     
     // Enrich with HubSpot data
     const phoneNumbers = conversations.map(c => c.phone_number);
     const contacts = await hubspotService.batchLookup(phoneNumbers, req.user.id);
     
     // Merge data
     const enriched = conversations.map(conv => ({
       ...conv,
       customer_name: contacts.get(conv.phone_number)?.fullName || conv.customer_name,
       company: contacts.get(conv.phone_number)?.company,
       is_hubspot_contact: contacts.has(conv.phone_number)
     }));
     
     res.json({ conversations: enriched });
   }
   ```

### Phase 3: Outbound Search (Day 5-6)
1. **Search API Endpoint**
   ```typescript
   // POST /api/contacts/search
   {
     "query": "john smith",  // or "902-555-1234"
     "limit": 20,
     "include_recent": true
   }
   
   // Response
   {
     "contacts": [
       {
         "id": "hs_12345",
         "firstName": "John",
         "lastName": "Smith",
         "phone": "+19025551234",
         "phoneFormatted": "(902) 555-1234",
         "company": "ABC Corp",
         "email": "john@example.com",
         "lastInteraction": "2024-01-15T10:30:00Z",
         "hasActiveConversation": true
       }
     ],
     "recent": [...], // Recent conversations
     "cached": false  // Whether from cache or fresh API call
   }
   ```

2. **Frontend Search Component**
   ```typescript
   // NewConversationModal.tsx
   - Search input with debouncing (300ms)
   - Show loading state during search
   - Display results grouped by: Recent, HubSpot Contacts
   - Click to start conversation
   - Keyboard navigation support
   - Mobile-optimized UI
   ```

### Phase 4: Production Readiness (Day 7-8)
1. **Error Handling**
   - HubSpot API timeout: Use cached data if available
   - Invalid API key: Disable features, alert admin
   - Rate limiting: Queue requests, show user feedback
   - Network errors: Retry with exponential backoff

2. **Monitoring & Alerts**
   ```typescript
   // Metrics to track
   - HubSpot API response time
   - Cache hit rate
   - Failed lookups
   - Search usage patterns
   - API quota usage
   ```

3. **Testing Plan**
   - Unit tests for phone normalization
   - Integration tests with HubSpot sandbox
   - Load testing for batch lookups
   - Failure scenario testing
   - Security penetration testing

## Rollout Strategy

### Feature Flags
```typescript
HUBSPOT_INTEGRATION_ENABLED=false  // Master switch
HUBSPOT_INBOUND_LOOKUP=false      // Auto name resolution
HUBSPOT_OUTBOUND_SEARCH=false     // Contact search
HUBSPOT_CACHE_ENABLED=true        // Use caching
HUBSPOT_AUDIT_ENABLED=true        // Audit logging
```

### Gradual Rollout
1. **Week 1**: Enable for admin users only
2. **Week 2**: Enable for operators
3. **Week 3**: Enable for all support staff
4. **Week 4**: Full production rollout

### Rollback Plan
1. Disable feature flags immediately
2. Cache continues to serve existing data
3. Messages revert to phone numbers only
4. No data loss or service interruption

## Privacy & Compliance

### GDPR Compliance
- Right to access: Include HubSpot data in exports
- Right to deletion: Clear cache on request
- Data minimization: Only cache necessary fields
- Purpose limitation: Only for customer service
- Audit trail: Track all data access

### Security Checklist
- [ ] API keys encrypted in environment
- [ ] All API calls use HTTPS
- [ ] Phone numbers hashed in logs
- [ ] Rate limiting implemented
- [ ] Access control verified
- [ ] Audit logging active
- [ ] Error messages sanitized
- [ ] Cache encryption enabled

## Success Metrics
1. **Performance**
   - Page load time < 2s with HubSpot data
   - Search response < 500ms
   - Cache hit rate > 80%

2. **Reliability**
   - 99.9% uptime for messaging
   - < 0.1% failed lookups
   - Zero data breaches

3. **User Experience**
   - 90% of messages show real names
   - < 3 clicks to start new conversation
   - Positive user feedback

## Cost Considerations
- HubSpot API: 160 calls/second limit
- Estimated usage: 5,000 lookups/day
- Cache reduces API calls by 80%
- Within free tier limits

## Next Steps
1. Obtain HubSpot Private App credentials
2. Set up development environment
3. Create feature flags
4. Implement Phase 1 foundation
5. Begin testing with sample data
6. Schedule security review
7. Plan user training

---

**Remember**: This handles live customer data. Test thoroughly, implement gradually, and maintain audit trails for all operations.