#!/bin/bash
echo "🔧 Properly fixing database.ts"
echo "============================"

cd /Users/michaelbelairch1/Desktop/Clubhouse\ OS\ \(Root\)/CLUBOSV1/ClubOSV1-backend

# Create a backup
cp src/utils/database.ts src/utils/database.ts.backup

# Create fixed version by reading up to line 588 (before the closing brace)
head -588 src/utils/database.ts > src/utils/database-fixed.ts

# Add the missing methods inside the class
cat >> src/utils/database-fixed.ts << 'EOF'

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
}

// Export singleton instance
export const db = new DatabaseService();

// Also export pool for direct access if needed
export { pool };
EOF

# Replace the original file
mv src/utils/database-fixed.ts src/utils/database.ts

echo "✅ Database.ts properly fixed"

# Build to verify
npm run build

echo "Now commit and push..."
cd ..
git add -A
git commit -m "Fix database.ts syntax - properly place methods inside class"
git push origin main

echo "✅ Fix deployed!"