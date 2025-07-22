import { Router, Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { readJsonFile } from '../utils/fileUtils';
import { HistoryEntry, ProcessedRequest } from '../types';
import { AppError } from '../middleware/errorHandler';

const router = Router();

// Get request history
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { 
      startDate, 
      endDate, 
      status, 
      botRoute, 
      userId, 
      sessionId,
      limit = '100',
      offset = '0' 
    } = req.query;

    // Load all user logs
    const logs = await readJsonFile<ProcessedRequest[]>('userLogs.json');

    // Apply filters
    let filteredLogs = logs;

    if (startDate) {
      const start = new Date(startDate as string);
      filteredLogs = filteredLogs.filter(log => new Date(log.timestamp) >= start);
    }

    if (endDate) {
      const end = new Date(endDate as string);
      filteredLogs = filteredLogs.filter(log => new Date(log.timestamp) <= end);
    }

    if (status) {
      filteredLogs = filteredLogs.filter(log => log.status === status);
    }

    if (botRoute) {
      filteredLogs = filteredLogs.filter(log => log.botRoute === botRoute);
    }

    if (userId) {
      filteredLogs = filteredLogs.filter(log => log.userId === userId);
    }

    if (sessionId) {
      filteredLogs = filteredLogs.filter(log => log.sessionId === sessionId);
    }

    // Sort by timestamp descending
    filteredLogs.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    // Apply pagination
    const limitNum = parseInt(limit as string);
    const offsetNum = parseInt(offset as string);
    const paginatedLogs = filteredLogs.slice(offsetNum, offsetNum + limitNum);

    // Transform to history entries
    const historyEntries: HistoryEntry[] = paginatedLogs.map(log => ({
      id: log.id,
      timestamp: log.timestamp,
      request: {
        id: log.id,
        requestDescription: log.requestDescription,
        location: log.location,
        routePreference: log.routePreference,
        smartAssistEnabled: log.smartAssistEnabled,
        timestamp: log.timestamp,
        status: log.status,
        userId: log.userId,
        sessionId: log.sessionId
      },
      response: log,
      duration: log.processingTime || 0
    }));

    res.json({
      success: true,
      data: {
        entries: historyEntries,
        pagination: {
          total: filteredLogs.length,
          limit: limitNum,
          offset: offsetNum,
          hasMore: offsetNum + limitNum < filteredLogs.length
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

// Get single history entry
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const logs = await readJsonFile<ProcessedRequest[]>('userLogs.json');
    const log = logs.find(l => l.id === req.params.id);

    if (!log) {
      throw new AppError('HISTORY_NOT_FOUND', 'History entry not found', 404);
    }

    const historyEntry: HistoryEntry = {
      id: log.id,
      timestamp: log.timestamp,
      request: {
        id: log.id,
        requestDescription: log.requestDescription,
        location: log.location,
        routePreference: log.routePreference,
        smartAssistEnabled: log.smartAssistEnabled,
        timestamp: log.timestamp,
        status: log.status,
        userId: log.userId,
        sessionId: log.sessionId
      },
      response: log,
      duration: log.processingTime || 0
    };

    res.json({
      success: true,
      data: historyEntry
    });
  } catch (error) {
    next(error);
  }
});

// Get history statistics
router.get('/stats/overview', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { period = '24h' } = req.query;
    const logs = await readJsonFile<ProcessedRequest[]>('userLogs.json');

    // Calculate period start time
    let periodStart: Date;
    switch (period) {
      case '1h':
        periodStart = new Date(Date.now() - 60 * 60 * 1000);
        break;
      case '24h':
        periodStart = new Date(Date.now() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        periodStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        periodStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        periodStart = new Date(Date.now() - 24 * 60 * 60 * 1000);
    }

    const periodLogs = logs.filter(log => new Date(log.timestamp) >= periodStart);

    // Calculate statistics
    const stats = {
      totalRequests: periodLogs.length,
      byStatus: {
        completed: periodLogs.filter(log => log.status === 'completed').length,
        failed: periodLogs.filter(log => log.status === 'failed').length,
        fallback: periodLogs.filter(log => log.status === 'fallback').length,
        pending: periodLogs.filter(log => log.status === 'pending').length,
        processing: periodLogs.filter(log => log.status === 'processing').length
      },
      byRoute: periodLogs.reduce((acc, log) => {
        if (log.botRoute) {
          acc[log.botRoute] = (acc[log.botRoute] || 0) + 1;
        }
        return acc;
      }, {} as Record<string, number>),
      byAssistType: {
        smartAssist: periodLogs.filter(log => log.smartAssistEnabled).length,
        directSlack: periodLogs.filter(log => !log.smartAssistEnabled).length
      },
      averageProcessingTime: periodLogs.length > 0
        ? periodLogs
            .filter(log => log.processingTime)
            .reduce((sum, log) => sum + (log.processingTime || 0), 0) / 
          periodLogs.filter(log => log.processingTime).length
        : 0,
      peakHour: calculatePeakHour(periodLogs),
      errorRate: periodLogs.length > 0
        ? (periodLogs.filter(log => log.status === 'failed').length / periodLogs.length) * 100
        : 0
    };

    res.json({
      success: true,
      data: {
        period,
        periodStart: periodStart.toISOString(),
        periodEnd: new Date().toISOString(),
        stats
      }
    });
  } catch (error) {
    next(error);
  }
});

// Get timeline data for visualization
router.get('/stats/timeline', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { 
      period = '24h',
      interval = 'hour',
      botRoute,
      status
    } = req.query;

    const logs = await readJsonFile<ProcessedRequest[]>('userLogs.json');

    // Calculate period
    let periodStart: Date;
    switch (period) {
      case '1h':
        periodStart = new Date(Date.now() - 60 * 60 * 1000);
        break;
      case '24h':
        periodStart = new Date(Date.now() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        periodStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        break;
      default:
        periodStart = new Date(Date.now() - 24 * 60 * 60 * 1000);
    }

    // Filter logs
    let filteredLogs = logs.filter(log => new Date(log.timestamp) >= periodStart);
    
    if (botRoute) {
      filteredLogs = filteredLogs.filter(log => log.botRoute === botRoute);
    }
    
    if (status) {
      filteredLogs = filteredLogs.filter(log => log.status === status);
    }

    // Group by interval
    const timeline = groupByInterval(filteredLogs, interval as string);

    res.json({
      success: true,
      data: {
        period,
        interval,
        periodStart: periodStart.toISOString(),
        periodEnd: new Date().toISOString(),
        timeline
      }
    });
  } catch (error) {
    next(error);
  }
});

