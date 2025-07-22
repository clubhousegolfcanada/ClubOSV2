# API Usage Tracking Documentation

## Overview
The API Usage Tracking system monitors and logs all API requests, providing detailed analytics, rate limiting, and usage reports per user or API key.

## Features

### 1. Automatic Request Tracking
- **Request Details**: Method, endpoint, status code
- **Performance Metrics**: Response time, request/response size
- **User Attribution**: Track by user ID or API key
- **Metadata**: IP address, user agent, query parameters

### 2. Rate Limiting
- **Flexible Limits**: Per user, per API key, or global
- **Multiple Windows**: Hourly, daily, monthly limits
- **Endpoint-Specific**: Different limits for different endpoints
- **Headers**: X-RateLimit-* headers in responses

### 3. Usage Analytics
- **Real-time Stats**: Current usage and remaining quota
- **Historical Data**: Hourly, daily, weekly, monthly reports
- **Top Users**: Identify highest usage patterns
- **Endpoint Analytics**: Performance by endpoint

### 4. Alerts & Monitoring
- **Error Rate Alerts**: Notify when error rate exceeds threshold
- **Latency Alerts**: Warn about slow endpoints
- **Usage Alerts**: Notify approaching rate limits
- **Bandwidth Monitoring**: Track data transfer

## Configuration

### Environment Variables
```bash
# Usage tracking retention
DATA_RETENTION_DAYS=90

# Rate limiting defaults
RATE_LIMIT_WINDOW_MS=900000  # 15 minutes
RATE_LIMIT_MAX=100           # requests per window
```

### Custom Rate Limits
```typescript
// In usageTracker configuration
rateLimits: {
  default: {
    requests: {
      perHour: 1000,
      perDay: 10000,
      perMonth: 100000
    },
    bandwidth: {
      perDay: 100 * 1024 * 1024 // 100MB
    }
  },
  perUser: {
    'power-user-id': {
      requests: {
        perHour: 5000,
        perDay: 50000
      }
    }
  },
  perApiKey: {
    'premium-key': {
      requests: {
        perHour: 10000
      }
    }
  }
}
```

## API Endpoints

### Get My Usage
```http
GET /api/usage/me?period=day
Authorization: Bearer <token>
```

Response:
```json
{
  "success": true,
  "usage": {
    "userId": "user123",
    "period": "day",
    "stats": {
      "totalRequests": 150,
      "successfulRequests": 145,
      "failedRequests": 5,
      "totalResponseTime": 45000,
      "endpoints": {
        "GET /api/bookings": {
          "count": 50,
          "averageResponseTime": 120,
          "errors": 0
        }
      }
    },
    "limits": {
      "requests": 10000,
      "bandwidth": 104857600
    },
    "usage": {
      "requests": 150,
      "bandwidth": 1548576
    }
  }
}
```

### Get User Usage (Admin)
```http
GET /api/usage/user/{userId}?period=week
Authorization: Bearer <admin-token>
```

### Get API Key Usage (Admin)
```http
GET /api/usage/key/{apiKey}?period=month
Authorization: Bearer <admin-token>
```

### Get Overall Statistics (Admin)
```http
GET /api/usage/overall?period=day
Authorization: Bearer <admin-token>
```

### Get Top Users (Admin)
```http
GET /api/usage/top-users?limit=10&period=day
Authorization: Bearer <admin-token>
```

### Get Endpoint Statistics (Admin)
```http
GET /api/usage/endpoints?period=day
Authorization: Bearer <admin-token>
```

### Check Rate Limit Status
```http
GET /api/usage/check-limit?endpoint=/api/llm/request
```

Response:
```json
{
  "success": true,
  "rateLimit": {
    "allowed": true,
    "limit": 1000,
    "remaining": 850,
    "resetAt": "2024-01-20T15:00:00.000Z"
  }
}
```

## Rate Limit Headers

All API responses include rate limit information:

```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 850
X-RateLimit-Reset: 2024-01-20T15:00:00.000Z
```

## Usage Examples

### Track Custom Metrics
```typescript
// In your route handler
await usageTracker.trackRequest({
  userId: req.user.id,
  endpoint: '/api/custom',
  method: 'POST',
  statusCode: 200,
  responseTime: Date.now() - startTime,
  requestSize: JSON.stringify(req.body).length,
  responseSize: JSON.stringify(responseData).length,
  ip: req.ip,
  metadata: {
    action: 'process_data',
    itemCount: responseData.length
  }
});
```

### Create Custom Rate Limiter
```typescript
import { createEndpointRateLimiter } from './middleware/usageTracking';

// Limit LLM requests to 10 per hour
router.post('/api/llm/request',
  createEndpointRateLimiter('/api/llm/request', 10, 60 * 60 * 1000),
  async (req, res) => {
    // Handle request
  }
);
```

### Monitor Usage Programmatically
```typescript
// Check user's current usage
const usage = await usageTracker.getUserUsage('user123', 'day');

if (usage.usage.requests > usage.limits.requests * 0.8) {
  // Send warning about approaching limit
  notifyUser('You are approaching your daily request limit');
}
```

## Best Practices

### 1. Set Appropriate Limits
- Start with conservative limits
- Monitor actual usage patterns
- Adjust based on user needs
- Different limits for different user tiers

### 2. Monitor Performance
- Set up alerts for high error rates
- Track endpoint latency
- Identify slow queries
- Optimize based on metrics

### 3. Handle Rate Limits Gracefully
- Return clear error messages
- Include retry-after headers
- Provide upgrade options
- Document limits clearly

### 4. Data Retention
- Balance storage vs analytics needs
- Aggregate old data before deletion
- Export important metrics
- Comply with privacy regulations

## Troubleshooting

### High Error Rates
1. Check endpoint logs for specific errors
2. Review recent deployments
3. Monitor dependent services
4. Check rate limit configuration

### Performance Issues
1. Review usage patterns
2. Check database queries
3. Optimize slow endpoints
4. Consider caching strategies

### Rate Limit Issues
1. Verify user/API key limits
2. Check time window configuration
3. Review endpoint-specific limits
4. Monitor for abuse patterns

## Security Considerations

### API Key Management
- Rotate keys regularly
- Monitor for leaked keys
- Implement key scoping
- Track key usage patterns

### Privacy
- Anonymize sensitive data
- Implement data retention policies
- Allow users to export their data
- Provide usage transparency

### Abuse Prevention
- Detect unusual patterns
- Implement progressive rate limiting
- Block malicious IPs
- Alert on suspicious activity
