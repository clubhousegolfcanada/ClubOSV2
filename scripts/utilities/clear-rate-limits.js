#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🧹 Clearing Rate Limit Data\n');

const dataDir = path.join(__dirname, 'ClubOSV1-backend/src/data');

// Files that might contain rate limit data
const filesToCheck = [
  'rateLimits.json',
  'usage.json',
  'usageData.json',
  'cache/rateLimits.json'
];

filesToCheck.forEach(file => {
  const filePath = path.join(dataDir, file);
  try {
    if (fs.existsSync(filePath)) {
      // Reset to empty object or array
      const content = file.includes('json') ? '{}' : '[]';
      fs.writeFileSync(filePath, content);
      console.log(`✅ Cleared ${file}`);
    }
  } catch (error) {
    console.log(`⚠️  Could not clear ${file}`);
  }
});

// Also check for in-memory rate limit storage
const usageDir = path.join(dataDir, 'usage');
if (fs.existsSync(usageDir)) {
  console.log('\nClearing usage directory...');
  const files = fs.readdirSync(usageDir);
  files.forEach(file => {
    const filePath = path.join(usageDir, file);
    try {
      fs.unlinkSync(filePath);
      console.log(`✅ Deleted ${file}`);
    } catch (e) {
      // Ignore
    }
  });
}

console.log('\n✅ Rate limit data cleared!');
console.log('\nTry creating a user again now.');
