#!/usr/bin/env npx tsx
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

console.log('🔧 UniFi Access API Configuration Helper\n');

// Read current .env file
const envPath = path.join(__dirname, '..', '.env');
let envContent = fs.readFileSync(envPath, 'utf-8');

// Configuration based on your documentation
const config = {
  // Use the API key you already have
  UNIFI_ACCESS_API_TOKEN: process.env.UNIFI_API_KEY || '5GmQjC0y7sgfJ0JmPmh17dL17SOFp8IV',
  
  // For remote access through UniFi cloud
  UNIFI_CONTROLLER_HOST: 'api.ui.com',
  UNIFI_CONTROLLER_PORT: '443',
  UNIFI_USE_LOCAL_ACCESS: 'false',
  
  // Your console ID
  UNIFI_CONSOLE_ID: process.env.UNIFI_CONSOLE_ID || '0CEA1424DB29000000000861C4610000000008D3E6AB000000006703125C:145557302'
};

console.log('Current Configuration:');
console.log('=====================');
Object.entries(config).forEach(([key, value]) => {
  console.log(`${key}: ${value}`);
});

console.log('\n📝 Updating .env file...\n');

// Update or add each configuration
Object.entries(config).forEach(([key, value]) => {
  const regex = new RegExp(`^${key}=.*$`, 'gm');
  
  if (envContent.match(regex)) {
    // Update existing
    envContent = envContent.replace(regex, `${key}=${value}`);
    console.log(`✅ Updated: ${key}`);
  } else {
    // Add new
    envContent += `\n${key}=${value}`;
    console.log(`➕ Added: ${key}`);
  }
});

// Write back to .env
fs.writeFileSync(envPath, envContent);

console.log('\n✅ Configuration updated successfully!');
console.log('\n🔍 Next Steps:');
console.log('1. Run: npm run test:unifi');
console.log('2. If it shows doors, run: npm run unlock:door');
console.log('3. If authentication fails, we may need to use OAuth instead of API key');

console.log('\n💡 Note: The API key might be read-only. If unlock fails, we\'ll need to:');
console.log('   - Get a Developer API token from UniFi Access settings');
console.log('   - Or implement OAuth authentication with your UniFi account');