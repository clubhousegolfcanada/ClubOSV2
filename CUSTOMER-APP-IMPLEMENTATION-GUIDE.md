# Customer App Implementation Guide - Unified Architecture

## Quick Start Implementation

### Step 1: Database Extension (Day 1)

```sql
-- File: ClubOSV1-backend/src/database/migrations/002_customer_features.sql

-- UP
-- Extend users table for customer features
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS user_type VARCHAR(20) DEFAULT 'internal',
ADD COLUMN IF NOT EXISTS customer_metadata JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS hubspot_contact_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS trackman_account_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS app_settings JSONB DEFAULT '{"notifications": true, "privacy": "friends"}';

-- Customer profiles
CREATE TABLE IF NOT EXISTS customer_profiles (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  display_name VARCHAR(100),
  avatar_url TEXT,
  bio TEXT,
  handicap DECIMAL(3,1),
  home_course VARCHAR(100),
  skill_level VARCHAR(20) CHECK (skill_level IN ('beginner', 'intermediate', 'advanced', 'pro')),
  stats JSONB DEFAULT '{}',
  achievements JSONB DEFAULT '[]',
  privacy_settings JSONB DEFAULT '{"profile": "public", "stats": "friends", "bookings": "friends"}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Friend system
CREATE TABLE IF NOT EXISTS friendships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'blocked')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  accepted_at TIMESTAMP,
  UNIQUE(requester_id, recipient_id),
  CHECK (requester_id != recipient_id)
);

-- Teams/Groups
CREATE TABLE IF NOT EXISTS teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  team_type VARCHAR(50) CHECK (team_type IN ('league', 'casual', 'tournament', 'corporate')),
  captain_id UUID REFERENCES users(id),
  season VARCHAR(50),
  max_members INTEGER DEFAULT 20,
  is_active BOOLEAN DEFAULT true,
  is_public BOOLEAN DEFAULT false,
  join_code VARCHAR(20) UNIQUE,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Team membership
CREATE TABLE IF NOT EXISTS team_members (
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(20) DEFAULT 'member' CHECK (role IN ('captain', 'co-captain', 'member')),
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  invite_accepted BOOLEAN DEFAULT false,
  stats JSONB DEFAULT '{}',
  PRIMARY KEY(team_id, user_id)
);

-- Events/Tournaments
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL,
  description TEXT,
  event_type VARCHAR(50) CHECK (event_type IN ('tournament', 'league', 'casual', 'lesson', 'social')),
  organizer_id UUID REFERENCES users(id),
  team_id UUID REFERENCES teams(id),
  start_date TIMESTAMP NOT NULL,
  end_date TIMESTAMP,
  max_participants INTEGER,
  registration_deadline TIMESTAMP,
  location VARCHAR(200),
  price DECIMAL(10,2),
  rules JSONB DEFAULT '{}',
  is_recurring BOOLEAN DEFAULT false,
  recurrence_rule VARCHAR(100),
  is_public BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Event participants
CREATE TABLE IF NOT EXISTS event_participants (
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  team_id UUID REFERENCES teams(id),
  status VARCHAR(20) DEFAULT 'registered' CHECK (status IN ('registered', 'waitlist', 'cancelled')),
  check_in_time TIMESTAMP,
  score JSONB DEFAULT '{}',
  registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(event_id, user_id)
);

-- Booking shares
CREATE TABLE IF NOT EXISTS booking_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id VARCHAR(255) NOT NULL, -- External booking ID from Skedda
  sharer_id UUID REFERENCES users(id),
  share_type VARCHAR(20) CHECK (share_type IN ('friends', 'team', 'public')),
  team_id UUID REFERENCES teams(id),
  message TEXT,
  expires_at TIMESTAMP,
  max_joiners INTEGER DEFAULT 3,
  current_joiners INTEGER DEFAULT 0,
  share_code VARCHAR(20) UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Activity feed
CREATE TABLE IF NOT EXISTS activity_feed (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  activity_type VARCHAR(50) NOT NULL,
  activity_data JSONB NOT NULL,
  visibility VARCHAR(20) DEFAULT 'friends' CHECK (visibility IN ('public', 'friends', 'private')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_activity (user_id, created_at DESC),
  INDEX idx_activity_type (activity_type)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_friendships_requester ON friendships(requester_id, status);
CREATE INDEX IF NOT EXISTS idx_friendships_recipient ON friendships(recipient_id, status);
CREATE INDEX IF NOT EXISTS idx_team_members_user ON team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_events_date ON events(start_date);
CREATE INDEX IF NOT EXISTS idx_events_organizer ON events(organizer_id);
CREATE INDEX IF NOT EXISTS idx_booking_shares_code ON booking_shares(share_code);
CREATE INDEX IF NOT EXISTS idx_activity_feed_created ON activity_feed(created_at DESC);

-- DOWN
DROP TABLE IF EXISTS activity_feed CASCADE;
DROP TABLE IF EXISTS booking_shares CASCADE;
DROP TABLE IF EXISTS event_participants CASCADE;
DROP TABLE IF EXISTS events CASCADE;
DROP TABLE IF EXISTS team_members CASCADE;
DROP TABLE IF EXISTS teams CASCADE;
DROP TABLE IF EXISTS friendships CASCADE;
DROP TABLE IF EXISTS customer_profiles CASCADE;

ALTER TABLE users 
DROP COLUMN IF EXISTS user_type,
DROP COLUMN IF EXISTS customer_metadata,
DROP COLUMN IF EXISTS hubspot_contact_id,
DROP COLUMN IF EXISTS trackman_account_id,
DROP COLUMN IF EXISTS app_settings;
```

