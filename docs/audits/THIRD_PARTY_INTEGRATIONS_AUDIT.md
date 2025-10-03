# ClubOS Third-Party Integrations Comprehensive Audit

## Executive Summary
This document provides a complete audit of all third-party integrations in the ClubOS V1 system, including API configurations, security measures, and data flow patterns.

---

## 1. UniFi Access Integration
**Purpose:** Physical door access control across all Clubhouse locations
**Location:** `ClubOSV1-backend/src/services/unifiAccess.ts` and related files

### Configuration
- **Authentication Methods:**
  - Cloud Access via Ubiquiti account (recommended)
  - Direct controller access (requires VPN)
  - Local API access with tokens per location

### Environment Variables
```
UNIFI_CONTROLLER_URL
UNIFI_USERNAME / UNIFI_PASSWORD
UNIFI_CLOUD_USERNAME / UNIFI_CLOUD_PASSWORD
UNIFI_CONSOLE_ID
UNIFI_USE_LOCAL_ACCESS / UNIFI_USE_REMOTE_ACCESS
UNIFI_ACCESS_TOKEN / UNIFI_API_TOKEN
```

### Location-Specific Door IDs
- **Bedford:** Main, Staff, Emergency doors
- **Dartmouth:** Main, Staff, Bay, Emergency doors
- **Stratford:** Main, Staff, Emergency doors
- **Bayers Lake:** Main, Staff, Loading, Emergency doors
- **Truro:** Main, Staff, Emergency doors

### Security Features
- Dynamic import for ES modules
- Fallback to demo mode if not configured
- Connection retry logic (max 3 attempts)
- Door unlock duration limits (30s default, 300s max)

### Data Flow
```
ClubOS → UniFi Controller → Door Hardware
         ↓
    Activity Logs
```

---

## 2. NinjaOne RMM Integration
**Purpose:** Remote device management and script execution
**Location:** `ClubOSV1-backend/src/services/ninjaone.ts`

### Configuration
- **Base URL:** https://api.ninjarmm.com
- **Authentication:** OAuth2 client credentials flow
- **Token Management:** Auto-refresh with 5-minute safety margin

### Environment Variables
```
NINJAONE_BASE_URL
NINJAONE_CLIENT_ID
NINJAONE_CLIENT_SECRET
```

### Key Features
- Execute remote scripts on managed devices
- Monitor device online status
- Job status tracking
- Device validation before execution

### API Endpoints Used
- `/oauth/token` - Authentication
- `/v2/devices` - List devices
- `/v2/device/{id}` - Device status
- `/v2/device/{id}/script/{scriptId}/run` - Execute scripts
- `/v2/job/{jobId}` - Job status

### Security Measures
- Token caching with expiry management
- 30-second timeout on API calls
- Error handling with AppError middleware

---

## 3. OpenPhone Integration
**Purpose:** Phone/SMS communication management
**Location:** `ClubOSV1-backend/src/services/openphoneService.ts`

### Configuration
- **Base URL:** https://api.openphone.com/v3
- **Rate Limiting:** Custom rate limiter implementation

### Environment Variables
```
OPENPHONE_API_KEY
OPENPHONE_API_URL
OPENPHONE_WEBHOOK_SECRET
OPENPHONE_DEFAULT_NUMBER
```

### Key Features
- Fetch recent conversations
- Import historical conversations (up to 30 days)
- Message retrieval with pagination
- Database syncing of conversations

### API Endpoints Used
- `/conversations` - List conversations
- `/conversations/{id}/messages` - Get messages

### Security & Performance
- Rate limiter to prevent API throttling
- Conversation caching in database
- Masked API keys in responses
- Warning logs for unconfigured state

---

## 4. OpenAI Integration
**Purpose:** AI-powered features, chat assistants, and pattern learning
**Location:** `ClubOSV1-backend/src/services/llm/OpenAIProvider.ts`

### Configuration
- **Models:** GPT-4 Turbo Preview (default)
- **Assistant IDs:** Emergency, Booking, Tech Support, Brand Marketing

### Environment Variables
```
OPENAI_API_KEY
EMERGENCY_GPT_ID
BOOKING_GPT_ID
TECH_SUPPORT_GPT_ID
BRAND_MARKETING_GPT_ID
```

### Features
- Chat completions API
- Text embeddings for semantic search
- Assistant API integration
- Usage tracking and statistics
- Context-aware responses with user history

### Security & Performance
- 30-second timeout on requests
- Usage statistics tracking
- Daily stats reset
- API key validation on startup
- Project ID header support

---

## 5. Slack Integration
**Purpose:** Team notifications and fallback communication
**Location:** `ClubOSV1-backend/src/services/slackFallback.ts`

