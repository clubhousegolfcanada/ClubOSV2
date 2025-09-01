#!/usr/bin/env node

// Script to verify encryption key format
const key = process.argv[2];

if (!key) {
  console.log('Usage: node verify-encryption-key.js <your-encryption-key>');
  console.log('');
  console.log('Example: node verify-encryption-key.js tW51RCGPGbKt49yOByo5+zQFGhZoGNcY');
  process.exit(1);
}

console.log('🔍 Verifying Encryption Key...');
console.log('================================');
console.log(`Key: ${key}`);
console.log(`Length: ${key.length} characters`);
console.log('');

const issues = [];

// Check length
if (key.length !== 32) {
  issues.push(`❌ Key must be exactly 32 characters (yours is ${key.length})`);
} else {
  console.log('✅ Length is correct (32 characters)');
}

// Check for default value
if (key === 'your-32-character-encryption-key') {
  issues.push('❌ Cannot use the default encryption key');
} else {
  console.log('✅ Not using default key');
}

// Check for spaces or newlines
if (key.includes(' ') || key.includes('\n') || key.includes('\t')) {
  issues.push('❌ Key contains spaces or whitespace characters');
} else {
  console.log('✅ No whitespace in key');
}

// Check character validity
const validChars = /^[A-Za-z0-9+/=]+$/;
if (!validChars.test(key)) {
  issues.push('❌ Key contains invalid characters');
} else {
  console.log('✅ All characters are valid');
}

console.log('');
if (issues.length === 0) {
  console.log('✅ ✅ ✅ This encryption key is VALID! ✅ ✅ ✅');
  console.log('');
  console.log('You can use this key in Railway by:');
  console.log('1. Going to your Railway dashboard');
  console.log('2. Selecting your backend service');
  console.log('3. Going to Variables tab');
  console.log('4. Setting ENCRYPTION_KEY to exactly:');
  console.log(`   ${key}`);
} else {
  console.log('❌ This encryption key has issues:');
  issues.forEach(issue => console.log(`   ${issue}`));
  console.log('');
  console.log('Generate a new key with: node scripts/generate-encryption-key.js');
}