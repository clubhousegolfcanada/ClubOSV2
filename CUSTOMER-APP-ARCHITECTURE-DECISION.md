# Customer App Architecture Decision & Implementation Plan

## Executive Summary

With the database refactor complete, we need to decide between:
1. **Option A**: Branch/fork for separate customer app
2. **Option B**: Extend current system with customer role/auth

**Recommendation**: Option B - Extend current system with proper architecture patterns learned from refactor.

## Architecture Analysis

### Option A: Separate Customer App (Fork/Branch)
**Pros:**
- Clean separation of concerns
- Independent deployment cycles
- Smaller codebase for customer app
- Can use different tech stack (React Native)

**Cons:**
- **Duplicate code maintenance** (authentication, API clients, types)
- **API versioning complexity** between internal and external
- **Double database migrations** 
- **Feature parity challenges** - features added to internal may not reach customers
- **Integration overhead** - maintaining two separate systems

### Option B: Unified System with Role-Based Architecture (Recommended)
**Pros:**
- **Single source of truth** for business logic
- **Shared components** (auth, notifications, messaging)
- **Unified database** with proper access control
- **Feature reusability** - internal features easily exposed to customers
- **Consistent updates** - one deployment pipeline
- **Native app still possible** - React Native can consume same APIs

**Cons:**
- Larger codebase
- Need careful permission boundaries
- More complex routing logic

## Recommended Implementation Plan

### Phase 1: Authentication & Authorization Layer (Week 1)

#### 1.1 Enhanced User Model
```typescript
// Extend existing user table
ALTER TABLE users ADD COLUMN user_type VARCHAR(20) DEFAULT 'internal';
-- Types: 'internal', 'customer', 'guest'

ALTER TABLE users ADD COLUMN customer_profile JSONB DEFAULT '{}';
-- Stores: avatar, preferences, stats, social settings

ALTER TABLE users ADD COLUMN hubspot_contact_id VARCHAR(255);
ALTER TABLE users ADD COLUMN trackman_account_id VARCHAR(255);

-- Customer-specific tables
CREATE TABLE customer_profiles (
  user_id UUID PRIMARY KEY REFERENCES users(id),
  display_name VARCHAR(100),
  avatar_url TEXT,
  bio TEXT,
  location VARCHAR(100),
  skill_level VARCHAR(20),
  favorite_course VARCHAR(100),
  privacy_settings JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE friendships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  friend_id UUID REFERENCES users(id),
  status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, friend_id)
);

CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  captain_id UUID REFERENCES users(id),
  team_type VARCHAR(50),
  season VARCHAR(50),
  is_active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE team_members (
  team_id UUID REFERENCES teams(id),
  user_id UUID REFERENCES users(id),
  role VARCHAR(20) DEFAULT 'member',
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(team_id, user_id)
);
```

#### 1.2 Permission System
```typescript
// middleware/customerAuth.ts
export const customerAuth = {
  // Customer-only routes
  isCustomer: (req, res, next) => {
    if (req.user?.user_type === 'customer') next();
    else res.status(403).json({ error: 'Customer access only' });
  },
  
  // Shared routes with restrictions
  canAccessBooking: (req, res, next) => {
    if (req.user?.user_type === 'customer') {
      // Customers can only see their own bookings
      req.query.user_id = req.user.id;
    }
    next();
  },
  
  // Hide internal fields
  sanitizeResponse: (data) => {
    const internalFields = ['cost', 'internal_notes', 'admin_override'];
    return omit(data, internalFields);
  }
};
```

### Phase 2: Customer API Layer (Week 2)

#### 2.1 Route Structure
```
/api/v2/customer/
  /auth
    POST /register - Create customer account
    POST /login - Customer login
    POST /oauth - Google/Apple OAuth
  
  /profile
    GET / - Get own profile
    PUT / - Update profile
    DELETE / - Delete account (GDPR)
  
  /social
    GET /friends - List friends
    POST /friends/add - Send friend request
    PUT /friends/:id - Accept/reject request
    GET /teams - List teams
    POST /teams - Create team
    POST /teams/:id/invite - Invite to team
  
  /bookings
    GET / - Get user's bookings
    GET /:id - Get booking details
    POST /:id/share - Share with friends
    
  /events
    GET / - List events
    POST / - Create event
    POST /:id/register - Register for event
    
  /stats (if TrackMan integrated)
    GET /sessions - Get practice sessions
    GET /performance - Performance metrics
    POST /share - Share stats with friends
```

