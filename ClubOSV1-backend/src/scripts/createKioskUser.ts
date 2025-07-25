import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const DATA_DIR = path.join(__dirname, '../../data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

interface User {
  id: string;
  email: string;
  password: string; // hashed
  name: string;
  role: 'admin' | 'operator' | 'support' | 'kiosk';
  phone?: string;
  createdAt: string;
  updatedAt: string;
}

async function createKioskUser() {
  try {
    // Ensure data directory exists
    await fs.mkdir(DATA_DIR, { recursive: true });

    // Read existing users
    let users: User[] = [];
    try {
      const usersData = await fs.readFile(USERS_FILE, 'utf-8');
      users = JSON.parse(usersData);
    } catch (error) {
      console.log('No existing users file found, creating new one...');
    }

    // Generate kiosk user details
    const kioskId = `kiosk-${Date.now()}`;
    const kioskEmail = `${kioskId}@clubhouse247.com`;
    const kioskPassword = `kiosk-${Math.random().toString(36).substring(2, 15)}`;
    
    // Hash the password
    const hashedPassword = await bcrypt.hash(kioskPassword, 10);

    // Create the kiosk user
    const newKioskUser: User = {
      id: uuidv4(),
      email: kioskEmail,
      password: hashedPassword,
      name: 'Kiosk User',
      role: 'kiosk',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Add to users array
    users.push(newKioskUser);

    // Save back to file
    await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2));

    console.log('✅ Kiosk user created successfully!');
    console.log('=====================================');
    console.log('Email:', kioskEmail);
    console.log('Password:', kioskPassword);
    console.log('Role: kiosk');
    console.log('=====================================');
    console.log('⚠️  Save these credentials - the password cannot be retrieved later!');
    console.log('This user will only have access to the ClubOS Boy page.');

  } catch (error) {
    console.error('❌ Failed to create kiosk user:', error);
    process.exit(1);
  }
}

// Run the script
createKioskUser();
