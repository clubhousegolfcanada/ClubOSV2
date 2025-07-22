#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const http = require('http');

console.log('🔧 ClubOSV1 Quick Fix\n');

// Check if backend is running
const checkBackend = () => {
  return new Promise((resolve) => {
    const options = {
      hostname: 'localhost',
      port: 3001,
      path: '/health',
      method: 'GET'
    };

    const req = http.request(options, (res) => {
      resolve(true);
    });

    req.on('error', () => {
      resolve(false);
    });

    req.end();
  });
};

// Simple password hash update
const fixAdminPassword = async () => {
  const usersPath = path.join(__dirname, 'ClubOSV1-backend/src/data/users.json');
  
  try {
    // This is the bcrypt hash for "ClubhouseAdmin123!"
    // Generated with bcrypt rounds = 10
    const correctPasswordHash = '$2a$10$X4kv7j5ZcG39WgogSl16yupfsqh6XTaJgTIbjFwGFFkp5TqzNCzgm';
    
    // Read users file
    const data = fs.readFileSync(usersPath, 'utf-8');
    const users = JSON.parse(data);
    
    console.log('Current users:', users.map(u => u.email).join(', '));
    
    // Update admin password
    let updated = false;
    for (let i = 0; i < users.length; i++) {
      if (users[i].email === 'admin@clubhouse247golf.com') {
        users[i].password = correctPasswordHash;
        users[i].updatedAt = new Date().toISOString();
        updated = true;
        break;
      }
    }
    
    if (!updated) {
      // Create admin user
      users.push({
        id: 'admin-001',
        email: 'admin@clubhouse247golf.com',
        password: correctPasswordHash,
        name: 'Admin User',
        role: 'admin',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      console.log('Created admin user');
    } else {
      console.log('Updated admin password');
    }
    
    // Write back
    fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
    
    // Also update sync directory if exists
    try {
      const syncPath = path.join(__dirname, 'ClubOSV1-backend/src/data/sync/users.json');
      fs.writeFileSync(syncPath, JSON.stringify(users, null, 2));
    } catch (e) {
      // Ignore
    }
    
    console.log('\n✅ Admin password fixed!');
    
  } catch (error) {
    console.error('Error:', error.message);
  }
};

// Main
const main = async () => {
  console.log('1️⃣ Checking backend...');
  const backendRunning = await checkBackend();
  
  if (!backendRunning) {
    console.log('❌ Backend is not running!');
    console.log('\nPlease start it in another terminal:');
    console.log('cd ClubOSV1-backend');
    console.log('npm run dev\n');
    console.log('Then run this script again.');
    return;
  }
  
  console.log('✅ Backend is running\n');
  
  console.log('2️⃣ Fixing admin password...');
  await fixAdminPassword();
  
  console.log('\n📋 Login credentials:');
  console.log('   URL: http://localhost:3000/login');
  console.log('   Email: admin@clubhouse247golf.com');
  console.log('   Password: ClubhouseAdmin123!');
};

main();
