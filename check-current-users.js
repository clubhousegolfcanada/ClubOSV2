#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('📋 Checking Current Users\n');

const usersPath = path.join(__dirname, 'ClubOSV1-backend/src/data/users.json');

try {
  const data = fs.readFileSync(usersPath, 'utf-8');
  const users = JSON.parse(data);
  
  console.log('Users in database:');
  console.log('==================');
  users.forEach((user, i) => {
    console.log(`\nUser ${i + 1}:`);
    console.log(`  Email: ${user.email}`);
    console.log(`  Name: ${user.name}`);
    console.log(`  Role: ${user.role}`);
    console.log(`  ID: ${user.id}`);
    console.log(`  Password hash: ${user.password.substring(0, 30)}...`);
  });
  
  console.log('\n\nRaw JSON:');
  console.log('=========');
  console.log(data);
  
} catch (error) {
  console.error('Error reading users:', error.message);
}