### Step 2: Customer Auth Middleware (Day 2)

```typescript
// File: ClubOSV1-backend/src/middleware/customerAuth.ts

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { pool } from '../utils/db';

export interface CustomerRequest extends Request {
  customer?: {
    id: string;
    email: string;
    user_type: 'customer';
    profile?: any;
  };
}

export const customerAuthMiddleware = {
  // Verify customer JWT
  authenticate: async (req: CustomerRequest, res: Response, next: NextFunction) => {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');
      
      if (!token) {
        return res.status(401).json({ error: 'No token provided' });
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
      
      // Verify user exists and is customer
      const result = await pool.query(
        `SELECT u.*, cp.* 
         FROM users u
         LEFT JOIN customer_profiles cp ON u.id = cp.user_id
         WHERE u.id = $1 AND u.user_type = 'customer' AND u.is_active = true`,
        [decoded.userId]
      );

      if (result.rows.length === 0) {
        return res.status(401).json({ error: 'Invalid customer account' });
      }

      req.customer = {
        id: result.rows[0].id,
        email: result.rows[0].email,
        user_type: 'customer',
        profile: result.rows[0]
      };

      next();
    } catch (error) {
      res.status(401).json({ error: 'Invalid token' });
    }
  },

  // Check if user owns resource
  ownsResource: (resourceKey: string) => {
    return (req: CustomerRequest, res: Response, next: NextFunction) => {
      const resourceId = req.params[resourceKey] || req.body[resourceKey];
      
      if (resourceId !== req.customer?.id) {
        return res.status(403).json({ error: 'Access denied' });
      }
      
      next();
    };
  },

  // Rate limiting for customers
  rateLimit: (limit: number, window: string) => {
    const limits = new Map();
    
    return (req: CustomerRequest, res: Response, next: NextFunction) => {
      const key = `${req.customer?.id}:${req.path}`;
      const now = Date.now();
      
      if (!limits.has(key)) {
        limits.set(key, { count: 1, resetAt: now + 3600000 });
        return next();
      }
      
      const record = limits.get(key);
      
      if (now > record.resetAt) {
        record.count = 1;
        record.resetAt = now + 3600000;
        return next();
      }
      
      if (record.count >= limit) {
        return res.status(429).json({ 
          error: 'Rate limit exceeded',
          retryAfter: record.resetAt - now 
        });
      }
      
      record.count++;
      next();
    };
  },

  // Sanitize responses for customers
  sanitizeResponse: (fields: string[]) => {
    return (req: CustomerRequest, res: Response, next: NextFunction) => {
      const originalJson = res.json;
      
      res.json = function(data: any) {
        // Remove internal fields
        const sanitized = removeFields(data, fields);
        return originalJson.call(this, sanitized);
      };
      
      next();
    };
  }
};

// Helper to remove fields recursively
function removeFields(obj: any, fields: string[]): any {
  if (Array.isArray(obj)) {
    return obj.map(item => removeFields(item, fields));
  }
  
  if (obj !== null && typeof obj === 'object') {
    const cleaned = { ...obj };
    fields.forEach(field => delete cleaned[field]);
    
    Object.keys(cleaned).forEach(key => {
      cleaned[key] = removeFields(cleaned[key], fields);
    });
    
    return cleaned;
  }
  
  return obj;
}
```

