import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { roleGuard } from '../middleware/roleGuard';
import { readJsonFile, writeJsonFile } from '../utils/fileUtils';
import { logger } from '../utils/logger';

const router = Router();

// Backup all data
router.get('/backup', authenticate, roleGuard(['admin']), async (req, res) => {
  try {
    const backup = {
      users: await readJsonFile('users.json').catch(() => []),
      userLogs: await readJsonFile('userLogs.json').catch(() => []),
      authLogs: await readJsonFile('authLogs.json').catch(() => []),
      systemConfig: await readJsonFile('systemConfig.json').catch(() => ({})),
      timestamp: new Date().toISOString()
    };

    res.json({
      success: true,
      data: backup
    });
  } catch (error) {
    logger.error('Backup failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create backup'
    });
  }
});

// Restore from backup
router.post('/restore', authenticate, roleGuard(['admin']), async (req, res) => {
  try {
    const { users, userLogs, authLogs, systemConfig } = req.body;

    if (users) await writeJsonFile('users.json', users);
    if (userLogs) await writeJsonFile('userLogs.json', userLogs);
    if (authLogs) await writeJsonFile('authLogs.json', authLogs);
    if (systemConfig) await writeJsonFile('systemConfig.json', systemConfig);

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
