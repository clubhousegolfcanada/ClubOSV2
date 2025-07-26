import bcryptjs from 'bcryptjs';
import { logger } from '../utils/logger';
import { db } from './database';

export const ensureAdminUser = async () => {
  try {
    // Get admin credentials from environment or use defaults
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@clubhouse247golf.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
    const adminName = process.env.ADMIN_NAME || 'Admin User';
    
    // Check if admin already exists
    const existingAdmin = await db.findUserByEmail(adminEmail);
    
    if (!existingAdmin) {
      logger.info('Creating default admin user...');
      
      // Hash the password
      const hashedPassword = await bcryptjs.hash(adminPassword, 10);
      
      // Create admin user with hashed password
      const adminUser = await db.createUser({
        email: adminEmail,
        password: hashedPassword,
        name: adminName,
        role: 'admin',
        phone: process.env.ADMIN_PHONE || '+1234567890'
      });
      
      logger.info('Default admin user created successfully');
      logger.info(`Email: ${adminEmail}`);
      // Don't log password in production
      if (process.env.NODE_ENV !== 'production') {
        logger.info(`Password: ${adminPassword}`);
      }
    } else {
      logger.info('Admin user already exists');
    }
  } catch (error) {
    logger.error('Error ensuring admin user:', error);
  }
};
