import bcryptjs from 'bcryptjs';
import { readJsonFile, writeJsonFile } from '../utils/fileUtils';
import { logger } from '../utils/logger';

const DEFAULT_ADMIN = {
  id: 'admin-001',
  email: 'admin@clubhouse247golf.com',
  password: 'admin123', // Will be hashed
  name: 'Admin User',
  role: 'admin' as const,
  phone: '+1234567890',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

export const ensureAdminUser = async () => {
  try {
    const users = await readJsonFile<any[]>('users.json');
    
    // Check if admin already exists
    const adminExists = users.some(u => u.email === DEFAULT_ADMIN.email);
    
    if (!adminExists) {
      logger.info('Creating default admin user...');
      
      // Hash the password
      const hashedPassword = await bcryptjs.hash(DEFAULT_ADMIN.password, 10);
      
      // Create admin user with hashed password
      const adminUser = {
        ...DEFAULT_ADMIN,
        password: hashedPassword
      };
      
      users.push(adminUser);
      await writeJsonFile('users.json', users);
      
      logger.info('Default admin user created successfully');
      logger.info(`Email: ${DEFAULT_ADMIN.email}`);
      logger.info(`Password: ${DEFAULT_ADMIN.password}`);
    } else {
      logger.info('Admin user already exists');
    }
  } catch (error) {
    logger.error('Error ensuring admin user:', error);
  }
};
