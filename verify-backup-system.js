#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');

async function verifyBackupSystem() {
  console.log('🔍 ClubOS Backup System Verification');
  console.log('===================================\n');
  
  const checks = {
    frontend: false,
    backend: false,
    dataFiles: false,
    backupDir: false
  };
  
  try {
    // Check 1: Frontend implementation
    console.log('1. Checking frontend implementation...');
    const operationsPage = await fs.readFile(
      path.join(__dirname, 'ClubOSV1-frontend/src/pages/operations.tsx'), 
      'utf-8'
    );
    
    if (operationsPage.includes('createBackup') && operationsPage.includes('restoreBackup')) {
      console.log('   ✅ Frontend backup/restore functions found');
      
      // Check for the exact API endpoints
      const hasBackupEndpoint = operationsPage.includes('`${API_URL}/backup`');
      const hasRestoreEndpoint = operationsPage.includes('`${API_URL}/backup/restore`');
      
      if (hasBackupEndpoint && hasRestoreEndpoint) {
        console.log('   ✅ Correct API endpoints in frontend');
        checks.frontend = true;
      } else {
        console.log('   ❌ API endpoints check:');
        console.log(`      - Backup endpoint (${hasBackupEndpoint ? '✓' : '✗'}): \${API_URL}/backup`);
        console.log(`      - Restore endpoint (${hasRestoreEndpoint ? '✓' : '✗'}): \${API_URL}/backup/restore`);
      }
    } else {
      console.log('   ❌ Missing backup/restore functions in frontend');
    }
    
    // Check 2: Backend routes
    console.log('\n2. Checking backend routes...');
    const backupRoute = await fs.readFile(
      path.join(__dirname, 'ClubOSV1-backend/src/routes/backup.ts'),
      'utf-8'
    );
    
    if (backupRoute.includes("router.get('/'") && backupRoute.includes("router.post('/restore'")) {
      console.log('   ✅ Backend routes properly configured');
      if (backupRoute.includes('notUsefulFeedback') && backupRoute.includes('allFeedback')) {
        console.log('   ✅ Feedback data included in backups');
        checks.backend = true;
      } else {
        console.log('   ⚠️  Feedback data not included in backups');
      }
    } else {
      console.log('   ❌ Backend routes misconfigured');
    }
    
    // Check 3: Data files
    console.log('\n3. Checking data files...');
    const dataDir = path.join(__dirname, 'ClubOSV1-backend/src/data');
    const requiredFiles = [
      'users.json',
      'userLogs.json',
      'authLogs.json',
      'systemConfig.json',
      'not_useful_feedback.json',
      'all_feedback.json'
    ];
    
    let allFilesExist = true;
    for (const file of requiredFiles) {
      try {
        await fs.access(path.join(dataDir, file));
        console.log(`   ✅ ${file} exists`);
      } catch {
        console.log(`   ❌ ${file} missing`);
        allFilesExist = false;
      }
    }
    checks.dataFiles = allFilesExist;
    
    // Check 4: Backup directory
    console.log('\n4. Checking backup directory...');
    try {
      await fs.access(path.join(dataDir, 'backups'));
      console.log('   ✅ Backup directory exists');
      checks.backupDir = true;
    } catch {
      console.log('   ❌ Backup directory missing');
    }
    
    // Summary
    console.log('\n📊 Summary');
    console.log('==========');
    const allPassed = Object.values(checks).every(v => v);
    
    if (allPassed) {
      console.log('✅ All checks passed! Backup system is properly configured.');
    } else {
      console.log('❌ Some checks failed. Please review the issues above.');
      console.log('\nFailed checks:');
      Object.entries(checks).forEach(([check, passed]) => {
        if (!passed) console.log(`   - ${check}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error during verification:', error.message);
  }
}

// Run verification
verifyBackupSystem();
