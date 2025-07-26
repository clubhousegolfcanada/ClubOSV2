import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { logger } from './logger';

// Ensure directory exists
export async function ensureDir(dirPath: string): Promise<void> {
  try {
    await fs.access(dirPath);
  } catch {
    await fs.mkdir(dirPath, { recursive: true });
    logger.debug(`Created directory: ${dirPath}`);
  }
}

// Check if file exists
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

// Read text file
export async function readTextFile(filePath: string): Promise<string> {
  return await fs.readFile(filePath, 'utf-8');
}

// Write text file
export async function writeTextFile(filePath: string, content: string): Promise<void> {
  await ensureDir(dirname(filePath));
  await fs.writeFile(filePath, content, 'utf-8');
}

// Note: All JSON operations have been removed as we're using PostgreSQL exclusively
