#!/usr/bin/env node

const { exec } = require('child_process');
const axios = require('axios');
const bcrypt = require('bcryptjs');
const fs = require('fs').promises;
const path = require('path');

async function checkAndFix() {
  console.log('🔍 ClubOSV1 System Check\n');

  // 1. Check if backend is running
  console.log('1️⃣ Checking backend server...');
  try {
    const health = await axios.get('http://localhost:3001/health');
    console.log('✅ Backend is running:', health.data);
  } catch (error) {
    console.error('❌ Backend is NOT running!');
    console.log('\nPlease start the backend in a new terminal:');
    console.log('cd ClubOSV1-backend');
    console.log('npm run dev\n');
    return;
  }

  // 2. Check and fix admin user
  console.log('\n2️⃣ Checking admin user...');
  const usersPath = path.join(__dirname, 'ClubOSV1-backend/src/data/users.json');
  
  try {
    const data = await fs.readFile(usersPath, 'utf-8');
    const users = JSON.parse(data);
    
    console.log('Found users:', users.map(u => u.email).join(', '));
    
    // Update admin password
    const adminIndex = users.findIndex(u => u.email === 'admin@clubhouse247golf.com');
    
    if (adminIndex >= 0) {
      console.log('\n3️⃣ Updating admin password...');
      const newPassword = 'ClubhouseAdmin123!';
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      
      users[adminIndex].password = hashedPassword;
      users[adminIndex].updatedAt = new Date().toISOString();
      
      await fs.writeFile(usersPath, JSON.stringify(users, null, 2), 'utf-8');
      
      // Also update sync directory
      try {
        const syncPath = path.join(__dirname, 'ClubOSV1-backend/src/data/sync/users.json');
        await fs.writeFile(syncPath, JSON.stringify(users, null, 2), 'utf-8');
      } catch (e) {
        // Ignore if sync doesn't exist
      }
      
      console.log('✅ Admin password updated!');
    } else {
      console.log('❌ Admin user not found, creating...');
      const hashedPassword = await bcrypt.hash('ClubhouseAdmin123!', 10);
      
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
      console.log('✅ Admin user created!');
    }
    
    // 3. Test login
    console.log('\n4️⃣ Testing login...');
    try {
      const loginResponse = await axios.post('http://localhost:3001/api/auth/login', {
        email: 'admin@clubhouse247golf.com',
        password: 'ClubhouseAdmin123!'
      });
      
      if (loginResponse.data.success) {
        console.log('✅ Login test PASSED!');
        console.log('   Token:', loginResponse.data.data.token.substring(0, 50) + '...');
      }
    } catch (error) {
      console.error('❌ Login test FAILED:', error.response?.data?.message || error.message);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
  
  console.log('\n✅ System check complete!\n');
  console.log('📋 Login credentials:');
  console.log('   Email: admin@clubhouse247golf.com');
  console.log('   Password: ClubhouseAdmin123!');
  console.log('\n🌐 Frontend URL: http://localhost:3000/login');
  console.log('🔧 Backend URL: http://localhost:3001');
}

checkAndFix();