### Step 3: Customer API Routes (Day 3-4)

```typescript
// File: ClubOSV1-backend/src/routes/customer/index.ts

import { Router } from 'express';
import { customerAuthMiddleware as auth } from '../../middleware/customerAuth';
import authRoutes from './auth';
import profileRoutes from './profile';
import socialRoutes from './social';
import bookingRoutes from './bookings';
import eventRoutes from './events';
import statsRoutes from './stats';

const router = Router();

// Public routes (no auth required)
router.use('/auth', authRoutes);

// Protected routes
router.use('/profile', auth.authenticate, profileRoutes);
router.use('/social', auth.authenticate, socialRoutes);
router.use('/bookings', auth.authenticate, bookingRoutes);
router.use('/events', auth.authenticate, eventRoutes);
router.use('/stats', auth.authenticate, statsRoutes);

// Health check
router.get('/health', (req, res) => {
  res.json({ status: 'ok', version: '2.0.0' });
});

export default router;
```

```typescript
// File: ClubOSV1-backend/src/routes/customer/social.ts

import { Router } from 'express';
import { pool } from '../../utils/db';
import { customerAuthMiddleware as auth } from '../../middleware/customerAuth';

const router = Router();

// Get friends list
router.get('/friends', async (req: any, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        u.id, u.name, u.email,
        cp.display_name, cp.avatar_url, cp.skill_level,
        f.status, f.created_at
      FROM friendships f
      JOIN users u ON (
        CASE 
          WHEN f.requester_id = $1 THEN f.recipient_id = u.id
          WHEN f.recipient_id = $1 THEN f.requester_id = u.id
        END
      )
      LEFT JOIN customer_profiles cp ON u.id = cp.user_id
      WHERE (f.requester_id = $1 OR f.recipient_id = $1)
        AND f.status = 'accepted'
      ORDER BY u.name
    `, [req.customer.id]);

    res.json({ friends: result.rows });
  } catch (error) {
    console.error('Error fetching friends:', error);
    res.status(500).json({ error: 'Failed to fetch friends' });
  }
});

