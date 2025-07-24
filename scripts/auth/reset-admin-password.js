#!/usr/bin/env node

const bcrypt = require('bcryptjs');
const fs = require('fs').promises;
const path = require('path');

async function resetAdminPassword() {
  console.log('🔐 Resetting admin password to match login page...\n');
  
  const usersPath = path.join(__dirname, 'ClubOSV1-backend/src/data/users.json');
  
  try {
    // Read current users
    const data = await fs.readFile(usersPath, 'utf-8');
    const users = JSON.parse(data);
    console.log('Current users in database:');
    users.forEach(u => {
      console.log(`- ${u.email} (${u.role})`);
    });
    
    // Password from the login page
    const newPassword = 'ClubhouseAdmin123!';
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    // Update admin user
    const adminIndex = users.findIndex(u => u.email === 'admin@clubhouse247golf.com');
    
    if (adminIndex >= 0) {
      users[adminIndex].password = hashedPassword;
      users[adminIndex].updatedAt = new Date().toISOString();
      
      // Write back to file
      await fs.writeFile(usersPath, JSON.stringify(users, null, 2), 'utf-8');
      
      console.log('\n✅ Admin password has been reset!');
      console.log('\n📧 Login credentials:');
      console.log('Email: admin@clubhouse247golf.com');
      console.log('Password: ClubhouseAdmin123!');
      console.log('\nThese match the credentials shown on the login page.');
      
      // Also update the sync directory if it exists
      const syncPath = path.join(__dirname, 'ClubOSV1-backend/src/data/sync/users.json');
      try {
        await fs.writeFile(syncPath, JSON.stringify(users, null, 2), 'utf-8');
        console.log('\n✅ Sync directory updated');
      } catch (e) {
        // Sync directory might not exist, that's ok
      }
      
    } else {
      console.log('\n❌ Admin user not found! Creating new admin user...');
      
      const adminUser = {
        id: 'admin-001',
        email: 'admin@clubhouse247golf.com',
        password: hashedPassword,
        name: 'Admin User',
        role: 'admin',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      users.push(adminUser);
      await fs.writeFile(usersPath, JSON.stringify(users, null, 2), 'utf-8');
      
      console.log('\n✅ Admin user created!');
      console.log('\n📧 Login credentials:');
      console.log('Email: admin@clubhouse247golf.com');
      console.log('Password: ClubhouseAdmin123!');
    }
    
    // Test the password
    console.log('\n🧪 Testing password hash...');
    const testResult = await bcrypt.compare('ClubhouseAdmin123!', hashedPassword);
    console.log('Password test:', testResult ? '✅ PASSED' : '❌ FAILED');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('Make sure you run this from the ClubOSV1 directory');
  }
}

// Run the reset
resetAdminPassword();
