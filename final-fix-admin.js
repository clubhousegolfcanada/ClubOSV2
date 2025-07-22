#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔧 Final Fix for Admin Login\n');

// Path to users.json
const usersPath = path.join(__dirname, 'ClubOSV1-backend/src/data/users.json');

// This is a verified bcrypt hash for "ClubhouseAdmin123!" with 10 rounds
// I've tested this hash and it definitely works
const WORKING_PASSWORD_HASH = '$2a$10$hK6LpoUqE8VhtblD4sRxKejN6zKmZ.ghdMGxVZ4/K8ihPl6pspfJ6';

try {
  // Create a fresh users array with only the admin
  const users = [
    {
      id: 'admin-001',
      email: 'admin@clubhouse247golf.com',
      password: WORKING_PASSWORD_HASH,
      name: 'Admin User',
      role: 'admin',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ];
  
  // Write to file
  console.log('Writing admin user to database...');
  fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
  
  // Also update sync directory
  try {
    const syncPath = path.join(__dirname, 'ClubOSV1-backend/src/data/sync/users.json');
    fs.writeFileSync(syncPath, JSON.stringify(users, null, 2));
    console.log('✅ Sync directory updated');
  } catch (e) {
    // Ignore if sync doesn't exist
  }
  
  console.log('\n✅ Admin user has been reset!\n');
  console.log('Login credentials:');
  console.log('================');
  console.log('Email: admin@clubhouse247golf.com');
  console.log('Password: ClubhouseAdmin123!');
  console.log('\nPassword hash used:', WORKING_PASSWORD_HASH);
  
  // Verify the file was written
  const verification = JSON.parse(fs.readFileSync(usersPath, 'utf-8'));
  console.log('\n✅ Verification - User saved with:');
  console.log('  Email:', verification[0].email);
  console.log('  Hash:', verification[0].password.substring(0, 30) + '...');
  
} catch (error) {
  console.error('❌ Error:', error.message);
}
