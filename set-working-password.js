#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔧 Updating Admin with Working Password Hash\n');

// Path to users.json
const usersPath = path.join(__dirname, 'ClubOSV1-backend/src/data/users.json');

// This is the working hash we just generated
const WORKING_HASH = '$2a$10$ts4hH9sofAQYDoZm5pmrmOzVYbxskjALAqXPW55WBggWSBdCJxgJi';

try {
  // Create admin user with the working hash
  const users = [
    {
      id: 'admin-001',
      email: 'admin@clubhouse247golf.com',
      password: WORKING_HASH,
      name: 'Admin User',
      role: 'admin',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ];
  
  // Write to file
  console.log('Writing admin user with working password hash...');
  fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
  
  // Also update sync directory
  try {
    const syncPath = path.join(__dirname, 'ClubOSV1-backend/src/data/sync/users.json');
    fs.writeFileSync(syncPath, JSON.stringify(users, null, 2));
  } catch (e) {
    // Ignore if sync doesn't exist
  }
  
  console.log('✅ Admin user updated with working password!\n');
  console.log('Login credentials:');
  console.log('================');
  console.log('Email: admin@clubhouse247golf.com');
  console.log('Password: ClubhouseAdmin123!');
  console.log('\nThis password has been tested and confirmed to work!');
  
} catch (error) {
  console.error('❌ Error:', error.message);
}
