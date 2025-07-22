#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

console.log('🔍 Checking and Fixing ClubOSV1 Admin Login\n');

// Read the current users
const usersPath = path.join(__dirname, 'ClubOSV1-backend/src/data/users.json');

try {
  // Read current users
  console.log('📁 Reading users file...');
  const data = fs.readFileSync(usersPath, 'utf-8');
  const users = JSON.parse(data);
  
  console.log('\nCurrent users:');
  users.forEach(user => {
    console.log(`- ${user.email} (${user.role})`);
  });

  // We need to use the bcryptjs library from the backend
  const bcryptPath = path.join(__dirname, 'ClubOSV1-backend/node_modules/bcryptjs');
  const bcrypt = require(bcryptPath);
  
  // Set the password that matches the login page
  const correctPassword = 'ClubhouseAdmin123!';
  console.log(`\n🔐 Setting password to: ${correctPassword}`);
  
  // Generate new hash
  const salt = bcrypt.genSaltSync(10);
  const hash = bcrypt.hashSync(correctPassword, salt);
  
  // Update or create admin user
  let adminFound = false;
  for (let i = 0; i < users.length; i++) {
    if (users[i].email === 'admin@clubhouse247golf.com') {
      users[i].password = hash;
      users[i].updatedAt = new Date().toISOString();
      adminFound = true;
      console.log('✅ Updated existing admin user');
      break;
    }
  }
  
  if (!adminFound) {
    // Create admin user
    const adminUser = {
      id: 'admin-001',
      email: 'admin@clubhouse247golf.com',
      password: hash,
      name: 'Admin User',
      role: 'admin',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    users.push(adminUser);
    console.log('✅ Created new admin user');
  }
  
  // Write back to file
  fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
  console.log('✅ Users file updated');
  
  // Also update sync directory
  try {
    const syncPath = path.join(__dirname, 'ClubOSV1-backend/src/data/sync/users.json');
    fs.writeFileSync(syncPath, JSON.stringify(users, null, 2));
    console.log('✅ Sync directory updated');
  } catch (e) {
    // Sync might not exist
  }
  
  console.log('\n🎉 Password has been reset!\n');
  console.log('📋 Login with:');
  console.log('   Email: admin@clubhouse247golf.com');
  console.log('   Password: ClubhouseAdmin123!');
  console.log('   URL: http://localhost:3000/login');
  
  // Test the password
  console.log('\n🧪 Testing password...');
  const adminUser = users.find(u => u.email === 'admin@clubhouse247golf.com');
  if (adminUser) {
    const isValid = bcrypt.compareSync('ClubhouseAdmin123!', adminUser.password);
    console.log(`Password test: ${isValid ? '✅ PASSED' : '❌ FAILED'}`);
  }
  
} catch (error) {
  console.error('\n❌ Error:', error.message);
  
  if (error.code === 'MODULE_NOT_FOUND') {
    console.log('\n💡 Trying alternative approach...\n');
    
    // Use a pre-generated hash for ClubhouseAdmin123!
    // This hash was generated with bcrypt rounds=10
    const preGeneratedHash = '$2a$10$kPqGKPH8oZxOCm4BXGqMGOdqrQW7FqMr2hYa0PM91nXQNWoJZ9lkW';
    
    try {
      const data = fs.readFileSync(usersPath, 'utf-8');
      const users = JSON.parse(data);
      
      // Update admin user with pre-generated hash
      let updated = false;
      for (let i = 0; i < users.length; i++) {
        if (users[i].email === 'admin@clubhouse247golf.com') {
          users[i].password = preGeneratedHash;
          users[i].updatedAt = new Date().toISOString();
          updated = true;
          break;
        }
      }
      
      if (!updated) {
        users.push({
          id: 'admin-001',
          email: 'admin@clubhouse247golf.com',
          password: preGeneratedHash,
          name: 'Admin User',
          role: 'admin',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }
      
      fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
      
      console.log('✅ Admin password set using pre-generated hash');
      console.log('\n📋 Login with:');
      console.log('   Email: admin@clubhouse247golf.com');
      console.log('   Password: ClubhouseAdmin123!');
      
    } catch (err) {
      console.error('Failed to update users file:', err.message);
    }
  }
}
