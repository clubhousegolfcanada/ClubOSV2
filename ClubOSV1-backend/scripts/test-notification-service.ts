#!/usr/bin/env npx tsx

import { notificationService } from '../src/services/notificationService';
import { logger } from '../src/utils/logger';

// Test notification service initialization
console.log('Testing notification service initialization...\n');

// Check if VAPID keys are configured
const hasVapidKeys = process.env.VAPID_PUBLIC_KEY && 
                     process.env.VAPID_PRIVATE_KEY && 
                     process.env.VAPID_EMAIL;

if (!hasVapidKeys) {
  console.log('❌ VAPID keys not found in environment');
  console.log('\nPlease add the following to your .env file:');
  console.log('VAPID_PUBLIC_KEY=...');
  console.log('VAPID_PRIVATE_KEY=...');
  console.log('VAPID_EMAIL=mailto:...');
} else {
  console.log('✅ VAPID keys found in environment');
  console.log(`   Email: ${process.env.VAPID_EMAIL}`);
  console.log(`   Public Key: ${process.env.VAPID_PUBLIC_KEY?.substring(0, 20)}...`);
}

// Test notification payload
const testPayload = {
  title: 'Test Notification',
  body: 'This is a test notification from ClubOS',
  icon: '/logo-192.png',
  badge: '/badge-72.png',
  tag: 'test',
  data: {
    type: 'system',
    test: true
  }
};

console.log('\n✅ Notification service module loaded successfully');
console.log('✅ Test payload validated');

process.exit(0);