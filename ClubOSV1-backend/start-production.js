#!/usr/bin/env node

// Simple production start script for Railway
const path = require('path');

// Set production environment
process.env.NODE_ENV = 'production';

// Set dummy VAPID keys if not provided to pass validation
// Push notifications will be disabled without real keys
if (!process.env.VAPID_PUBLIC_KEY) {
  process.env.VAPID_PUBLIC_KEY = 'BKd0SYVGPMqPGKCnENjQPruMF3eXTt8aNxvYr5L6WlZRQvpkYl7q0J3Q7Px6Xm0FDQfUVvXrZfCbYLxXGyaL_dummy_key_push_notifications_disabled';
}
if (!process.env.VAPID_PRIVATE_KEY) {
  process.env.VAPID_PRIVATE_KEY = 'dGVzdF9wcml2YXRlX2tleV9mb3JfcmFpbHdheV9kZXBsb3ltZW50X29ubHk';
}
if (!process.env.VAPID_EMAIL) {
  process.env.VAPID_EMAIL = 'mailto:noreply@example.com';
}

// Start the server
require(path.join(__dirname, 'dist', 'index.js'));