// Helper function to calculate peak hour
function calculatePeakHour(logs: ProcessedRequest[]): number {
  const hourCounts: Record<number, number> = {};
  
  logs.forEach(log => {
    const hour = new Date(log.timestamp).getHours();
    hourCounts[hour] = (hourCounts[hour] || 0) + 1;
  });

  let peakHour = 0;
  let maxCount = 0;
  
  Object.entries(hourCounts).forEach(([hour, count]) => {
    if (count > maxCount) {
      maxCount = count;
      peakHour = parseInt(hour);
    }
  });

  return peakHour;
}

// Helper function to group logs by interval
function groupByInterval(logs: ProcessedRequest[], interval: string): any[] {
  const grouped: Record<string, number> = {};
  
  logs.forEach(log => {
    const date = new Date(log.timestamp);
    let key: string;
    
    switch (interval) {
      case 'hour':
        key = `${date.toISOString().slice(0, 13)}:00:00`;
        break;
      case 'day':
        key = date.toISOString().slice(0, 10);
        break;
      case 'week':
        const week = getWeekNumber(date);
        key = `${date.getFullYear()}-W${week}`;
        break;
      default:
        key = `${date.toISOString().slice(0, 13)}:00:00`;
    }
    
    grouped[key] = (grouped[key] || 0) + 1;
  });

  return Object.entries(grouped)
    .map(([timestamp, count]) => ({ timestamp, count }))
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

// Helper function to get week number
function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

export default router;