#### 2.2 API Gateway Pattern
```typescript
// services/apiGateway.ts
class CustomerAPIGateway {
  // Route to appropriate internal service
  async handleBooking(customerId: string, action: string) {
    // Check permissions
    if (!this.canAccessBooking(customerId)) {
      throw new ForbiddenError();
    }
    
    // Call internal Skedda service
    const booking = await skeddaService.getBooking();
    
    // Filter sensitive data
    return this.sanitizeBookingData(booking);
  }
  
  // Aggregate data from multiple sources
  async getCustomerDashboard(customerId: string) {
    const [profile, bookings, friends, stats] = await Promise.all([
      this.getProfile(customerId),
      this.getRecentBookings(customerId),
      this.getFriendActivity(customerId),
      this.getTrackManStats(customerId)
    ]);
    
    return { profile, bookings, friends, stats };
  }
}
```

### Phase 3: Mobile App Development (Weeks 3-4)

#### 3.1 Tech Stack
```yaml
Frontend:
  - React Native (iOS + Android)
  - Expo for rapid development
  - React Navigation 6
  - React Query for API state
  - AsyncStorage for offline
  
Push Notifications:
  - Firebase Cloud Messaging (Android)
  - Apple Push Notification Service (iOS)
  - Unified notification service in backend
  
State Management:
  - Zustand (same as web)
  - MMKV for persistent storage
```

#### 3.2 App Structure
```
ClubhouseCustomerApp/
├── src/
│   ├── screens/
│   │   ├── Auth/
│   │   ├── Dashboard/
│   │   ├── Bookings/
│   │   ├── Social/
│   │   ├── Events/
│   │   └── Profile/
│   ├── components/
│   │   ├── shared/
│   │   └── navigation/
│   ├── services/
│   │   ├── api/
│   │   ├── notifications/
│   │   └── storage/
│   └── hooks/
├── ios/
├── android/
└── app.json
```

### Phase 4: Integration Layer (Week 5)

#### 4.1 TrackMan Integration
```typescript
// services/trackmanIntegration.ts
interface TrackManConfig {
  apiUrl: string;
  clientId: string;
  clientSecret: string;
  scopes: ['read:sessions', 'read:stats'];
}

class TrackManService {
  async linkAccount(userId: string, trackmanAuth: OAuth2Token) {
    // Store encrypted tokens
    await this.storeTokens(userId, trackmanAuth);
    
    // Sync initial data
    await this.syncUserStats(userId);
  }
  
  async getSessionData(userId: string, sessionId: string) {
    const token = await this.getToken(userId);
    
    // Call TrackMan API
    const session = await trackmanAPI.getSession(sessionId, token);
    
    // Transform and store
    return this.transformSessionData(session);
  }
}
```

#### 4.2 Notification System
```typescript
// Extend existing notification service
class EnhancedNotificationService {
  async notifyFriendsOfBooking(userId: string, bookingId: string) {
    const friends = await this.getUserFriends(userId);
    const booking = await this.getBooking(bookingId);
    
    const notifications = friends.map(friend => ({
      user_id: friend.id,
      type: 'friend_booking',
      title: `${user.name} booked a tee time!`,
      body: `Join them at ${booking.time} on ${booking.date}`,
      data: { booking_id: bookingId },
      actions: [
        { action: 'view', title: 'View Booking' },
        { action: 'join', title: 'Join Session' }
      ]
    }));
    
    await this.sendBatch(notifications);
  }
}
```

### Phase 5: Security & Compliance (Week 6)

#### 5.1 Security Measures
```typescript
// Customer-specific security
const customerSecurity = {
  // Rate limiting per customer
  rateLimits: {
    bookings: '10/hour',
    friendRequests: '20/day',
    messages: '100/hour'
  },
  
  // Data isolation
  dataAccess: {
    ownDataOnly: ['profile', 'bookings', 'stats'],
    friendDataLimited: ['name', 'avatar', 'recentActivity'],
    publicData: ['events', 'leaderboards']
  },
  
  // Privacy controls
  privacy: {
    profileVisibility: ['public', 'friends', 'private'],
    statsSharing: ['public', 'friends', 'teams', 'private'],
    activityTracking: ['full', 'limited', 'none']
  }
};
```

