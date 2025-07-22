#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

console.log('🔧 ClubOSV1 Data Migration & Cleanup');
console.log('===================================\n');

const DATA_DIR = path.join(__dirname, '../src/data');

async function migrateData() {
  // 1. Ensure all directories exist
  console.log('1️⃣ Creating directory structure...');
  const dirs = ['', 'logs', 'backups', 'sync'];
  for (const dir of dirs) {
    const dirPath = path.join(DATA_DIR, dir);
    await fs.mkdir(dirPath, { recursive: true });
    console.log(`  ✅ ${dir || 'data'}/`);
  }

  // 2. Clean up and validate all JSON files
  console.log('\n2️⃣ Validating and fixing JSON files...');
  const jsonFiles = [
    { name: 'users.json', default: '[]' },
    { name: 'authLogs.json', default: '[]' },
    { name: 'userLogs.json', default: '[]' },
    { name: 'bookings.json', default: '[]' },
    { name: 'accessLogs.json', default: '[]' },
    { name: 'logs/requests.json', default: '[]' },
    { name: 'systemConfig.json', default: JSON.stringify({
      llmEnabled: true,
      slackFallbackEnabled: true,
      maxRetries: 3,
      requestTimeout: 30000,
      dataRetentionDays: 90
    }, null, 2) }
  ];

  for (const file of jsonFiles) {
    const filePath = path.join(DATA_DIR, file.name);
    let fixed = false;
    
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      JSON.parse(content); // Test if valid JSON
      console.log(`  ✅ ${file.name} - Valid`);
    } catch (error) {
      // File is corrupted or doesn't exist
      console.log(`  ⚠️  ${file.name} - Fixing...`);
      await fs.writeFile(filePath, file.default, 'utf-8');
      fixed = true;
    }
    
    if (fixed) {
      console.log(`  ✅ ${file.name} - Fixed`);
    }
  }

  // 3. Generate secure JWT secret if using default
  console.log('\n3️⃣ Checking environment configuration...');
  const envPath = path.join(__dirname, '../.env');
  try {
    let envContent = await fs.readFile(envPath, 'utf-8');
    
    if (envContent.includes('your-secret-key-change-this-in-production')) {
      const newSecret = crypto.randomBytes(32).toString('hex');
      envContent = envContent.replace(
        'your-secret-key-change-this-in-production',
        newSecret
      );
      await fs.writeFile(envPath, envContent, 'utf-8');
      console.log('  ✅ Generated secure JWT_SECRET');
    } else {
      console.log('  ✅ JWT_SECRET already configured');
    }
  } catch (error) {
    console.log('  ⚠️  No .env file found');
  }

  // 4. Create data integrity report
  console.log('\n4️⃣ Generating data integrity report...');
  const report = {
    timestamp: new Date().toISOString(),
    files: {}
  };

  for (const file of jsonFiles) {
    const filePath = path.join(DATA_DIR, file.name);
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(content);
      const stats = await fs.stat(filePath);
      
      report.files[file.name] = {
        size: stats.size,
        modified: stats.mtime,
        recordCount: Array.isArray(data) ? data.length : 'N/A'
      };
    } catch (error) {
      report.files[file.name] = { error: error.message };
    }
  }

  const reportPath = path.join(DATA_DIR, 'migration-report.json');
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2), 'utf-8');
  console.log('  ✅ Report saved to migration-report.json');

  console.log('\n✅ Migration complete!');
}

// Run migration
migrateData().catch(error => {
  console.error('\n❌ Migration failed:', error);
  process.exit(1);
});
