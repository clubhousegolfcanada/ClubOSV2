import bcryptjs from 'bcryptjs';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../utils/database';
import { logger } from '../utils/logger';

// Load environment variables
dotenv.config();

async function createKioskUser() {
  try {
    // Initialize database connection
    await db.initialize();

    // Generate kiosk user details
    const kioskId = `kiosk-${Date.now()}`;
    const kioskEmail = `${kioskId}@clubhouse247.com`;
    const kioskPassword = `kiosk-${Math.random().toString(36).substring(2, 15)}`;
    
    // Hash the password
    const hashedPassword = await bcryptjs.hash(kioskPassword, 10);

    // Create the kiosk user in database
    const newKioskUser = await db.createUser({
      email: kioskEmail,
      password: hashedPassword,
      name: 'Kiosk User',
      role: 'kiosk'
    });

    console.log('✅ Kiosk user created successfully!');
    console.log('=====================================');
    console.log('Email:', kioskEmail);
    console.log('Password:', kioskPassword);
    console.log('Role: kiosk');
    console.log('User ID:', newKioskUser.id);
    console.log('=====================================');
    console.log('⚠️  Save these credentials - the password cannot be retrieved later!');
    console.log('This user will only have access to the ClubOS Boy page.');

  } catch (error) {
    logger.error('Failed to create kiosk user:', error);
    console.error('❌ Failed to create kiosk user:', error);
    process.exit(1);
  } finally {
    // Close database connection
    await db.close();
  }
}

// Run the script
createKioskUser();
