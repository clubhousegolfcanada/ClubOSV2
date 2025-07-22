import { Router, Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import Joi from 'joi';
import { logger } from '../utils/logger';
import { readJsonFile, appendToJsonArray } from '../utils/fileUtils';
import { AccessRequest } from '../types';
import { AppError } from '../middleware/errorHandler';
import { authenticate } from '../middleware/auth';
import { roleGuard, adminOnly, anyAuthenticated } from '../middleware/roleGuard';

const router = Router();

// Validation schema for access requests
const accessSchema = Joi.object({
  userId: Joi.string().required(),
  accessType: Joi.string().valid('door', 'equipment', 'system').required(),
  location: Joi.string().required(),
  reason: Joi.string().optional()
});

// Get access logs - all authenticated users can read
router.get('/logs', authenticate, anyAuthenticated, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId, accessType, location, startDate, endDate } = req.query;
    let logs = await readJsonFile<any[]>('accessLogs.json');

    // Apply filters
    if (userId) {
      logs = logs.filter(log => log.userId === userId);
    }
    if (accessType) {
      logs = logs.filter(log => log.accessType === accessType);
    }
    if (location) {
      logs = logs.filter(log => log.location.toLowerCase().includes((location as string).toLowerCase()));
    }
    if (startDate) {
      const start = new Date(startDate as string);
      logs = logs.filter(log => new Date(log.timestamp) >= start);
    }
    if (endDate) {
      const end = new Date(endDate as string);
      logs = logs.filter(log => new Date(log.timestamp) <= end);
    }

    // Sort by timestamp descending
    logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    res.json({
      success: true,
      count: logs.length,
      data: logs
    });
  } catch (error) {
    next(error);
  }
});

// Unlock door - admin only
router.post('/unlock', authenticate, adminOnly, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { location, duration = 30 } = req.body;

    if (!location) {
      throw new AppError('VALIDATION_ERROR', 'Location is required', 400);
    }

    const unlockId = uuidv4();
    const unlockLog = {
      id: unlockId,
      type: 'manual_unlock',
      location,
      unlockedBy: req.user!.email,
      unlockedAt: new Date().toISOString(),
      duration: duration, // seconds
      expiresAt: new Date(Date.now() + duration * 1000).toISOString()
    };

    await appendToJsonArray('accessLogs.json', unlockLog);

    logger.info('Manual door unlock', {
      unlockId,
      location,
      unlockedBy: req.user!.email,
      duration
    });

    res.json({
      success: true,
      message: `Door at ${location} unlocked for ${duration} seconds`,
      data: unlockLog
    });
  } catch (error) {
    next(error);
  }
});

// Request access - all authenticated users
router.post('/request', authenticate, anyAuthenticated, async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Validate request body
    const { error, value } = accessSchema.validate(req.body);
    if (error) {
      throw new AppError('VALIDATION_ERROR', error.details[0].message, 400);
    }

    const accessRequest: AccessRequest = value;
    const requestId = uuidv4();

    // Create access log entry
    const accessLog = {
      id: requestId,
      ...accessRequest,
      status: 'granted', // In a real system, this would involve actual access control
      timestamp: new Date().toISOString(),
      grantedBy: 'system',
      expiresAt: new Date(Date.now() + 3600000).toISOString() // 1 hour from now
    };

    // Save access log
    await appendToJsonArray('accessLogs.json', accessLog);

    logger.info('Access granted', { 
      requestId, 
      userId: accessRequest.userId,
      accessType: accessRequest.accessType,
      location: accessRequest.location
    });

    res.status(201).json({
      success: true,
      data: {
        ...accessLog,
        accessCode: generateAccessCode(accessRequest.accessType)
      }
    });
  } catch (error) {
    next(error);
  }
});

// Revoke access - admin and operator only
router.post('/revoke/:id', authenticate, roleGuard(['admin', 'operator']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const logs = await readJsonFile<any[]>('accessLogs.json');
    const logIndex = logs.findIndex(log => log.id === req.params.id);

    if (logIndex === -1) {
      throw new AppError('ACCESS_LOG_NOT_FOUND', 'Access log not found', 404);
    }

    // Create revocation entry
    const revocationEntry = {
      id: uuidv4(),
      originalRequestId: req.params.id,
      userId: logs[logIndex].userId,
      accessType: logs[logIndex].accessType,
      location: logs[logIndex].location,
      status: 'revoked',
      timestamp: new Date().toISOString(),
      revokedBy: req.body.revokedBy || 'system',
      reason: req.body.reason || 'Manual revocation'
    };

    await appendToJsonArray('accessLogs.json', revocationEntry);

    logger.info('Access revoked', { 
      requestId: req.params.id,
      userId: logs[logIndex].userId
    });

    res.json({
      success: true,
      message: 'Access revoked successfully',
      data: revocationEntry
    });
  } catch (error) {
    next(error);
  }
});

// Check access status - all authenticated users
router.get('/check/:userId', authenticate, anyAuthenticated, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { location, accessType } = req.query;
    const logs = await readJsonFile<any[]>('accessLogs.json');
    
    // Find the most recent access for this user
    const userLogs = logs
      .filter(log => {
        const matches = log.userId === req.params.userId;
        const locationMatch = !location || log.location === location;
        const typeMatch = !accessType || log.accessType === accessType;
        return matches && locationMatch && typeMatch;
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    if (userLogs.length === 0) {
      res.json({
        success: true,
        hasAccess: false,
        message: 'No access records found'
      });
      return;
    }

    const latestLog = userLogs[0];
    const hasValidAccess = 
      latestLog.status === 'granted' &&
      new Date(latestLog.expiresAt) > new Date();

    res.json({
      success: true,
      hasAccess: hasValidAccess,
      data: hasValidAccess ? latestLog : null
    });
  } catch (error) {
    next(error);
  }
});

// Generate temporary access codes based on type
function generateAccessCode(accessType: string): string {
  const prefix = {
    door: 'DR',
    equipment: 'EQ',
    system: 'SY'
  }[accessType] || 'AC';

  const random = Math.floor(Math.random() * 999999).toString().padStart(6, '0');
  return `${prefix}-${random}`;
}

export default router;