#### 5.2 GDPR Compliance
```typescript
// Data export/deletion
class GDPRCompliance {
  async exportUserData(userId: string) {
    const data = await this.collectAllUserData(userId);
    
    // Include data from all integrations
    data.hubspot = await hubspotService.exportContact(userId);
    data.trackman = await trackmanService.exportStats(userId);
    data.bookings = await skeddaService.exportBookings(userId);
    
    return this.formatAsJSON(data);
  }
  
  async deleteUser(userId: string) {
    // Soft delete with 30-day recovery
    await this.markForDeletion(userId);
    
    // Schedule hard delete
    await this.scheduleHardDelete(userId, '30 days');
    
    // Notify integrations
    await this.notifyIntegrations(userId);
  }
}
```

## Implementation Roadmap

### Month 1: Foundation
- Week 1: Authentication & user model
- Week 2: Customer API layer
- Week 3-4: React Native app scaffold

### Month 2: Core Features
- Week 5: Integration layer (TrackMan, Skedda)
- Week 6: Security & compliance
- Week 7: Social features (friends, teams)
- Week 8: Testing & refinement

### Month 3: Launch Prep
- Week 9-10: Beta testing with select customers
- Week 11: App store submission
- Week 12: Production deployment

## Migration Strategy

### Database Migration
```sql
-- 002_customer_features.sql
-- Add customer tables and columns
-- Run after baseline migration

-- UP
CREATE TABLE customer_profiles...
CREATE TABLE friendships...
CREATE TABLE teams...
ALTER TABLE users ADD COLUMN user_type...

-- DOWN
DROP TABLE IF EXISTS customer_profiles CASCADE;
DROP TABLE IF EXISTS friendships CASCADE;
DROP TABLE IF EXISTS teams CASCADE;
ALTER TABLE users DROP COLUMN user_type;
```

### API Versioning
```typescript
// Maintain backwards compatibility
app.use('/api/v1', internalRoutes);  // Existing internal APIs
app.use('/api/v2', customerRoutes);  // New customer APIs
app.use('/api/v3', unifiedRoutes);   // Future unified APIs
```

## Risk Mitigation

### Technical Risks
1. **Performance degradation**
   - Solution: Implement caching layer (Redis)
   - Monitor with performance tracking

2. **Security breaches**
   - Solution: Regular security audits
   - Implement rate limiting and anomaly detection

3. **Integration failures**
   - Solution: Circuit breakers for external services
   - Fallback mechanisms for critical features

### Business Risks
1. **Feature creep**
   - Solution: Strict MVP scope
   - Phased release plan

2. **User adoption**
   - Solution: Beta testing program
   - Incentives for early adopters

## Success Metrics

### Technical KPIs
- API response time < 200ms (p95)
- App crash rate < 1%
- Push notification delivery > 95%
- Uptime > 99.9%

### Business KPIs
- User registration rate
- Daily active users (DAU)
- Booking share rate
- Friend connections per user
- Team participation rate

## Conclusion

Extending the current system with proper customer roles and permissions is the most sustainable approach. It leverages the refactored foundation, maintains a single source of truth, and allows for rapid feature development while keeping the codebase manageable.

The phased approach ensures we can deliver value quickly while building towards a comprehensive customer experience. The React Native app provides native performance while sharing the backend with the internal system.

## Next Steps

1. Review and approve this plan
2. Create customer feature branch
3. Implement Phase 1 (Authentication)
4. Set up React Native development environment
5. Begin API development

## Appendix: TrackMan API Investigation

### Required Research
1. API availability and pricing
2. OAuth2 flow documentation
3. Data access permissions
4. Rate limits and quotas
5. Terms of service for third-party apps

### Alternative: Simulator Direct Integration
If TrackMan API is unavailable:
- Investigate simulator software APIs
- Consider screen scraping (last resort)
- Build manual stats entry system
- Partner directly with TrackMan

---

Ready to proceed with implementation upon approval.