// Send friend request
router.post('/friends/request', 
  auth.rateLimit(20, '1d'),
  async (req: any, res) => {
    const { recipient_email } = req.body;

    try {
      // Find recipient
      const recipientResult = await pool.query(
        'SELECT id FROM users WHERE email = $1 AND user_type = $2',
        [recipient_email, 'customer']
      );

      if (recipientResult.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      const recipientId = recipientResult.rows[0].id;

      // Check if friendship exists
      const existingResult = await pool.query(
        `SELECT * FROM friendships 
         WHERE (requester_id = $1 AND recipient_id = $2)
            OR (requester_id = $2 AND recipient_id = $1)`,
        [req.customer.id, recipientId]
      );

      if (existingResult.rows.length > 0) {
        return res.status(400).json({ error: 'Friend request already exists' });
      }

      // Create friend request
      await pool.query(
        `INSERT INTO friendships (requester_id, recipient_id, status)
         VALUES ($1, $2, 'pending')`,
        [req.customer.id, recipientId]
      );

      // Send notification
      await notificationService.send({
        user_id: recipientId,
        type: 'friend_request',
        title: 'New Friend Request',
        body: `${req.customer.profile.name} wants to be your friend`,
        data: { requester_id: req.customer.id }
      });

      res.json({ success: true, message: 'Friend request sent' });
    } catch (error) {
      console.error('Error sending friend request:', error);
      res.status(500).json({ error: 'Failed to send friend request' });
    }
  }
);

// Accept/reject friend request
router.put('/friends/request/:requestId', async (req: any, res) => {
  const { requestId } = req.params;
  const { action } = req.body; // 'accept' or 'reject'

  try {
    const result = await pool.query(
      `UPDATE friendships 
       SET status = $1, accepted_at = CASE WHEN $1 = 'accepted' THEN NOW() ELSE NULL END
       WHERE id = $2 AND recipient_id = $3
       RETURNING *`,
      [action === 'accept' ? 'accepted' : 'rejected', requestId, req.customer.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Friend request not found' });
    }

    res.json({ success: true, friendship: result.rows[0] });
  } catch (error) {
    console.error('Error updating friend request:', error);
    res.status(500).json({ error: 'Failed to update friend request' });
  }
});

// Get teams
router.get('/teams', async (req: any, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        t.*,
        tm.role, tm.joined_at,
        COUNT(tm2.user_id) as member_count
      FROM teams t
      JOIN team_members tm ON t.id = tm.team_id
      LEFT JOIN team_members tm2 ON t.id = tm2.team_id
      WHERE tm.user_id = $1 AND t.is_active = true
      GROUP BY t.id, tm.role, tm.joined_at
      ORDER BY tm.joined_at DESC
    `, [req.customer.id]);

    res.json({ teams: result.rows });
  } catch (error) {
    console.error('Error fetching teams:', error);
    res.status(500).json({ error: 'Failed to fetch teams' });
  }
});

// Create team
router.post('/teams', 
  auth.rateLimit(5, '1d'),
  async (req: any, res) => {
    const { name, description, team_type, max_members, is_public } = req.body;

    try {
      // Generate unique join code
      const joinCode = generateJoinCode();

      // Create team
      const teamResult = await pool.query(
        `INSERT INTO teams (name, description, team_type, captain_id, max_members, is_public, join_code)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [name, description, team_type, req.customer.id, max_members || 20, is_public || false, joinCode]
      );

      const team = teamResult.rows[0];

      // Add creator as captain
      await pool.query(
        `INSERT INTO team_members (team_id, user_id, role, invite_accepted)
         VALUES ($1, $2, 'captain', true)`,
        [team.id, req.customer.id]
      );

      res.json({ success: true, team, join_code: joinCode });
    } catch (error) {
      console.error('Error creating team:', error);
      res.status(500).json({ error: 'Failed to create team' });
    }
  }
);

function generateJoinCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export default router;
```

### Step 4: React Native App Scaffold (Day 5-7)

```bash
# Initialize React Native app
npx create-expo-app ClubhouseCustomerApp --template

cd ClubhouseCustomerApp

# Install dependencies
npm install @react-navigation/native @react-navigation/stack @react-navigation/bottom-tabs
npm install react-native-screens react-native-safe-area-context
npm install @tanstack/react-query axios
npm install zustand mmkv
npm install react-native-gesture-handler react-native-reanimated
npm install expo-notifications expo-secure-store
npm install react-hook-form yup
```

```typescript
// File: ClubhouseCustomerApp/src/services/api.ts

import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://api.clubhouse.com';

