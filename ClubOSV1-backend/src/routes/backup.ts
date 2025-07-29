import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { logger } from '../utils/logger';
import { db } from '../utils/database';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

const router = Router();
const execAsync = promisify(exec);

// GET /api/backup/export - Export database backup (admin only)
router.get('/export', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    const filename = `clubos_backup_${timestamp}.sql`;
    
    // Get database connection details
    const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
    if (!dbUrl) {
      throw new Error('Database URL not configured');
    }
    
    // Create temporary file path
    const tempPath = path.join('/tmp', filename);
    
    // Use pg_dump to export database
    try {
      await execAsync(`pg_dump "${dbUrl}" > "${tempPath}"`);
    } catch (error) {
      logger.error('pg_dump failed:', error);
      
      // Fallback: Export as JSON
      const backup = {
        timestamp: new Date().toISOString(),
        version: '1.0',
        tables: {} as any
      };
      
      // Export all tables
      const tables = [
        'Users', 'feedback', 'tickets', 'bookings', 
        'access_logs', 'auth_logs', 'request_logs', 
        'system_config', 'customer_interactions'
      ];
      
      for (const table of tables) {
        try {
          // Use parameterized query with identifier to prevent SQL injection
          const result = await db.query(`SELECT * FROM "${table.replace(/"/g, '""')}"`);;
          backup.tables[table] = result.rows;
        } catch (err) {
          logger.error(`Failed to export table ${table}:`, err);
        }
      }
      
      // Send as JSON
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="clubos_backup_${timestamp}.json"`);
      return res.send(JSON.stringify(backup, null, 2));
    }
    
    // Read the backup file
    const backupData = await fs.readFile(tempPath, 'utf-8');
    
    // Clean up temp file
    await fs.unlink(tempPath).catch(() => {});
    
    // Send backup
    res.setHeader('Content-Type', 'application/sql');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(backupData);
    
    logger.info('Database backup exported', {
      exportedBy: req.user!.email,
      filename
    });
  } catch (error) {
    logger.error('Failed to export backup:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export database backup'
    });
  }
});

// GET /api/backup/stats - Get database statistics (admin only)
router.get('/stats', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const stats = {
      tables: {} as any,
      totalSize: 0,
      databaseSize: null as any
    };
    
    // Get row counts for each table
    const tables = [
      { name: 'Users', displayName: 'Users' },
      { name: 'feedback', displayName: 'Feedback' },
      { name: 'tickets', displayName: 'Tickets' },
      { name: 'bookings', displayName: 'Bookings' },
      { name: 'access_logs', displayName: 'Access Logs' },
      { name: 'auth_logs', displayName: 'Auth Logs' },
      { name: 'request_logs', displayName: 'Request Logs' },
      { name: 'system_config', displayName: 'System Config' },
      { name: 'customer_interactions', displayName: 'Customer Interactions' }
    ];
    
    for (const table of tables) {
      try {
        const result = await db.query(`SELECT COUNT(*) as count FROM "${table.name.replace(/"/g, '""')}"`);;
        stats.tables[table.displayName] = {
          count: parseInt(result.rows[0].count),
          tableName: table.name
        };
        stats.totalSize += parseInt(result.rows[0].count);
      } catch (err) {
        logger.error(`Failed to get count for table ${table.name}:`, err);
        stats.tables[table.displayName] = {
          count: 0,
          error: 'Failed to retrieve count'
        };
      }
    }
    
    // Get database size if possible
    try {
      const sizeResult = await db.query(`
        SELECT pg_database_size(current_database()) as size
      `);
      stats.databaseSize = {
        bytes: parseInt(sizeResult.rows[0].size),
        formatted: formatBytes(parseInt(sizeResult.rows[0].size))
      };
    } catch (err) {
      logger.error('Failed to get database size:', err);
    }
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error('Failed to get backup stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve backup statistics'
    });
  }
});

// Helper function to format bytes
function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export default router;
