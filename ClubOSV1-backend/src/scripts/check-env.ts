// Save this as check-env.ts in your backend src/scripts folder
import * as dotenv from 'dotenv';
dotenv.config();

console.log('🔍 Checking Environment Variables...\n');

// Check required variables
const requiredVars = {
  'DATABASE_URL': process.env.DATABASE_URL ? '✅ Set' : '❌ Missing',
  'NODE_ENV': process.env.NODE_ENV || '❌ Missing',
  'SLACK_WEBHOOK_URL': process.env.SLACK_WEBHOOK_URL ? '✅ Set' : '❌ Missing',
  'SLACK_CHANNEL': process.env.SLACK_CHANNEL || '❌ Missing',
  'JWT_SECRET': process.env.JWT_SECRET ? '✅ Set' : '❌ Missing',
};

// Check optional variables
const optionalVars = {
  'OPENAI_API_KEY': process.env.OPENAI_API_KEY ? '✅ Set' : '⚠️  Not set',
  'FACILITIES_SLACK_CHANNEL': process.env.FACILITIES_SLACK_CHANNEL || '⚠️  Not set',
  'FACILITIES_SLACK_USER': process.env.FACILITIES_SLACK_USER || '⚠️  Not set',
};

console.log('Required Variables:');
console.log('==================');
for (const [key, value] of Object.entries(requiredVars)) {
  console.log(`${key}: ${value}`);
}

console.log('\nOptional Variables:');
console.log('==================');
for (const [key, value] of Object.entries(optionalVars)) {
  console.log(`${key}: ${value}`);
}

console.log('\nCurrent Values:');
console.log('===============');
console.log(`NODE_ENV: ${process.env.NODE_ENV}`);
console.log(`SLACK_CHANNEL: ${process.env.SLACK_CHANNEL}`);
console.log(`Database: ${process.env.DATABASE_URL ? 'PostgreSQL connected' : 'No database'}`);

// Test database connection
if (process.env.DATABASE_URL) {
  console.log('\n📊 Testing Database Connection...');
  const { query } = require('../utils/db');
  
  query('SELECT current_database(), current_user, version()')
    .then(result => {
      const row = result.rows[0];
      console.log('✅ Database connected successfully!');
      console.log(`   Database: ${row.current_database}`);
      console.log(`   User: ${row.current_user}`);
      console.log(`   Version: ${row.version.split(',')[0]}`);
      
      // Check if our tables exist
      return query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN ('users', 'feedback', 'slack_messages', 'migrations')
        ORDER BY table_name
      `);
    })
    .then(result => {
      console.log('\n📋 Existing Tables:');
      result.rows.forEach(row => {
        console.log(`   - ${row.table_name}`);
      });
      
      if (!result.rows.find(r => r.table_name === 'slack_messages')) {
        console.log('\n⚠️  Note: slack_messages table not found. Run migrations!');
      }
      
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Database connection failed:', error.message);
      process.exit(1);
    });
} else {
  console.log('\n❌ No DATABASE_URL found!');
  process.exit(1);
}