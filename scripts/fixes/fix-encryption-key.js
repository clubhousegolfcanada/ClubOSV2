#!/usr/bin/env node

console.log('🔧 Encryption Key Fix Helper');
console.log('============================');
console.log('');
console.log('The current ENCRYPTION_KEY in Railway is 64 characters.');
console.log('It needs to be exactly 32 characters.');
console.log('');
console.log('Here are your options:');
console.log('');
console.log('Option 1: Use our generated key (RECOMMENDED)');
console.log('==========================================');
console.log('tW51RCGPGbKt49yOByo5+zQFGhZoGNcY');
console.log('');
console.log('Option 2: Trim your current key to 32 characters');
console.log('===============================================');
console.log('If your current key looks like a base64 string (64 chars),');
console.log('you can use the first 32 characters.');
console.log('');
console.log('Example:');
console.log('If your key is: xK9mP2nQ8rS3tU5vW6yZ1aC4dE7fG0hJ3kL6mN9pQ2rS4tU6vW7yZ1aC4dE7fG0hJ');
console.log('Use only this:  xK9mP2nQ8rS3tU5vW6yZ1aC4dE7fG0hJ');
console.log('');
console.log('⚠️  WARNING: If you have already encrypted data with the 64-char key,');
console.log('    changing it will make that data unreadable. Only change if:');
console.log('    - This is a new deployment');
console.log('    - You haven\'t stored any encrypted data yet');
console.log('');
console.log('Steps to fix in Railway:');
console.log('1. Go to Railway Variables tab');
console.log('2. Click on ENCRYPTION_KEY');
console.log('3. Replace with one of the options above (exactly 32 chars)');
console.log('4. Save and let Railway redeploy');

// If they provide their current key as argument, show trimmed version
const currentKey = process.argv[2];
if (currentKey && currentKey.length === 64) {
  console.log('');
  console.log('Your current key trimmed to 32 characters:');
  console.log('=========================================');
  console.log(currentKey.substring(0, 32));
}