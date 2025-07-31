#!/usr/bin/env node

// Script to generate VAPID keys for web push notifications
const webpush = require('web-push');

console.log('Generating VAPID keys for ClubOS push notifications...\n');

const vapidKeys = webpush.generateVAPIDKeys();

console.log('Add these to your .env file:\n');
console.log(`VAPID_PUBLIC_KEY=${vapidKeys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${vapidKeys.privateKey}`);
console.log(`VAPID_EMAIL=mailto:support@clubhouse247golf.com`);
console.log('\nAnd for the frontend .env.local:\n');
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${vapidKeys.publicKey}`);

console.log('\n✅ Keys generated successfully!');
console.log('\nNote: Keep the private key secure and never commit it to version control.');