#!/usr/bin/env node

const bcrypt = require('bcryptjs');
const fs = require('fs').promises;
const path = require('path');

async function createAdminUser() {
  const adminPassword = 'Admin123!@#';
  const hashedPassword = await bcrypt.hash(adminPassword, 10);
  
  const adminUser = {
    id: 'admin-001',
    email: 'admin@clubhouse247golf.com',
    password: hashedPassword,
    name: 'Admin User',
    role: 'admin',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const usersPath = path.join(__dirname, '../ClubOSV1-backend/src/data/users.json');
  
  try {
    // Read existing users
    const data = await fs.readFile(usersPath, 'utf-8');
    const users = JSON.parse(data);
    
    // Check if admin already exists
    const existingIndex = users.findIndex(u => u.email === 'admin@clubhouse247golf.com');
    
    if (existingIndex >= 0) {
      // Update existing admin
      users[existingIndex] = adminUser;
      console.log('✅ Updated admin user password');
    } else {
      // Add new admin
      users.push(adminUser);
      console.log('✅ Created admin user');
    }
    
    // Write back to file
    await fs.writeFile(usersPath, JSON.stringify(users, null, 2), 'utf-8');
    
    console.log('\nAdmin credentials:');
    console.log('Email: admin@clubhouse247golf.com');
    console.log('Password: Admin123!@#');
    console.log('\nYou can now use these credentials to login to ClubOSV1');
    
  } catch (error) {
    console.error('Error setting up admin user:', error);
  }
}

createAdminUser();
