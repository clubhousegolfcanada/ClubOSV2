import bcryptjs from 'bcryptjs';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../utils/database';
import { logger } from '../utils/logger';

// Load environment variables
dotenv.config();

async function createAdminUser() {
  // Default admin credentials
  const email = 'admin@clubhouse247golf.com';
  const password = 'admin123'; // Change this immediately after first login!
  const name = 'Admin User';
  
  console.log('Creating admin user...');
  console.log('Email:', email);
  console.log('Default Password:', password);
  console.log('\n⚠️  IMPORTANT: Change this password after first login!\n');
  
  try {
    // Initialize database connection
    await db.initialize();
    
    // Check if admin already exists
    const existing = await db.findUserByEmail(email);
    if (existing) {
      console.log('❌ Admin user already exists with this email!');
      process.exit(1);
    }
    
    // Hash the password
    const hashedPassword = await bcryptjs.hash(password, 10);
    
    // Create admin user in database
    const adminUser = await db.createUser({
      email,
      password: hashedPassword,
      name,
      role: 'admin'
    });
    
    console.log('✅ Admin user created successfully!');
    console.log('User ID:', adminUser.id);
    console.log('You can now login with the credentials above.');
    
  } catch (error) {
    logger.error('Failed to create admin user:', error);
    console.error('❌ Failed to create admin user:', error);
    process.exit(1);
  } finally {
    // Close database connection
    await db.close();
  }
}

// Run if called directly
if (require.main === module) {
  createAdminUser().catch(console.error);
}

export { createAdminUser };
