# Quick Implementation: Enhanced Logging for ClubOS

## Priority 1: Enhance Current Logging (Can implement today)

### 1. Update Logger Utility
```typescript
// backend/src/utils/logger.ts - Enhanced version
import winston from 'winston';
import { v4 as uuidv4 } from 'uuid';

const logFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    return JSON.stringify({
      timestamp,
      level,
      message,
      correlationId: meta.correlationId || 'system',
      userId: meta.userId,
      action: meta.action,
      duration: meta.duration,
      metadata: meta,
    });
  })
);

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
    new winston.transports.File({ 
      filename: 'logs/error.log', 
      level: 'error',
      maxsize: 10485760, // 10MB
      maxFiles: 5
    }),
    new winston.transports.File({ 
      filename: 'logs/combined.log',
      maxsize: 10485760, // 10MB
      maxFiles: 10
    }),
  ],
});

// Performance timer helper
export function startTimer() {
  const start = Date.now();
  return {
    done: (meta: any) => {
      const duration = Date.now() - start;
      logger.info('Operation completed', { ...meta, duration });
      return duration;
    }
  };
}

// Correlation ID middleware
export function correlationMiddleware(req: any, res: any, next: any) {
  req.correlationId = req.headers['x-correlation-id'] || uuidv4();
  res.setHeader('x-correlation-id', req.correlationId);
  next();
}
```

### 2. Add Audit Logging Table
```sql
-- backend/src/database/migrations/009_audit_logging.sql
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  correlation_id VARCHAR(255),
  user_id UUID,
  user_email VARCHAR(255),
  user_role VARCHAR(50),
  action_type VARCHAR(100) NOT NULL,
  resource_type VARCHAR(100),
  resource_id VARCHAR(255),
  ip_address INET,
  user_agent TEXT,
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  metadata JSONB,
  duration_ms INTEGER
);

-- Indexes for performance
CREATE INDEX idx_audit_timestamp ON audit_log(timestamp DESC);
CREATE INDEX idx_audit_user ON audit_log(user_id);
CREATE INDEX idx_audit_action ON audit_log(action_type);
CREATE INDEX idx_audit_correlation ON audit_log(correlation_id);

-- Audit log for sensitive operations
CREATE OR REPLACE FUNCTION log_audit_event(
  p_user_id UUID,
  p_user_email VARCHAR,
  p_user_role VARCHAR,
  p_action VARCHAR,
  p_resource_type VARCHAR,
  p_resource_id VARCHAR,
  p_success BOOLEAN,
  p_metadata JSONB
) RETURNS UUID AS $$
DECLARE
  v_audit_id UUID;
BEGIN
  INSERT INTO audit_log (
    user_id, user_email, user_role, action_type, 
    resource_type, resource_id, success, metadata
  ) VALUES (
    p_user_id, p_user_email, p_user_role, p_action,
    p_resource_type, p_resource_id, p_success, p_metadata
  ) RETURNING id INTO v_audit_id;
  
  RETURN v_audit_id;
END;
$$ LANGUAGE plpgsql;
```

### 3. Enhanced Remote Actions Logging
```typescript
// Add to backend/src/routes/remoteActions.ts
import { logger, startTimer } from '../utils/logger';
import { logAuditEvent } from '../services/auditService';

// In the execute endpoint
router.post('/execute', requireAuth, requireRole('operator'), async (req, res) => {
  const timer = startTimer();
  const correlationId = req.correlationId;
  
  try {
    const { action, location, bayNumber } = req.body;
    
    // Log the attempt
    logger.info('Remote action initiated', {
      correlationId,
      userId: req.user.id,
      userEmail: req.user.email,
      action,
      location,
      bayNumber,
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });
    
    // ... existing code ...
    
    // Audit log for compliance
    await logAuditEvent({
      userId: req.user.id,
      userEmail: req.user.email,
      userRole: req.user.role,
      action: 'remote_action_execute',
      resourceType: 'ninjaone_device',
      resourceId: device.deviceId,
      success: true,
      metadata: {
        action,
        location,
        bayNumber,
        deviceName,
        jobId: result.jobId
      }
    });
    
    const duration = timer.done({
      message: 'Remote action completed',
      action,
      success: true
    });
    
    res.json({ ...result, processingTime: duration });
    
  } catch (error) {
    logger.error('Remote action failed', {
      correlationId,
      error: error.message,
      stack: error.stack,
      userId: req.user.id,
      action: req.body.action
    });
    
    // Audit log the failure
    await logAuditEvent({
      userId: req.user.id,
      userEmail: req.user.email,
      userRole: req.user.role,
      action: 'remote_action_execute',
      resourceType: 'ninjaone_device',
      resourceId: req.body.deviceId,
      success: false,
      metadata: {
        error: error.message,
        action: req.body.action
      }
    });
    
    res.status(500).json({ error: error.message });
  }
});
```

