#!/usr/bin/env node

const webpush = require('web-push');

console.log('Generating VAPID keys for web push notifications...\n');

const vapidKeys = webpush.generateVAPIDKeys();

console.log('Add these to your .env file:\n');
console.log(`VAPID_PUBLIC_KEY=${vapidKeys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${vapidKeys.privateKey}`);
console.log(`VAPID_EMAIL=mailto:support@clubhouse247golf.com`);

console.log('\n\nPublic key for frontend (.env.local):');
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${vapidKeys.publicKey}`);

console.log('\n✅ VAPID keys generated successfully!');
console.log('⚠️  Keep your private key secure and never commit it to version control.');