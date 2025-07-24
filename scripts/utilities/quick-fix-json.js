#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔧 Quick Fix for Corrupted JSON Files\n');

const dataDir = path.join(__dirname, 'ClubOSV1-backend/src/data');

// Files that should be reset to empty arrays
const filesToReset = [
  'userLogs.json',
  'authLogs.json',
  'accessLogs.json',
  'bookings.json',
  'logs/requests.json'
];

// Fix each file
filesToReset.forEach(file => {
  const filePath = path.join(dataDir, file);
  try {
    // Create directory if needed
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // Write empty array
    fs.writeFileSync(filePath, '[]');
    console.log(`✅ Reset ${file}`);
  } catch (error) {
    console.log(`⚠️  Could not reset ${file}: ${error.message}`);
  }
});

// Ensure systemConfig.json exists
const configPath = path.join(dataDir, 'systemConfig.json');
if (!fs.existsSync(configPath)) {
  const config = {
    llmEnabled: true,
    slackFallbackEnabled: true,
    maxRetries: 3,
    requestTimeout: 30000,
    dataRetentionDays: 90
  };
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  console.log('✅ Created systemConfig.json');
}

console.log('\n✅ JSON files cleaned!');
console.log('\nNow the backend should work properly.');
console.log('Try logging in with:');
console.log('Email: admin@clubhouse247golf.com');
console.log('Password: ClubhouseAdmin123!');