### 4. Daily Operations Report
```typescript
// backend/src/services/reportingService.ts
export async function generateDailyOperationsReport() {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  
  const report = await pool.query(`
    WITH daily_metrics AS (
      SELECT 
        -- Request metrics
        COUNT(DISTINCT l.id) as total_requests,
        COUNT(DISTINCT l.id) FILTER (WHERE l.success = true) as successful_requests,
        AVG(l.processing_time_ms) as avg_response_time,
        
        -- Route distribution
        COUNT(*) FILTER (WHERE l.route = 'Emergency') as emergency_count,
        COUNT(*) FILTER (WHERE l.route = 'Tech Support') as tech_support_count,
        COUNT(*) FILTER (WHERE l.route = 'Booking & Access') as booking_count,
        COUNT(*) FILTER (WHERE l.route = 'Brand Tone') as brand_tone_count,
        
        -- Ticket metrics
        COUNT(DISTINCT t.id) as tickets_created,
        COUNT(DISTINCT t.id) FILTER (WHERE t.status = 'resolved') as tickets_resolved,
        
        -- Remote actions
        COUNT(DISTINCT ra.id) as remote_actions_executed,
        COUNT(DISTINCT ra.id) FILTER (WHERE ra.status = 'completed') as remote_actions_success
        
      FROM llm_request_log l
      LEFT JOIN tickets t ON DATE(t.created_at) = DATE($1)
      LEFT JOIN remote_actions_log ra ON DATE(ra.created_at) = DATE($1)
      WHERE DATE(l.created_at) = DATE($1)
    ),
    top_issues AS (
      SELECT 
        category,
        COUNT(*) as count
      FROM tickets
      WHERE DATE(created_at) = DATE($1)
      GROUP BY category
      ORDER BY count DESC
      LIMIT 5
    ),
    user_activity AS (
      SELECT 
        u.email,
        COUNT(DISTINCT al.id) as actions_count
      FROM users u
      JOIN audit_log al ON al.user_id = u.id
      WHERE DATE(al.timestamp) = DATE($1)
      GROUP BY u.email
      ORDER BY actions_count DESC
      LIMIT 10
    )
    SELECT 
      json_build_object(
        'date', $1::date,
        'metrics', row_to_json(daily_metrics.*),
        'top_issues', json_agg(DISTINCT top_issues.*),
        'top_users', json_agg(DISTINCT user_activity.*),
        'system_health', json_build_object(
          'error_count', (SELECT COUNT(*) FROM system_events WHERE level = 'error' AND DATE(created_at) = DATE($1)),
          'avg_api_latency', (SELECT AVG(duration_ms) FROM audit_log WHERE DATE(timestamp) = DATE($1))
        )
      ) as report
    FROM daily_metrics, top_issues, user_activity
    GROUP BY daily_metrics.*;
  `, [yesterday]);
  
  return report.rows[0].report;
}

// Send daily report
export async function sendDailyReport() {
  const report = await generateDailyOperationsReport();
  
  // Format for Slack
  const slackMessage = {
    text: `📊 Daily Operations Report - ${report.date}`,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Request Summary*\n` +
                `• Total Requests: ${report.metrics.total_requests}\n` +
                `• Success Rate: ${(report.metrics.successful_requests / report.metrics.total_requests * 100).toFixed(1)}%\n` +
                `• Avg Response Time: ${report.metrics.avg_response_time}ms`
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Ticket Activity*\n` +
                `• Created: ${report.metrics.tickets_created}\n` +
                `• Resolved: ${report.metrics.tickets_resolved}\n` +
                `• Top Issues: ${report.top_issues.map(i => `${i.category} (${i.count})`).join(', ')}`
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Remote Actions*\n` +
                `• Executed: ${report.metrics.remote_actions_executed}\n` +
                `• Success Rate: ${(report.metrics.remote_actions_success / report.metrics.remote_actions_executed * 100).toFixed(1)}%`
        }
      }
    ]
  };
  
  await sendSlackNotification(JSON.stringify(slackMessage), '#daily-reports');
  
  // Also log to database for historical tracking
  await pool.query(
    'INSERT INTO daily_reports (report_date, report_data) VALUES ($1, $2)',
    [report.date, report]
  );
}

