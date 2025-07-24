import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { roleGuard } from '../middleware/roleGuard';
import { readJsonFile, writeJsonFile } from '../utils/fileUtils';
import { logger } from '../utils/logger';

const router = Router();

// Backup all data
router.get('/', authenticate, roleGuard(['admin']), async (req, res) => {
  try {
    logger.info('Backup requested by user:', req.user?.email);
    
    const backup = {
      users: await readJsonFile('users.json').catch((err) => {
        logger.warn('Failed to read users.json:', err.message);
        return [];
      }),
      userLogs: await readJsonFile('userLogs.json').catch((err) => {
        logger.warn('Failed to read userLogs.json:', err.message);
        return [];
      }),
      authLogs: await readJsonFile('authLogs.json').catch((err) => {
        logger.warn('Failed to read authLogs.json:', err.message);
        return [];
      }),
      systemConfig: await readJsonFile('systemConfig.json').catch((err) => {
        logger.warn('Failed to read systemConfig.json:', err.message);
        return {};
      }),
      notUsefulFeedback: await readJsonFile('not_useful_feedback.json').catch((err) => {
        logger.warn('Failed to read not_useful_feedback.json:', err.message);
        return [];
      }),
      allFeedback: await readJsonFile('all_feedback.json').catch((err) => {
        logger.warn('Failed to read all_feedback.json:', err.message);
        return [];
      }),
      timestamp: new Date().toISOString(),
      version: '1.1'
    };

    logger.info('Backup created successfully with', {
      userCount: backup.users.length,
      logCount: backup.userLogs.length
    });

    res.json({
      success: true,
      data: backup
    });
  } catch (error: any) {
    logger.error('Backup failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create backup',
      error: error.message
    });
  }
});

// Restore from backup
router.post('/restore', authenticate, roleGuard(['admin']), async (req, res) => {
  try {
    const { users, userLogs, authLogs, systemConfig, notUsefulFeedback, allFeedback } = req.body;

    if (users) await writeJsonFile('users.json', users);
    if (userLogs) await writeJsonFile('userLogs.json', userLogs);
    if (authLogs) await writeJsonFile('authLogs.json', authLogs);
    if (systemConfig) await writeJsonFile('systemConfig.json', systemConfig);
    if (notUsefulFeedback) await writeJsonFile('not_useful_feedback.json', notUsefulFeedback);
    if (allFeedback) await writeJsonFile('all_feedback.json', allFeedback);

    res.json({
      success: true,
      message: 'Data restored successfully'
    });
  } catch (error) {
    logger.error('Restore failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to restore backup'
    });
  }
});

export default router;
