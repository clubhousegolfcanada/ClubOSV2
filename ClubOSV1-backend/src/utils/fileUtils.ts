import { promises as fs } from 'fs';
import path from 'path';
import { logger } from './logger';
import { Mutex } from 'async-mutex';

// Create mutexes for each file to prevent concurrent writes
const fileMutexes = new Map<string, Mutex>();

const getFileMutex = (filename: string): Mutex => {
  if (!fileMutexes.has(filename)) {
    fileMutexes.set(filename, new Mutex());
  }
  return fileMutexes.get(filename)!;
};

// Use environment variable if available, otherwise use default
const DATA_DIR = process.env.DATA_PATH || path.join(process.cwd(), 'src', 'data');
const SYNC_DIR = path.join(DATA_DIR, 'sync');

export const ensureFileExists = async (filePath: string, defaultContent: any = ''): Promise<void> => {
  try {
    await fs.access(filePath);
  } catch {
    // File doesn't exist, create it
    const dir = path.dirname(filePath);
    await ensureDirectoryExists(dir);
    const content = typeof defaultContent === 'string' 
      ? defaultContent 
      : JSON.stringify(defaultContent, null, 2);
    await fs.writeFile(filePath, content, 'utf-8');
    logger.info(`Created file: ${filePath}`);
  }
};

export const ensureDirectoryExists = async (dirPath: string): Promise<void> => {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (error) {
    logger.error(`Failed to create directory ${dirPath}:`, error);
    throw error;
  }
};

export const initializeDataFiles = async (): Promise<void> => {
  // Log the data directory being used
  logger.info(`Using data directory: ${DATA_DIR}`);
  
  // Create necessary directories
  await ensureDirectoryExists(DATA_DIR);
  await ensureDirectoryExists(SYNC_DIR);
  await ensureDirectoryExists(path.join(DATA_DIR, 'logs'));
  await ensureDirectoryExists(path.join(DATA_DIR, 'backups'));

  // Initialize data files if they don't exist
  const dataFiles = [
    { name: 'userLogs.json', content: '[]' },
    { name: 'bookings.json', content: '[]' },
    { name: 'accessLogs.json', content: '[]' },
    { name: 'users.json', content: JSON.stringify([{
      "id": "admin-001",
      "email": "admin@clubhouse247golf.com",
      "password": "$2b$10$YVn3nQ8Q2vM5FPqg3SZQT.GjGK9AVkGH8J8mUqaJHUEiDCVxDkwKe",
      "name": "Admin User",
      "role": "admin",
      "phone": "+1234567890",
      "createdAt": "2024-01-20T12:00:00.000Z",
      "updatedAt": "2024-01-20T12:00:00.000Z"
    }], null, 2) },
    { name: 'authLogs.json', content: '[]' },
    { name: 'logs/requests.json', content: '[]' },
    { name: 'systemConfig.json', content: JSON.stringify({
      llmEnabled: true,
      slackFallbackEnabled: true,
      maxRetries: 3,
      requestTimeout: 30000,
      dataRetentionDays: 90
    }, null, 2) },
    { name: 'not_useful_feedback.json', content: '[]' },
    { name: 'all_feedback.json', content: '[]' }
  ];

  for (const file of dataFiles) {
    const filePath = path.join(DATA_DIR, file.name);
    try {
      await fs.access(filePath);
      logger.info(`Data file exists: ${file.name}`);
    } catch {
      await fs.writeFile(filePath, file.content, 'utf-8');
      logger.info(`Created data file: ${file.name}`);
    }
  }
};

export const readJsonFile = async <T>(filename: string): Promise<T> => {
  const filePath = path.join(DATA_DIR, filename);
  const mutex = getFileMutex(filename);
  
  return await mutex.runExclusive(async () => {
    try {
      const data = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      logger.error(`Failed to read ${filename} from ${filePath}:`, error);
      throw error;
    }
  });
};

export const writeJsonFile = async <T>(filename: string, data: T): Promise<void> => {
  const filePath = path.join(DATA_DIR, filename);
  const mutex = getFileMutex(filename);
  
  await mutex.runExclusive(async () => {
    try {
      const jsonData = JSON.stringify(data, null, 2);
      
      // Write to a temporary file first
      const tempPath = `${filePath}.tmp`;
      await fs.writeFile(tempPath, jsonData, 'utf-8');
      
      // Rename the temporary file to the actual file (atomic operation)
      await fs.rename(tempPath, filePath);
      
      // Also write to sync directory
      try {
        const syncPath = path.join(SYNC_DIR, filename);
        await fs.writeFile(syncPath, jsonData, 'utf-8');
      } catch (error) {
        // Ignore sync errors
      }
    } catch (error) {
      logger.error(`Failed to write ${filename}:`, error);
      throw error;
    }
  });
};

export const appendToJsonArray = async <T>(filename: string, item: T): Promise<void> => {
  const mutex = getFileMutex(filename);
  
  await mutex.runExclusive(async () => {
    try {
      const filePath = path.join(DATA_DIR, filename);
      let data: T[] = [];
      
      // Try to read existing data
      try {
        const fileContent = await fs.readFile(filePath, 'utf-8');
        data = JSON.parse(fileContent);
        
        // Validate that it's an array
        if (!Array.isArray(data)) {
          logger.warn(`${filename} is not an array, resetting to empty array`);
          data = [];
        }
      } catch (error) {
        // If file doesn't exist or is corrupted, start with empty array
        logger.warn(`Could not read ${filename}, starting with empty array`);
        data = [];
      }
      
      // Append the new item
      data.push(item);
      
      // Limit array size to prevent unbounded growth
      const MAX_LOG_ENTRIES = 10000;
      if (data.length > MAX_LOG_ENTRIES) {
        data = data.slice(-MAX_LOG_ENTRIES);
      }
      
      // Write back
      const jsonData = JSON.stringify(data, null, 2);
      const tempPath = `${filePath}.tmp`;
      await fs.writeFile(tempPath, jsonData, 'utf-8');
      await fs.rename(tempPath, filePath);
      
    } catch (error) {
      logger.error(`Failed to append to ${filename}:`, error);
      // Don't throw - logging should not break the application
    }
  });
};

export const createBackup = async (filename: string): Promise<string> => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupName = `${filename}-${timestamp}.bak`;
  const sourcePath = path.join(DATA_DIR, filename);
  const backupPath = path.join(DATA_DIR, 'backups', backupName);

  try {
    const data = await fs.readFile(sourcePath);
    await fs.writeFile(backupPath, data);
    logger.info(`Created backup: ${backupName}`);
    return backupName;
  } catch (error) {
    logger.error(`Failed to create backup for ${filename}:`, error);
    throw error;
  }
};

export const cleanOldBackups = async (retentionDays: number = 30): Promise<void> => {
  const backupsDir = path.join(DATA_DIR, 'backups');
  const now = Date.now();
  const retentionMs = retentionDays * 24 * 60 * 60 * 1000;

  try {
    const files = await fs.readdir(backupsDir);
    
    for (const file of files) {
      const filePath = path.join(backupsDir, file);
      const stats = await fs.stat(filePath);
      
      if (now - stats.mtime.getTime() > retentionMs) {
        await fs.unlink(filePath);
        logger.info(`Deleted old backup: ${file}`);
      }
    }
  } catch (error) {
    logger.error('Failed to clean old backups:', error);
  }
};
