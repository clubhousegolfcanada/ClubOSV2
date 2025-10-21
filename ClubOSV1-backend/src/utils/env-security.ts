import { logger } from './logger';

interface EnvSecurityCheck {
  key: string;
  validator: (value: string | undefined) => boolean;
  message: string;
  critical: boolean;
}

const securityChecks: EnvSecurityCheck[] = [
  {
    key: 'JWT_SECRET',
    validator: (val) => !!val && val !== 'your-secret-jwt-key' && val.length >= 32,
    message: 'JWT_SECRET must be at least 32 characters and not default',
    critical: true
  },
  {
    key: 'ENCRYPTION_KEY',
    validator: (val) => {
      if (!val) return false;
      if (val === 'your-32-character-encryption-key') return false;
      if (val.length !== 32) {
        // If it's 64 chars (common base64 mistake), suggest trimming
        if (val.length === 64) {
          logger.debug(`\n💡 TIP: Your ENCRYPTION_KEY is 64 characters (base64 encoded?).`);
          logger.debug(`   You can use the first 32 characters: ${val.substring(0, 32)}`);
          logger.debug(`   Or generate a new one with: node scripts/generate-encryption-key.js\n`);
        }
        return false;
      }
      return true;
    },
    message: `ENCRYPTION_KEY must be exactly 32 characters (current: ${process.env.ENCRYPTION_KEY?.length || 0} chars)`,
    critical: false
  },
  {
    key: 'DATABASE_URL',
    validator: (val) => !!val && val.includes('postgresql://') && !val.includes('password123') && !val.includes('postgres:postgres'),
    message: 'DATABASE_URL must be valid PostgreSQL URL with secure password',
    critical: true
  },
  {
    key: 'OPENAI_API_KEY',
    validator: (val) => !!val && (val.startsWith('sk-') || val.startsWith('sk-proj-')),
    message: 'OPENAI_API_KEY must be valid OpenAI key',
    critical: false
  },
  {
    key: 'NODE_ENV',
    validator: (val) => ['development', 'production', 'test'].includes(val || ''),
    message: 'NODE_ENV must be development, production, or test',
    critical: true
  },
  {
    key: 'SLACK_WEBHOOK_URL',
    validator: (val) => !val || val.startsWith('https://hooks.slack.com/'),
    message: 'SLACK_WEBHOOK_URL must be a valid Slack webhook URL',
    critical: false
  },
  {
    key: 'OPENPHONE_API_KEY',
    validator: (val) => !val || val.length >= 20,
    message: 'OPENPHONE_API_KEY must be at least 20 characters',
    critical: false
  },
  {
    key: 'SENTRY_DSN',
    validator: (val) => !val || val.startsWith('https://') && val.includes('@'),
    message: 'SENTRY_DSN must be a valid Sentry DSN',
    critical: false
  },
  {
    key: 'VAPID_PUBLIC_KEY',
    validator: (val) => !val || val.length >= 40,
    message: 'VAPID_PUBLIC_KEY must be at least 40 characters',
    critical: false
  },
  {
    key: 'VAPID_PRIVATE_KEY',
    validator: (val) => !val || val.length >= 20,
    message: 'VAPID_PRIVATE_KEY must be at least 20 characters',
    critical: false
  }
];

export function validateEnvironmentSecurity(): void {
  logger.debug('🔐 Validating environment security...\n');
  
  const errors: string[] = [];
  const warnings: string[] = [];
  let validCount = 0;
  
  for (const check of securityChecks) {
    const value = process.env[check.key];
    const isValid = check.validator(value);
    
    if (!isValid) {
      if (check.critical) {
        errors.push(`❌ ${check.message}`);
        logger.error(`Environment security check failed: ${check.key}`, { message: check.message });
      } else {
        warnings.push(`⚠️  ${check.message}`);
        logger.warn(`Environment security warning: ${check.key}`, { message: check.message });
      }
    } else {
      validCount++;
      logger.debug(`✅ ${check.key} validated`);
    }
  }
  
  // Production-specific checks
  if (process.env.NODE_ENV === 'production') {
    // Check for weak secrets
    if (process.env.JWT_SECRET?.includes('secret') || process.env.JWT_SECRET?.includes('test')) {
      errors.push('❌ JWT_SECRET contains weak words like "secret" or "test" - use a random value');
    }
    
    if (process.env.ENCRYPTION_KEY?.includes('encryption') || process.env.ENCRYPTION_KEY?.includes('key')) {
      errors.push('❌ ENCRYPTION_KEY contains predictable words - use a random value');
    }
    
    // Check for required production services
    if (!process.env.SENTRY_DSN) {
      warnings.push('⚠️  SENTRY_DSN not set - error monitoring disabled in production');
    }
    
    if (!process.env.RATE_LIMIT_MAX || parseInt(process.env.RATE_LIMIT_MAX) > 100) {
      warnings.push('⚠️  RATE_LIMIT_MAX not set or too high for production');
    }
    
    // SSL/TLS check
    if (!process.env.DATABASE_URL?.includes('sslmode=require')) {
      warnings.push('⚠️  DATABASE_URL should include sslmode=require in production');
    }
  }
  
  // Development-specific warnings
  if (process.env.NODE_ENV === 'development') {
    if (process.env.JWT_SECRET === 'your-secret-jwt-key') {
      warnings.push('⚠️  Using default JWT_SECRET in development - consider using a custom value');
    }
  }
  
  // Print summary
  logger.debug(`\n📊 Security Check Summary:`);
  logger.debug(`   ✅ Valid: ${validCount}/${securityChecks.length}`);
  logger.debug(`   ❌ Errors: ${errors.length}`);
  logger.debug(`   ⚠️  Warnings: ${warnings.length}`);
  
  // Print results
  if (warnings.length > 0) {
    logger.debug('\n⚠️  Warnings:');
    warnings.forEach(w => logger.debug(w));
  }
  
  if (errors.length > 0) {
    logger.debug('\n❌ Critical Errors:');
    errors.forEach(e => logger.debug(e));
    
    // Log critical failure
    logger.error('Environment security validation failed', { 
      errors: errors.length, 
      warnings: warnings.length 
    });
    
    throw new Error('Environment security validation failed. Please fix the critical errors above.');
  }
  
  logger.debug('\n✅ Environment security validation passed!\n');
  logger.info('Environment security validation passed', { 
    valid: validCount, 
    total: securityChecks.length,
    warnings: warnings.length 
  });
}

// Additional helper to generate secure secrets
export function generateSecureSecret(length: number = 32): string {
  const crypto = require('crypto');
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?';
  let secret = '';
  
  for (let i = 0; i < length; i++) {
    secret += chars[crypto.randomInt(0, chars.length)];
  }
  
  return secret;
}

// Export a function to check specific environment variables
export function checkRequiredEnvVars(requiredVars: string[]): void {
  const missing = requiredVars.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}