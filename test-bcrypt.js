#!/usr/bin/env node

// Test bcrypt directly using the backend's bcrypt module
const path = require('path');
const bcrypt = require(path.join(__dirname, 'ClubOSV1-backend/node_modules/bcryptjs'));

console.log('🧪 Testing bcrypt password comparison\n');

const password = 'ClubhouseAdmin123!';
const hashes = [
  '$2a$10$hK6LpoUqE8VhtblD4sRxKejN6zKmZ.ghdMGxVZ4/K8ihPl6pspfJ6',
  '$2a$10$Yl9.Bh1yM5rGFnhZFQt.PORZJfmVGFT2IiW9kicuXRqzWGJzW2lbO',
  '$2a$10$X4kv7j5ZcG39WgogSl16yupfsqh6XTaJgTIbjFwGFFkp5TqzNCzgm'
];

console.log(`Testing password: "${password}"\n`);

hashes.forEach((hash, i) => {
  const result = bcrypt.compareSync(password, hash);
  console.log(`Hash ${i + 1}: ${result ? '✅ MATCHES' : '❌ NO MATCH'}`);
  console.log(`  ${hash}`);
});

// Generate a new hash
console.log('\nGenerating fresh hash...');
const salt = bcrypt.genSaltSync(10);
const newHash = bcrypt.hashSync(password, salt);
console.log('New hash:', newHash);

// Test the new hash
const testNew = bcrypt.compareSync(password, newHash);
console.log('New hash test:', testNew ? '✅ WORKS' : '❌ FAILED');
