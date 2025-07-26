#!/bin/bash
echo "🔧 Complete PostgreSQL Fix - Addressing All Issues"
echo "==============================================="

cd /Users/michaelbelairch1/Desktop/Clubhouse\ OS\ \(Root\)/CLUBOSV1/ClubOSV1-backend

# Fix 1: Add missing database methods
echo "Adding missing database methods..."
cat >> src/utils/database.ts << 'EOF'

  // Direct query access
  async query(text: string, params?: any[]): Promise<any> {
    return await query(text, params);
  }

  // Request logging
  async logRequest(log: {
    method: string;
    path: string;
    status_code?: number;
    response_time?: number;
    user_id?: string;
    ip_address?: string;
    user_agent?: string;
    error?: string | null;
  }): Promise<void> {
    try {
      await query(
        `INSERT INTO request_logs 
         (method, path, status_code, response_time, user_id, ip_address, user_agent, error)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [log.method, log.path, log.status_code, log.response_time, 
         log.user_id, log.ip_address, log.user_agent, log.error]
      );
    } catch (error) {
      logger.error('Failed to log request:', error);
    }
  }

  // Get access logs with filters
  async getAccessLogs(filters?: {
    user_id?: string;
    action?: string;
    success?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<any[]> {
    let queryText = 'SELECT * FROM access_logs WHERE 1=1';
    const params: any[] = [];
    let paramCount = 0;

    if (filters?.user_id) {
      queryText += ` AND user_id = $${++paramCount}`;
      params.push(filters.user_id);
    }
    if (filters?.action) {
      queryText += ` AND action = $${++paramCount}`;
      params.push(filters.action);
    }
    if (filters?.success !== undefined) {
      queryText += ` AND success = $${++paramCount}`;
      params.push(filters.success);
    }

    queryText += ' ORDER BY created_at DESC';
    
    if (filters?.limit) {
      queryText += ` LIMIT $${++paramCount}`;
      params.push(filters.limit);
    }
    if (filters?.offset) {
      queryText += ` OFFSET $${++paramCount}`;
      params.push(filters.offset);
    }

    const result = await query(queryText, params);
    return result.rows;
  }

  // Get auth logs with filters
  async getAuthLogs(filters?: {
    user_id?: string;
    action?: string;
    success?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<any[]> {
    let queryText = 'SELECT * FROM auth_logs WHERE 1=1';
    const params: any[] = [];
    let paramCount = 0;

    if (filters?.user_id) {
      queryText += ` AND user_id = $${++paramCount}`;
      params.push(filters.user_id);
    }
    if (filters?.action) {
      queryText += ` AND action = $${++paramCount}`;
      params.push(filters.action);
    }
    if (filters?.success !== undefined) {
      queryText += ` AND success = $${++paramCount}`;
      params.push(filters.success);
    }

    queryText += ' ORDER BY created_at DESC';
    
    if (filters?.limit) {
      queryText += ` LIMIT $${++paramCount}`;
      params.push(filters.limit);
    }
    if (filters?.offset) {
      queryText += ` OFFSET $${++paramCount}`;
      params.push(filters.offset);
    }

    const result = await query(queryText, params);
    return result.rows;
  }

  // Get request logs with filters
  async getRequestLogs(filters?: {
    path?: string;
    status_code?: number;
    limit?: number;
    offset?: number;
  }): Promise<any[]> {
    let queryText = 'SELECT * FROM request_logs WHERE 1=1';
    const params: any[] = [];
    let paramCount = 0;

    if (filters?.path) {
      queryText += ` AND path LIKE $${++paramCount}`;
      params.push(`%${filters.path}%`);
    }
    if (filters?.status_code) {
      queryText += ` AND status_code = $${++paramCount}`;
      params.push(filters.status_code);
    }

    queryText += ' ORDER BY created_at DESC';
    
    if (filters?.limit) {
      queryText += ` LIMIT $${++paramCount}`;
      params.push(filters.limit);
    }
    if (filters?.offset) {
      queryText += ` OFFSET $${++paramCount}`;
      params.push(filters.offset);
    }

    const result = await query(queryText, params);
    return result.rows;
  }

  // Cancel booking
  async cancelBooking(id: string): Promise<boolean> {
    try {
      const result = await query(
        `UPDATE bookings 
         SET status = 'cancelled', 
             cancelled_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [id]
      );
      return result.rowCount > 0;
    } catch (error) {
      logger.error('Failed to cancel booking:', error);
      return false;
    }
  }

  // Log access
  async logAccess(log: {
    user_id?: string;
    user_email?: string;
    action: string;
    resource?: string;
    ip_address?: string;
    user_agent?: string;
    success?: boolean;
    error_message?: string;
    metadata?: any;
  }): Promise<void> {
    try {
      await query(
        `INSERT INTO access_logs 
         (user_id, user_email, action, resource, ip_address, user_agent, success, error_message, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [log.user_id, log.user_email, log.action, log.resource, 
         log.ip_address, log.user_agent, log.success ?? true, 
         log.error_message, log.metadata || {}]
      );
    } catch (error) {
      logger.error('Failed to log access:', error);
    }
  }

  // Log auth event
  async logAuth(log: {
    user_id?: string;
    action: string;
    ip_address?: string;
    user_agent?: string;
    success?: boolean;
    error_message?: string;
  }): Promise<void> {
    try {
      await query(
        `INSERT INTO auth_logs 
         (user_id, action, ip_address, user_agent, success, error_message)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [log.user_id, log.action, log.ip_address, 
         log.user_agent, log.success ?? true, log.error_message]
      );
    } catch (error) {
      logger.error('Failed to log auth event:', error);
    }
  }