// Schedule daily report (add to backend startup)
import cron from 'node-cron';
cron.schedule('0 9 * * *', sendDailyReport); // 9 AM daily
```

### 5. Real-time Metrics Endpoint
```typescript
// backend/src/routes/analytics.ts
router.get('/metrics/realtime', requireAuth, requireRole('operator'), async (req, res) => {
  const metrics = await pool.query(`
    SELECT 
      -- Current hour metrics
      COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '1 hour') as requests_last_hour,
      COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '5 minutes') as requests_last_5min,
      AVG(processing_time_ms) FILTER (WHERE created_at > NOW() - INTERVAL '1 hour') as avg_response_time,
      
      -- Active issues
      COUNT(*) FILTER (WHERE status IN ('open', 'in_progress')) as active_tickets,
      COUNT(*) FILTER (WHERE priority = 'urgent' AND status = 'open') as urgent_tickets,
      
      -- System status
      (SELECT COUNT(*) FROM system_events WHERE level = 'error' AND created_at > NOW() - INTERVAL '1 hour') as errors_last_hour,
      
      -- Current load by location
      json_object_agg(
        location, 
        location_count
      ) as requests_by_location
    FROM (
      SELECT location, COUNT(*) as location_count 
      FROM llm_request_log 
      WHERE created_at > NOW() - INTERVAL '1 hour'
      GROUP BY location
    ) as location_data
  `);
  
  res.json({
    timestamp: new Date(),
    metrics: metrics.rows[0],
    status: metrics.rows[0].errors_last_hour > 10 ? 'degraded' : 'healthy'
  });
});
```

## Priority 2: Quick Monitoring Setup (This week)

### 1. Error Alerting
```typescript
// backend/src/services/alertingService.ts
class AlertingService {
  private errorCounts = new Map<string, number>();
  
  async checkAndAlert(error: Error, context: any) {
    const key = `${error.name}-${error.message}`;
    const count = (this.errorCounts.get(key) || 0) + 1;
    this.errorCounts.set(key, count);
    
    // Alert on repeated errors
    if (count === 5) {
      await sendSlackNotification(
        `🚨 Repeated Error Alert\n` +
        `Error: ${error.message}\n` +
        `Count: ${count} times in last 5 minutes\n` +
        `Context: ${JSON.stringify(context)}`,
        '#tech-alerts'
      );
    }
    
    // Reset counts every 5 minutes
    setTimeout(() => this.errorCounts.delete(key), 5 * 60 * 1000);
  }
}
```

### 2. Simple Dashboard Page
```typescript
// frontend/src/pages/analytics.tsx
export default function AnalyticsDashboard() {
  const [metrics, setMetrics] = useState(null);
  
  useEffect(() => {
    // Poll for real-time metrics
    const interval = setInterval(async () => {
      const response = await api.get('/analytics/metrics/realtime');
      setMetrics(response.data);
    }, 5000); // Update every 5 seconds
    
    return () => clearInterval(interval);
  }, []);
  
  return (
    <div className="grid grid-cols-3 gap-6 p-6">
      <MetricCard 
        title="Requests (Last Hour)"
        value={metrics?.metrics.requests_last_hour}
        trend={calculateTrend(metrics)}
      />
      <MetricCard 
        title="Avg Response Time"
        value={`${metrics?.metrics.avg_response_time}ms`}
        status={metrics?.metrics.avg_response_time > 2000 ? 'warning' : 'good'}
      />
      <MetricCard 
        title="Active Tickets"
        value={metrics?.metrics.active_tickets}
        urgent={metrics?.metrics.urgent_tickets}
      />
    </div>
  );
}
```

## Immediate Action Items

1. **Today**: 
   - Update logger utility with correlation IDs
   - Add audit logging to critical operations
   - Deploy audit log migration

2. **This Week**:
   - Implement daily report generation
   - Add real-time metrics endpoint
   - Create basic analytics dashboard

3. **Next Week**:
   - Set up error alerting
   - Add performance monitoring
   - Create management reports

This gives you industry-standard logging without overwhelming complexity!