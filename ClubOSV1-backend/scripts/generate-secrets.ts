#!/usr/bin/env node

/**
 * Generate cryptographically secure secrets for ClubOS
 *
 * Usage: npm run generate:secrets
 *
 * This script generates secure random secrets for JWT, sessions, and encryption.
 * The generated secrets are suitable for production use.
 */

import crypto from 'crypto';

console.log('🔐 Generating secure secrets for ClubOS\n');
console.log('═══════════════════════════════════════════════════════════════\n');

// Generate cryptographically secure secrets
const generateSecret = (length: number = 64): string => {
  // Generate random bytes and convert to URL-safe base64
  return crypto.randomBytes(Math.ceil(length * 3/4))
    .toString('base64')
    .slice(0, length)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
};

// Generate secrets with proper length
const jwtSecret = generateSecret(64);
const sessionSecret = generateSecret(64);
const encryptionKey = generateSecret(32);

// Display the secrets
console.log('📋 Copy these environment variables:\n');
console.log(`JWT_SECRET=${jwtSecret}`);
console.log(`SESSION_SECRET=${sessionSecret}`);
console.log(`ENCRYPTION_KEY=${encryptionKey}`);

console.log('\n═══════════════════════════════════════════════════════════════\n');

// Railway instructions
console.log('🚂 Railway Update Instructions:\n');
console.log('1. Go to Railway Dashboard');
console.log('2. Select the ClubOS Backend service');
console.log('3. Navigate to the Variables tab');
console.log('4. Update each secret with the values above');
console.log('5. Add SECRET_MIGRATION_MODE=false to disable migration mode');
console.log('6. Deploy the changes\n');

// Local development instructions
console.log('💻 Local Development (.env file):\n');
console.log('1. Open /ClubOSV1-backend/.env');
console.log('2. Replace the existing secrets with the values above');
console.log('3. Restart the backend server\n');

// Important warnings
console.log('⚠️  IMPORTANT NOTES:\n');
console.log('• All users will need to login again after updating JWT_SECRET');
console.log('• Save these secrets securely - they cannot be recovered');
console.log('• Never commit secrets to version control');
console.log('• Use different secrets for each environment (dev, staging, prod)');
console.log('• Rotate secrets periodically (recommended: every 90 days)\n');

// Security information
console.log('🔒 Security Information:\n');
console.log(`• Secret Length: ${jwtSecret.length} characters (384+ bits of entropy)`);
console.log('• Character Set: Base64 URL-safe (A-Z, a-z, 0-9, -, _)');
console.log('• Generation Method: Cryptographically secure random bytes');
console.log('• Suitable for: Production use\n');

// Migration timeline
console.log('📅 Migration Timeline:\n');
console.log('• Now - Dec 31, 2024: Migration mode active (old secrets work with warnings)');
console.log('• Jan 1, 2025: Strict validation enforced (old secrets will fail)');
console.log('• Recommendation: Update secrets as soon as possible\n');

console.log('═══════════════════════════════════════════════════════════════\n');
console.log('✅ Secret generation complete!\n');

// Exit successfully
process.exit(0);