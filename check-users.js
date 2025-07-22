#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

console.log('📁 Checking ClubOSV1 Users File\n');

const usersPath = path.join(__dirname, 'ClubOSV1-backend/src/data/users.json');

try {
  // Read and display users
  const data = fs.readFileSync(usersPath, 'utf-8');
  const users = JSON.parse(data);
  
  console.log('Current users in database:');
  console.log('==========================');
  
  users.forEach((user, index) => {
    console.log(`\nUser ${index + 1}:`);
    console.log(`  ID: ${user.id}`);
    console.log(`  Email: ${user.email}`);
    console.log(`  Name: ${user.name}`);
    console.log(`  Role: ${user.role}`);
    console.log(`  Password Hash: ${user.password.substring(0, 20)}...`);
    console.log(`  Created: ${user.createdAt}`);
  });
  
  // Test password
  console.log('\n\nPassword Test:');
  console.log('==============');
  const testPassword = 'ClubhouseAdmin123!';
  
  for (const user of users) {
    if (user.email === 'admin@clubhouse247golf.com') {
      console.log(`\nTesting password "${testPassword}" for ${user.email}:`);
      
      const isValid = bcrypt.compareSync(testPassword, user.password);
      console.log(`Result: ${isValid ? '✅ VALID' : '❌ INVALID'}`);
      
      if (!isValid) {
        console.log('\nGenerating correct password hash...');
        const correctHash = bcrypt.hashSync(testPassword, 10);
        console.log('New hash:', correctHash);
        console.log('\nTo fix, replace the password hash in users.json with the hash above.');
      }
    }
  }
  
} catch (error) {
  console.error('Error:', error.message);
  console.log('\nMake sure you run this from the ClubOSV1 directory');
}
