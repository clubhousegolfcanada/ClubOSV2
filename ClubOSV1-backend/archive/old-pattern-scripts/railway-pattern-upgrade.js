#!/usr/bin/env node

/**
 * Railway Pattern Upgrade Runner
 * 
 * This script is designed to be run on Railway's platform
 * where OPENAI_API_KEY and DATABASE_URL are already configured
 * 
 * To run on Railway:
 * 1. Go to Railway dashboard
 * 2. Select the backend service
 * 3. Go to the "Deploy" tab
 * 4. Run command: node scripts/railway-pattern-upgrade.js
 */

const { spawn } = require('child_process');
const path = require('path');

console.log('========================================');
console.log('V3-PLS Pattern Upgrade - Railway Runner');
console.log('========================================');
console.log('');

// Check environment
const hasOpenAI = !!process.env.OPENAI_API_KEY;
const hasDatabase = !!process.env.DATABASE_URL;

console.log('Environment Check:');
console.log(`✅ OPENAI_API_KEY: ${hasOpenAI ? 'Configured' : 'Missing!'}`);
console.log(`✅ DATABASE_URL: ${hasDatabase ? 'Configured' : 'Missing!'}`);
console.log('');

if (!hasOpenAI || !hasDatabase) {
  console.error('❌ Missing required environment variables!');
  console.error('This script must be run on Railway where these are configured.');
  process.exit(1);
}

console.log('Starting GPT-4 pattern upgrade...');
console.log('This will process 158 patterns and may take 3-5 minutes.');
console.log('');

// Run the TypeScript upgrade script
const scriptPath = path.join(__dirname, 'upgrade-patterns-gpt4.ts');
const child = spawn('npx', ['tsx', scriptPath], {
  stdio: 'inherit',
  env: process.env
});

child.on('error', (error) => {
  console.error('Failed to start upgrade script:', error);
  process.exit(1);
});

child.on('exit', (code) => {
  console.log('');
  console.log('========================================');
  if (code === 0) {
    console.log('✅ Pattern upgrade completed successfully!');
    console.log('');
    console.log('Next steps:');
    console.log('1. Check the logs above for upgrade statistics');
    console.log('2. Verify patterns now have templates with {{variables}}');
    console.log('3. Implement variable replacement in patternLearningService.ts');
    console.log('4. Test pattern matching with real messages');
  } else {
    console.log(`❌ Pattern upgrade failed with code ${code}`);
    console.log('Check the logs above for error details.');
  }
  console.log('========================================');
  process.exit(code);
});