#!/usr/bin/env node

const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

const API_URL = 'http://localhost:3001/api';
const TOKEN = process.env.CLUBOS_TOKEN || '';

async function testBackupRestore() {
  console.log('🧪 Testing ClubOS Backup and Restore Functionality');
  console.log('================================================');
  
  if (!TOKEN) {
    console.error('❌ Error: Please set CLUBOS_TOKEN environment variable');
    console.log('   Run: export CLUBOS_TOKEN="your-admin-token"');
    process.exit(1);
  }

  try {
    // Test 1: Create backup
    console.log('\n📥 Test 1: Creating backup...');
    const backupResponse = await axios.get(`${API_URL}/backup`, {
      headers: { Authorization: `Bearer ${TOKEN}` }
    });
    
    if (backupResponse.data.success) {
      console.log('✅ Backup created successfully');
      console.log(`   - Users: ${backupResponse.data.data.users.length}`);
      console.log(`   - User logs: ${backupResponse.data.data.userLogs.length}`);
      console.log(`   - Auth logs: ${backupResponse.data.data.authLogs.length}`);
      console.log(`   - Timestamp: ${backupResponse.data.data.timestamp}`);
      
      // Save backup to file
      const backupFile = path.join(__dirname, `test-backup-${Date.now()}.json`);
      await fs.writeFile(backupFile, JSON.stringify(backupResponse.data.data, null, 2));
      console.log(`   - Saved to: ${backupFile}`);
      
      // Test 2: Verify backup structure
      console.log('\n🔍 Test 2: Verifying backup structure...');
      const backup = backupResponse.data.data;
      const requiredFields = ['users', 'userLogs', 'authLogs', 'systemConfig', 'timestamp', 'version'];
      const missingFields = requiredFields.filter(field => !(field in backup));
      
      if (missingFields.length === 0) {
        console.log('✅ All required fields present');
      } else {
        console.log(`❌ Missing fields: ${missingFields.join(', ')}`);
      }
      
      // Test 3: Test restore
      console.log('\n📤 Test 3: Testing restore functionality...');
      console.log('   (Skipping actual restore to avoid data loss)');
      console.log('   To test restore manually:');
      console.log(`   1. Upload ${backupFile} through the UI`);
      console.log('   2. Or run: curl -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d @${backupFile} ${API_URL}/backup/restore');
      
    } else {
      console.error('❌ Backup failed:', backupResponse.data.message);
    }
    
  } catch (error) {
    console.error('❌ Error during testing:', error.response?.data || error.message);
    if (error.response?.status === 401) {
      console.log('   Token might be expired. Please login again to get a new token.');
    } else if (error.response?.status === 403) {
      console.log('   You need admin privileges to access backup/restore functionality.');
    }
  }
  
  console.log('\n✨ Testing complete!');
}

// Run the test
testBackupRestore();
