#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔧 Direct Password Fix for ClubOSV1\n');

// This is a verified bcrypt hash for "ClubhouseAdmin123!"
// Generated with: bcrypt.hashSync('ClubhouseAdmin123!', 10)
const VERIFIED_HASH = '$2a$10$Yl9.Bh1yM5rGFnhZFQt.PORZJfmVGFT2IiW9kicuXRqzWGJzW2lbO';

const usersPath = path.join(__dirname, 'ClubOSV1-backend/src/data/users.json');

try {
  // Create admin user with known good password hash
  const adminUser = {
    id: 'admin-001',
    email: 'admin@clubhouse247golf.com',
    password: VERIFIED_HASH,
    name: 'Admin User',
    role: 'admin',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  // Write single admin user
  const users = [adminUser];
  
  console.log('📝 Writing admin user to database...');
  fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
  
  // Also update sync directory
  try {
    const syncDir = path.join(__dirname, 'ClubOSV1-backend/src/data/sync');
    if (!fs.existsSync(syncDir)) {
      fs.mkdirSync(syncDir, { recursive: true });
    }
    const syncPath = path.join(syncDir, 'users.json');
    fs.writeFileSync(syncPath, JSON.stringify(users, null, 2));
  } catch (e) {
    // Ignore sync errors
  }
  
  console.log('\n✅ Admin user created successfully!\n');
  console.log('📋 Login credentials:');
  console.log('====================');
  console.log('Email: admin@clubhouse247golf.com');
  console.log('Password: ClubhouseAdmin123!');
  console.log('\nMake sure both servers are running:');
  console.log('- Frontend: http://localhost:3000');
  console.log('- Backend: http://localhost:3001');
  
  // Show the created user
  console.log('\n📁 Users file now contains:');
  const savedData = fs.readFileSync(usersPath, 'utf-8');
  const savedUsers = JSON.parse(savedData);
  savedUsers.forEach(u => {
    console.log(`- ${u.email} (${u.role})`);
  });
  
} catch (error) {
  console.error('❌ Error:', error.message);
}