EOF

# Fix 2: Update getBookings to support status filter
echo "Fixing getBookings method..."
sed -i '' 's/async getBookings(filters?: {/async getBookings(filters?: { status?: string;/' src/utils/database.ts
sed -i '' '/AND start_time/a\
    if (filters?.status) {\
      queryStr += ` AND status = $${++paramCount}`;\
      params.push(filters.status);\
    }' src/utils/database.ts

# Fix 3: Fix requestLogger to use PostgreSQL
echo "Fixing requestLogger..."
cat > src/middleware/requestLogger-postgres.ts << 'EOF'
import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { db } from '../utils/database';

export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  const originalSend = res.send;
  const originalJson = res.json;
  let responseBody: any;

  // Capture response body
  res.send = function(data: any): Response {
    responseBody = data;
    res.send = originalSend;
    return originalSend.call(this, data);
  };

  res.json = function(data: any): Response {
    responseBody = data;
    res.json = originalJson;
    return originalJson.call(this, data);
  };

  // Log when response finishes
  res.on('finish', async () => {
    const duration = Date.now() - start;
    const user = (req as any).user;
    
    logger.info(`${req.method} ${req.path} ${res.statusCode} ${duration}ms`, {
      method: req.method,
      path: req.path,
      query: req.query,
      statusCode: res.statusCode,
      duration,
      userId: user?.id,
      userEmail: user?.email,
      ip: req.ip,
      userAgent: req.get('user-agent')
    });

    // Log to database asynchronously
    if (req.path !== '/health' && !req.path.startsWith('/api/access')) {
      db.logRequest({
        method: req.method,
        path: req.path,
        status_code: res.statusCode,
        response_time: duration,
        user_id: user?.id,
        ip_address: req.ip || 'unknown',
        user_agent: req.get('user-agent') || 'unknown',
        error: res.statusCode >= 400 ? responseBody?.message || 'Error' : null
      }).catch(err => {
        logger.error('Failed to log request to database:', err);
      });
    }
  });

  next();
};
EOF

mv src/middleware/requestLogger-postgres.ts src/middleware/requestLogger.ts

# Fix 4: Remove problematic JSON file
echo "Removing problematic JSON file..."
rm -f src/data/sync/logs/requests.json

# Fix 5: Create comprehensive build script
echo "Creating comprehensive build and deploy script..."
cat > ../deploy-postgresql-fix.sh << 'EOF'
#!/bin/bash
echo "🚀 Deploying PostgreSQL fixes"
echo "============================"

cd /Users/michaelbelairch1/Desktop/Clubhouse\ OS\ \(Root\)/CLUBOSV1/ClubOSV1-backend

# Build the project
echo "Building project..."
npm run build

# Go back to root and commit
cd ..
git add -A
git commit -m "Complete PostgreSQL implementation fix

- Added all missing database methods (query, log methods, etc.)
- Fixed requestLogger to use PostgreSQL
- Added cancelBooking method
- Added access/auth/request log retrieval methods
- Fixed getBookings to support status filter
- Removed problematic JSON file"

git push origin main

echo "✅ PostgreSQL fixes deployed!"
echo "Monitor Railway for deployment status."
EOF

chmod +x ../deploy-postgresql-fix.sh

echo "✅ PostgreSQL fix script created!"
echo ""
echo "Run the following command to deploy the fixes:"
echo "cd .. && ./deploy-postgresql-fix.sh"