### Configuration
- **Webhook URL:** For incoming messages
- **Web API Client:** Optional bot token for advanced features

### Environment Variables
```
SLACK_WEBHOOK_URL
SLACK_BOT_TOKEN
SLACK_SIGNING_SECRET
SLACK_CHANNEL
```

### Features
- Send formatted messages with attachments
- Thread tracking capability
- Database logging of sent messages
- Configurable notification triggers:
  - LLM failures
  - Direct requests
  - Unhelpful feedback
  - Errors and tickets

### API Methods
- Incoming Webhooks
- Web API (chat.postMessage)

### Security
- Token masking in logs
- Channel ID validation
- Message tracking in database

---

## 6. Google OAuth Integration
**Purpose:** Employee and customer authentication
**Location:** `ClubOSV1-backend/src/services/googleAuth.ts`

### Configuration
- **Redirect URI:** Configurable per environment
- **Scopes:** userinfo.email, userinfo.profile, openid

### Environment Variables
```
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
GOOGLE_REDIRECT_URI
GOOGLE_TEST_EMAILS
```

### Security Features
- Domain restrictions for employees:
  - clubhouse247golf.com
  - clubhouseathleticclub.com
- Test email whitelist support
- Email verification required
- Token verification with Google library
- Session management with JWT

### OAuth Flow
```
User → Google Auth → Callback → Token Exchange → JWT Generation → ClubOS Session
```

---

## 7. HubSpot CRM Integration
**Purpose:** Customer relationship management and contact lookup
**Location:** `ClubOSV1-backend/src/services/hubspotService.ts`

### Configuration
- **Base URL:** https://api.hubapi.com/crm/v3
- **Authentication:** Bearer token (Private App)

### Environment Variables
```
HUBSPOT_API_KEY
```

### Features
- Contact search by phone number
- Phone number normalization (handles multiple formats)
- Two-tier caching:
  - Memory cache (5 minutes)
  - Database cache (24 hours)
- Connection verification on startup

### API Endpoints Used
- `/objects/contacts` - List/search contacts

### Performance Optimizations
- Dual caching strategy
- 5-second API timeout
- Phone normalization for reliable matching

---

## 8. TrackMan Integration
**Purpose:** Golf simulator settings and round tracking
**Location:** `ClubOSV1-backend/src/services/trackmanIntegrationService.ts`

### Configuration
- **API URL:** https://api.trackman.com/v1 (placeholder)
- **Currently:** Mock implementation with predefined courses

### Environment Variables
```
TRACKMAN_API_URL
TRACKMAN_API_KEY
TRACKMAN_WEBHOOK_SECRET
```

### Features
- Course catalog management
- Round tracking and scoring
- Settings configuration:
  - Course selection (Pebble Beach, St Andrews, Augusta, etc.)
  - Scoring types (stroke play, match play, stableford)
  - Tee types and positions
  - Wind conditions
- Webhook support for real-time updates

### Data Models
- TrackManSettings
- TrackManRound
- TrackManHole

---

## 9. Cloudflare Tunnels Integration
**Purpose:** Secure access to UniFi controllers without VPN
**Location:** `ClubOSV1-backend/src/services/cloudflare/CloudflareTunnelManager.ts`

### Configuration
- Per-location tunnel configurations
- HTTPS protocol with TLS bypass option

### Environment Variables
```
UNIFI_USE_CLOUDFLARE
CLOUDFLARE_TUNNEL_DARTMOUTH_ID
CLOUDFLARE_TUNNEL_DARTMOUTH_HOSTNAME
CLOUDFLARE_TUNNEL_BEDFORD_ID
CLOUDFLARE_TUNNEL_BEDFORD_HOSTNAME
```

### Tunnel Configurations
- **Dartmouth:** dartmouth-unifi.clubos.internal:12445
- **Bedford:** bedford-unifi.clubos.internal:12445
- **Other locations:** Similar pattern

### Security Features
- noTLSVerify option for self-signed certificates
- 30-second connection timeout
- Internal hostname routing

---

## 10. Push Notifications (VAPID)
**Purpose:** Browser push notifications
**Location:** Various notification service files

### Environment Variables
```
VAPID_PUBLIC_KEY
VAPID_PRIVATE_KEY
VAPID_EMAIL
```

### Frontend Configuration
```
NEXT_PUBLIC_VAPID_PUBLIC_KEY
```

---

## 11. Pattern Learning System (V3-PLS)
**Purpose:** AI-driven pattern recognition and automation
**Location:** `ClubOSV1-backend/src/services/patternLearningService.ts`

