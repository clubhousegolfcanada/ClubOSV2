import crypto from 'crypto';
import { logger } from './logger';

// Encryption configuration
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
const SALT_LENGTH = 64;
const KEY_LENGTH = 32;
const ITERATIONS = 100000;

// Get encryption key from environment or generate a warning
const MASTER_KEY = process.env.ENCRYPTION_KEY || process.env.DATABASE_ENCRYPTION_KEY;

if (!MASTER_KEY) {
  logger.error('WARNING: No encryption key found. Set ENCRYPTION_KEY in environment variables.');
}

/**
 * Derives an encryption key from the master key and a salt
 */
function deriveKey(salt: Buffer): Buffer {
  if (!MASTER_KEY) {
    throw new Error('Encryption key not configured');
  }
  return crypto.pbkdf2Sync(MASTER_KEY, salt, ITERATIONS, KEY_LENGTH, 'sha256');
}

/**
 * Encrypts sensitive data
 */
export function encrypt(text: string): string {
  if (!MASTER_KEY) {
    logger.warn('Encryption skipped - no encryption key configured');
    return text; // Return unencrypted in development
  }

  try {
    // Generate random salt and IV
    const salt = crypto.randomBytes(SALT_LENGTH);
    const iv = crypto.randomBytes(IV_LENGTH);
    
    // Derive key from master key and salt
    const key = deriveKey(salt);
    
    // Create cipher
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    // Encrypt the text
    const encrypted = Buffer.concat([
      cipher.update(text, 'utf8'),
      cipher.final()
    ]);
    
    // Get the auth tag
    const tag = cipher.getAuthTag();
    
    // Combine salt, iv, tag, and encrypted data
    const combined = Buffer.concat([salt, iv, tag, encrypted]);
    
    // Return base64 encoded
    return combined.toString('base64');
  } catch (error) {
    logger.error('Encryption failed:', error);
    throw new Error('Failed to encrypt data');
  }
}

/**
 * Decrypts sensitive data
 */
export function decrypt(encryptedData: string): string {
  if (!MASTER_KEY) {
    logger.warn('Decryption skipped - no encryption key configured');
    return encryptedData; // Return as-is in development
  }

  try {
    // Decode from base64
    const combined = Buffer.from(encryptedData, 'base64');
    
    // Extract components
    const salt = combined.slice(0, SALT_LENGTH);
    const iv = combined.slice(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
    const tag = combined.slice(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
    const encrypted = combined.slice(SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
    
    // Derive key from master key and salt
    const key = deriveKey(salt);
    
    // Create decipher
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    
    // Decrypt
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final()
    ]);
    
    return decrypted.toString('utf8');
  } catch (error) {
    logger.error('Decryption failed:', error);
    throw new Error('Failed to decrypt data');
  }
}

/**
 * Hashes data for indexing (one-way)
 */
export function hash(data: string): string {
  return crypto
    .createHash('sha256')
    .update(data)
    .digest('hex');
}

/**
 * Generates a secure random token
 */
export function generateSecureToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Anonymizes phone numbers for logging
 */
export function anonymizePhoneNumber(phoneNumber: string): string {
  if (!phoneNumber || phoneNumber.length < 6) {
    return 'INVALID';
  }
  
  // Show country code and last 4 digits only
  const countryCode = phoneNumber.match(/^\+\d{1,3}/)?.[0] || '+?';
  const lastFour = phoneNumber.slice(-4);
  
  return `${countryCode}***${lastFour}`;
}

/**
 * Masks sensitive data in objects for logging
 */
export function maskSensitiveData(obj: any): any {
  if (!obj) return obj;
  
  const sensitive = ['password', 'token', 'apiKey', 'api_key', 'authorization', 'cookie', 'session'];
  const masked = { ...obj };
  
  for (const key of Object.keys(masked)) {
    const lowerKey = key.toLowerCase();
    
    // Check if key contains sensitive terms
    if (sensitive.some(term => lowerKey.includes(term))) {
      masked[key] = '***REDACTED***';
    }
    // Mask phone numbers
    else if (lowerKey.includes('phone') && typeof masked[key] === 'string') {
      masked[key] = anonymizePhoneNumber(masked[key]);
    }
    // Recursively mask nested objects
    else if (typeof masked[key] === 'object' && !Array.isArray(masked[key])) {
      masked[key] = maskSensitiveData(masked[key]);
    }
  }
  
  return masked;
}