class APIClient {
  private client = axios.create({
    baseURL: `${API_BASE_URL}/api/v2/customer`,
    timeout: 10000,
  });

  constructor() {
    // Request interceptor to add auth token
    this.client.interceptors.request.use(async (config) => {
      const token = await SecureStore.getItemAsync('auth_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 401) {
          // Token expired, try refresh
          await this.refreshToken();
        }
        return Promise.reject(error);
      }
    );
  }

  async refreshToken() {
    const refreshToken = await SecureStore.getItemAsync('refresh_token');
    if (!refreshToken) {
      // Redirect to login
      return;
    }

    try {
      const response = await this.client.post('/auth/refresh', { 
        refresh_token: refreshToken 
      });
      
      await SecureStore.setItemAsync('auth_token', response.data.access_token);
      await SecureStore.setItemAsync('refresh_token', response.data.refresh_token);
    } catch (error) {
      // Refresh failed, redirect to login
      await SecureStore.deleteItemAsync('auth_token');
      await SecureStore.deleteItemAsync('refresh_token');
    }
  }

  // Auth methods
  async register(data: RegisterData) {
    const response = await this.client.post('/auth/register', data);
    return response.data;
  }

  async login(email: string, password: string) {
    const response = await this.client.post('/auth/login', { email, password });
    
    // Store tokens
    await SecureStore.setItemAsync('auth_token', response.data.access_token);
    await SecureStore.setItemAsync('refresh_token', response.data.refresh_token);
    
    return response.data;
  }

  // Profile methods
  async getProfile() {
    const response = await this.client.get('/profile');
    return response.data;
  }

  async updateProfile(data: Partial<Profile>) {
    const response = await this.client.put('/profile', data);
    return response.data;
  }

  // Social methods
  async getFriends() {
    const response = await this.client.get('/social/friends');
    return response.data;
  }

  async sendFriendRequest(email: string) {
    const response = await this.client.post('/social/friends/request', { 
      recipient_email: email 
    });
    return response.data;
  }

  // Booking methods
  async getBookings() {
    const response = await this.client.get('/bookings');
    return response.data;
  }

  async shareBooking(bookingId: string, shareType: 'friends' | 'team' | 'public') {
    const response = await this.client.post(`/bookings/${bookingId}/share`, { 
      share_type: shareType 
    });
    return response.data;
  }
}

export default new APIClient();
```

### Step 5: Push Notifications Setup (Day 8)

```typescript
// File: ClubhouseCustomerApp/src/services/notifications.ts

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import api from './api';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export class NotificationService {
  async registerForPushNotifications() {
    if (!Device.isDevice) {
      console.log('Must use physical device for Push Notifications');
      return;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      console.log('Failed to get push token for push notification!');
      return;
    }

    const token = (await Notifications.getExpoPushTokenAsync()).data;
    
    // Send token to backend
    await api.registerPushToken(token);

    if (Platform.OS === 'android') {
      Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    }

    return token;
  }

  async scheduleBookingReminder(booking: Booking) {
    const trigger = new Date(booking.start_time);
    trigger.setHours(trigger.getHours() - 1); // 1 hour before

    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Upcoming Tee Time',
        body: `Your tee time at ${booking.location} is in 1 hour`,
        data: { booking_id: booking.id },
      },
      trigger,
    });
  }

  listenForNotifications(callback: (notification: Notification) => void) {
    const subscription = Notifications.addNotificationReceivedListener(callback);
    return subscription;
  }

  listenForResponses(callback: (response: NotificationResponse) => void) {
    const subscription = Notifications.addNotificationResponseReceivedListener(callback);
    return subscription;
  }
}