### Environment Variables
```
PATTERN_LEARNING_ENABLED
PATTERN_LEARNING_SHADOW_MODE
PATTERN_AUTO_EXECUTE_THRESHOLD (0.95)
PATTERN_SUGGEST_THRESHOLD (0.75)
PATTERN_QUEUE_THRESHOLD (0.50)
PATTERN_CONFIDENCE_INCREASE_SUCCESS (0.05)
PATTERN_CONFIDENCE_DECREASE_FAILURE (0.10)
PATTERN_SUGGESTION_TIMEOUT_SECONDS (30)
PATTERN_MIN_EXECUTIONS_FOR_AUTO (20)
```

### Features
- Shadow mode for safe testing
- Confidence-based automation
- Daily confidence decay
- Historical data import capability

---

## API Key Management Summary

### Current Storage Methods
1. **Environment Variables:** All credentials stored in `.env` files
2. **Database:** Some runtime configurations in `system_settings` table
3. **No Secret Management System:** Plain text storage

### Security Concerns
- API keys in plain text environment variables
- No automatic rotation mechanism
- Limited audit logging
- No encryption at rest for sensitive configs

### Recommendations
1. Implement AWS Secrets Manager or similar
2. Add API key rotation schedule
3. Implement audit logging for all external API calls
4. Encrypt sensitive data in database
5. Add monitoring for API usage/limits

---

## Data Flow Architecture

### Inbound Communications
```
Customer → OpenPhone/SMS → ClubOS → AI Processing → Response
         → Web Portal → ClubOS → Pattern Learning → Action
```

### Outbound Communications
```
ClubOS → Slack (notifications)
      → OpenPhone (SMS responses)
      → UniFi (door controls)
      → NinjaOne (device commands)
```

### Authentication Flow
```
User → Google OAuth → ClubOS → JWT Token → Session
```

### AI Processing Pipeline
```
Request → OpenAI GPT → Pattern Matching → Knowledge Base → Response
                     ↓
              Pattern Learning → Future Automation
```

---

## Integration Health & Monitoring

### Current Monitoring
- Connection verification on startup (HubSpot, Slack)
- Rate limiting (OpenPhone)
- Token expiry tracking (NinjaOne, Google OAuth)
- Usage statistics (OpenAI)

### Missing Monitoring
- No unified health check endpoint
- Limited error aggregation
- No integration uptime tracking
- Missing webhook validation logs

---

## Deployment Configuration

### Backend (Railway)
- **Production URL:** https://clubosv2-production.up.railway.app
- **Database:** PostgreSQL on Railway
- **Auto-deploy:** On git push to main branch

### Frontend (Vercel)
- **Production URL:** Configured in NEXT_PUBLIC_API_URL
- **Static hosting:** Next.js application

---

## Security Assessment Summary

### Strengths
- OAuth2 implementation for Google auth
- Domain restrictions for employee accounts
- Rate limiting on critical APIs
- Connection retry logic
- Token expiry management

### Vulnerabilities
- Plain text API key storage
- Incomplete webhook signature validation
- Missing API request signing
- No certificate pinning for external APIs
- Limited audit trail

### Critical Recommendations
1. **Immediate:** Implement secrets management
2. **Short-term:** Add webhook signature validation
3. **Medium-term:** Implement API request signing
4. **Long-term:** Add certificate pinning and full audit trail

---

## Compliance & Data Privacy

### Data Handling
- Customer phone numbers (OpenPhone, HubSpot)
- Employee authentication (Google OAuth)
- Physical access logs (UniFi)
- AI conversation history (OpenAI)

### GDPR/Privacy Considerations
- Encryption key configured but implementation unclear
- Data retention policies not documented
- Third-party data sharing not fully mapped
- User consent mechanisms need review

---

## Testing & Validation

### Current Testing
- Connection tests on startup
- Manual webhook testing scripts found

### Recommended Testing
1. Integration test suite for all external APIs
2. Webhook endpoint testing
3. Rate limit testing
4. Failover scenario testing
5. Token refresh testing

---

## Documentation Status

### Well Documented
- UniFi door mappings
- Environment variable examples
- Basic service configurations

### Needs Documentation
- Webhook payload formats
- Error handling procedures
- Failover strategies
- API rate limits and quotas
- Integration setup guides

---

## Next Steps

1. **Security Hardening**
   - Implement secrets management system
   - Add webhook signature validation
   - Enable audit logging

2. **Monitoring Enhancement**
   - Create unified health check endpoint
   - Add integration uptime monitoring
   - Implement error aggregation

3. **Documentation**
   - Create integration setup guides
   - Document webhook formats
   - Add troubleshooting guides

4. **Testing**
   - Build integration test suite
   - Add load testing for rate limits
   - Create failover tests

---

*Generated: October 2, 2025*
*Audit performed on ClubOS V1 Production System*