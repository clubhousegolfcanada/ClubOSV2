import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { logger } from '../utils/logger';
import { db } from '../utils/database';

const router = Router();

// GET /api/access/logs - Get access logs (admin only)
router.get('/logs', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const { userId, action, success, limit = 100, offset = 0 } = req.query;
    
    const logs = await db.getAccessLogs({
      user_id: userId as string,
      action: action as string,
      success: success === 'true' ? true : success === 'false' ? false : undefined,
      limit: Number(limit),
      offset: Number(offset)
    });
    
    res.json({
      success: true,
      data: logs.map(log => ({
        id: log.id,
        userId: log.user_id,
        userEmail: log.user_email,
        action: log.action,
        resource: log.resource,
        ipAddress: log.ip_address,
        userAgent: log.user_agent,
        success: log.success,
        errorMessage: log.error_message,
        metadata: log.metadata,
        createdAt: log.created_at.toISOString()
      })),
      pagination: {
        limit: Number(limit),
        offset: Number(offset)
      }
    });
  } catch (error) {
    logger.error('Failed to get access logs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve access logs'
    });
  }
});

// GET /api/access/auth-logs - Get authentication logs (admin only)
router.get('/auth-logs', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const { userId, action, success, limit = 100, offset = 0 } = req.query;
    
    const logs = await db.getAuthLogs({
      user_id: userId as string,
      action: action as string,
      success: success === 'true' ? true : success === 'false' ? false : undefined,
      limit: Number(limit),
      offset: Number(offset)
    });
    
    res.json({
      success: true,
      data: logs.map(log => ({
        id: log.id,
        userId: log.user_id,
        action: log.action,
        ipAddress: log.ip_address,
        userAgent: log.user_agent,
        success: log.success,
        errorMessage: log.error_message,
        createdAt: log.created_at.toISOString()
      })),
      pagination: {
        limit: Number(limit),
        offset: Number(offset)
      }
    });
  } catch (error) {
    logger.error('Failed to get auth logs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve authentication logs'
    });
  }
});

// GET /api/access/request-logs - Get request logs (admin only)
router.get('/request-logs', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const { path, statusCode, limit = 100, offset = 0 } = req.query;
    
    const logs = await db.getRequestLogs({
      path: path as string,
      status_code: statusCode ? Number(statusCode) : undefined,
      limit: Number(limit),
      offset: Number(offset)
    });
    
    res.json({
      success: true,
      data: logs.map(log => ({
        id: log.id,
        method: log.method,
        path: log.path,
        statusCode: log.status_code,
        responseTime: log.response_time,
        userId: log.user_id,
        ipAddress: log.ip_address,
        userAgent: log.user_agent,
        error: log.error,
        createdAt: log.created_at.toISOString()
      })),
      pagination: {
        limit: Number(limit),
        offset: Number(offset)
      }
    });
  } catch (error) {
    logger.error('Failed to get request logs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve request logs'
    });
  }
});

export default router;