export default new NotificationService();
```

## Testing Strategy

### Unit Tests
```typescript
// ClubOSV1-backend/src/__tests__/customer/auth.test.ts
describe('Customer Authentication', () => {
  test('should register new customer', async () => {
    const response = await request(app)
      .post('/api/v2/customer/auth/register')
      .send({
        email: 'test@example.com',
        password: 'Test123!',
        name: 'Test User'
      });
    
    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('access_token');
  });
});
```

### Integration Tests
```typescript
// Test friend system end-to-end
describe('Friend System Integration', () => {
  test('complete friend flow', async () => {
    // Create two users
    const user1 = await createTestUser();
    const user2 = await createTestUser();
    
    // Send friend request
    const requestResponse = await api
      .as(user1)
      .post('/social/friends/request', { 
        recipient_email: user2.email 
      });
    
    // Accept friend request
    const acceptResponse = await api
      .as(user2)
      .put(`/social/friends/request/${requestResponse.body.id}`, { 
        action: 'accept' 
      });
    
    // Verify friendship
    const friendsResponse = await api
      .as(user1)
      .get('/social/friends');
    
    expect(friendsResponse.body.friends).toContainEqual(
      expect.objectContaining({ id: user2.id })
    );
  });
});
```

## Deployment Configuration

### Environment Variables
```bash
# .env.customer
NODE_ENV=production
DATABASE_URL=postgresql://user:pass@host/db
JWT_SECRET=your-secret
REFRESH_TOKEN_SECRET=your-refresh-secret

# External services
HUBSPOT_API_KEY=xxx
SKEDDA_API_KEY=xxx
TRACKMAN_CLIENT_ID=xxx
TRACKMAN_CLIENT_SECRET=xxx

# Push notifications
FCM_SERVER_KEY=xxx
APNS_KEY_ID=xxx
APNS_TEAM_ID=xxx

# App configuration
MAX_FRIENDS_PER_USER=500
MAX_TEAM_SIZE=50
BOOKING_SHARE_EXPIRY_HOURS=24
```

### Docker Deployment
```dockerfile
# Dockerfile.customer
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --only=production

# Copy source
COPY . .

# Build
RUN npm run build

# Security
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001
USER nodejs

EXPOSE 3002

CMD ["node", "dist/index.js"]
```

## Security Checklist

- [ ] OAuth2 implementation with refresh tokens
- [ ] Rate limiting on all customer endpoints
- [ ] Input validation with Joi/Yup
- [ ] SQL injection prevention (parameterized queries)
- [ ] XSS protection (sanitize user input)
- [ ] CSRF tokens for state-changing operations
- [ ] Secure password hashing (bcrypt with salt rounds >= 12)
- [ ] HTTPS only in production
- [ ] Security headers (Helmet.js)
- [ ] API versioning for backwards compatibility
- [ ] Audit logging for sensitive operations
- [ ] GDPR compliance (data export/deletion)
- [ ] App certificate pinning for mobile
- [ ] Obfuscation for React Native bundle

## Performance Optimization

### Backend
- Redis caching for frequently accessed data
- Database connection pooling
- Query optimization with proper indexes
- CDN for static assets
- Compression (gzip/brotli)

### Mobile App
- Image lazy loading and caching
- Offline support with MMKV
- Bundle splitting
- Hermes JavaScript engine
- ProGuard/R8 for Android

## Monitoring & Analytics

### Application Monitoring
- Sentry for error tracking
- New Relic/DataDog for APM
- Custom metrics with Prometheus

### Mobile Analytics
- Firebase Analytics
- Crashlytics
- Performance monitoring
- User behavior tracking

## Ready for Implementation

This guide provides a complete foundation for building the customer app within the existing ClubOS infrastructure. The unified approach ensures:

1. **Code reuse** - Leverage existing services
2. **Consistent data** - Single source of truth
3. **Rapid development** - Build on refactored foundation
4. **Easy maintenance** - One codebase to manage
5. **Scalability** - Proven architecture patterns

Next steps:
1. Create feature branch: `git checkout -b feature/customer-app`
2. Run database migration
3. Implement auth middleware
4. Build API routes
5. Create React Native app
6. Deploy to staging

The modular approach allows parallel development - backend team can build APIs while mobile team creates the app interface.