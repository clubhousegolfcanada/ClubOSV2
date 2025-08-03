#!/usr/bin/env node

const crypto = require('crypto');

// Generate a secure 32-character encryption key
function generateEncryptionKey() {
  // Use base64 encoding and take exactly 32 characters
  const buffer = crypto.randomBytes(24); // 24 bytes = 32 base64 chars
  const key = buffer.toString('base64').substring(0, 32);
  
  // Verify it's exactly 32 characters
  if (key.length !== 32) {
    throw new Error('Generated key is not 32 characters');
  }
  
  return key;
}

// Generate the key
const encryptionKey = generateEncryptionKey();

console.log('🔐 Generated Encryption Key:');
console.log('============================');
console.log(encryptionKey);
console.log('============================');
console.log(`Length: ${encryptionKey.length} characters`);
console.log('');
console.log('To use this key:');
console.log('1. Copy the key above');
console.log('2. Go to Railway dashboard');
console.log('3. Set ENCRYPTION_KEY environment variable');
console.log('4. Redeploy your service');
console.log('');
console.log('⚠️  IMPORTANT: Save this key securely! You cannot recover it later.');