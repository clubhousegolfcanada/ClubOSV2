import dotenv from 'dotenv';
import { existsSync } from 'fs';
import { logger } from './logger';

interface EnvironmentVariables {
  // Required
  PORT: string;
  NODE_ENV: string;
  JWT_SECRET: string;
  SESSION_SECRET: string;
  DATABASE_URL: string;
  
  // Optional - AI
  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
  OPENAI_MAX_TOKENS?: string;
  OPENAI_TEMPERATURE?: string;
  
  // Optional - GPT Assistant IDs
  BOOKING_ACCESS_GPT_ID?: string;
  EMERGENCY_GPT_ID?: string;
  TECH_SUPPORT_GPT_ID?: string;
  BRAND_MARKETING_GPT_ID?: string;
  
  // Optional - Slack
  SLACK_WEBHOOK_URL?: string;
  SLACK_SIGNING_SECRET?: string;
  SLACK_CHANNEL?: string;
  SLACK_USERNAME?: string;
  SLACK_ICON_EMOJI?: string;
  
  // Optional - Frontend
  FRONTEND_URL?: string;
  
  // Optional - Logging
  LOG_LEVEL?: string;
  LOG_TO_FILE?: string;
  LOG_MAX_FILES?: string;
  LOG_MAX_SIZE?: string;
  
  // Optional - Data
  DATA_RETENTION_DAYS?: string;
  BACKUP_RETENTION_DAYS?: string;
  BACKUP_SCHEDULE?: string;
  
  // Optional - Rate Limiting
  RATE_LIMIT_WINDOW_MS?: string;
  RATE_LIMIT_MAX?: string;
  RATE_LIMIT_SKIP_SUCCESSFUL_REQUESTS?: string;
  
  // Optional - Security
  VALID_API_KEYS?: string;
  
  // Optional - Performance
  MAX_REQUEST_SIZE?: string;
  REQUEST_TIMEOUT?: string;
  WORKER_THREADS?: string;
  
  // Optional - Features
  ENABLE_DEMO_MODE?: string;
  ENABLE_DEBUG_ENDPOINTS?: string;
  ENABLE_SWAGGER_DOCS?: string;
}

interface ValidationRule {
  required?: boolean;
  type?: 'string' | 'number' | 'boolean' | 'url' | 'email' | 'cron';
  minLength?: number;
  min?: number;
  max?: number;
  pattern?: RegExp;
  custom?: (value: string) => boolean | string;
  default?: string;
  description?: string;
}

export class EnvironmentValidator {
  private static instance: EnvironmentValidator;
  private validated = false;
  private config: EnvironmentVariables = {} as EnvironmentVariables;
  
  private validationRules: Record<string, ValidationRule> = {
    // Required variables
    PORT: {
      required: true,
      type: 'number',
      min: 1,
      max: 65535,
      description: 'Server port number'
    },
    NODE_ENV: {
      required: true,
      pattern: /^(development|production|test)$/,
      description: 'Application environment'
    },
    JWT_SECRET: {
      required: true,
      minLength: 32,
      description: 'JWT signing secret'
    },
    SESSION_SECRET: {
      required: true,
      minLength: 32,
      description: 'Session encryption secret'
    },
    DATABASE_URL: {
      required: true,
      custom: (value: string) => {
        // Validate PostgreSQL connection string format
        const pgPattern = /^postgres(ql)?:\/\/[^:]+:[^@]+@[^:]+:\d+\/[^?]+/;
        if (!pgPattern.test(value)) {
          return 'DATABASE_URL must be a valid PostgreSQL connection string (postgresql://user:password@host:port/database)';
        }
        return true;
      },
      description: 'PostgreSQL database connection URL'
    },
    
    // Optional variables
    OPENAI_API_KEY: {
      custom: (value: string) => {
        // Allow demo key
        if (value === 'sk-demo-key-for-testing-only') {
          return true;
        }
        
        // Log the key format for debugging (first 10 chars only for security)
        logger.info(`Checking API key format: ${value.substring(0, 10)}...`);
        
        // Check for both old (sk-) and new (sk-proj-) OpenAI key formats
        // Updated patterns to be more flexible
        const validPatterns = [
          /^sk-[a-zA-Z0-9]{48}$/,  // Old format
          /^sk-proj-[a-zA-Z0-9_-]{20,}$/,  // New format with underscores and hyphens
          /^sk-[a-zA-Z0-9_-]{20,}$/  // General format
        ];
        
        const isValid = validPatterns.some(pattern => pattern.test(value));
        
        if (isValid) {
          return true;
        }
        
        return 'OpenAI API key must start with sk- or sk-proj- and be valid';
      },
      description: 'OpenAI API key'
    },
    OPENAI_MODEL: {
      default: 'gpt-4-turbo-preview',
      description: 'OpenAI model name'
    },
    OPENAI_MAX_TOKENS: {
      type: 'number',
      min: 1,
      max: 4000,
      default: '500',
      description: 'Maximum tokens for OpenAI responses'
    },
    OPENAI_TEMPERATURE: {
      type: 'number',
      min: 0,
      max: 1,
      default: '0.3',
      description: 'OpenAI response randomness'
    },
    // GPT Assistant IDs
    BOOKING_ACCESS_GPT_ID: {
      pattern: /^asst_[a-zA-Z0-9]{24}$/,
      description: 'OpenAI Assistant ID for Booking & Access requests'
    },
    EMERGENCY_GPT_ID: {
      pattern: /^asst_[a-zA-Z0-9]{24}$/,
      description: 'OpenAI Assistant ID for Emergency requests'
    },
    TECH_SUPPORT_GPT_ID: {
      pattern: /^asst_[a-zA-Z0-9]{24}$/,
      description: 'OpenAI Assistant ID for Tech Support requests'
    },
    BRAND_MARKETING_GPT_ID: {
      pattern: /^asst_[a-zA-Z0-9]{24}$/,
      description: 'OpenAI Assistant ID for Brand & Marketing requests'
    },
    SLACK_WEBHOOK_URL: {
      type: 'url',
      pattern: /^https:\/\/hooks\.slack\.com\//,
      description: 'Slack incoming webhook URL'
    },
    SLACK_SIGNING_SECRET: {
      minLength: 10,
      description: 'Slack app signing secret for webhook verification'
    },
    FRONTEND_URL: {
      type: 'url',
      default: 'http://localhost:3000',
      description: 'Frontend application URL'
    },
    LOG_LEVEL: {
      pattern: /^(debug|info|warn|error)$/,
      default: 'info',
      description: 'Logging level'
    },
    DATA_RETENTION_DAYS: {
      type: 'number',
      min: 1,
      max: 3650,
      default: '90',
      description: 'Days to retain data'
    },
    RATE_LIMIT_WINDOW_MS: {
      type: 'number',
      min: 1000,
      max: 3600000,
      default: '900000',
      description: 'Rate limit window in milliseconds'
    },
    RATE_LIMIT_MAX: {
      type: 'number',
      min: 1,
      max: 10000,
      default: '100',
      description: 'Maximum requests per window'
    }
  };
  
  private constructor() {}
  
  static getInstance(): EnvironmentValidator {
    if (!EnvironmentValidator.instance) {
      EnvironmentValidator.instance = new EnvironmentValidator();
    }
    return EnvironmentValidator.instance;
  }
  
  validate(): void {
    if (this.validated) return;
    
    logger.info('🔍 Validating environment variables...');
    
    // Check if .env file exists
    const envPath = '.env';
    if (!existsSync(envPath)) {
      logger.warn('⚠️  No .env file found. Using default values or environment variables.');
    }
    
    // Load environment variables
    dotenv.config();
    
    const errors: string[] = [];
    const warnings: string[] = [];
    const info: string[] = [];
    
    // Validate each variable
    Object.entries(this.validationRules).forEach(([key, rule]) => {
      const value = process.env[key];
      
      // Check required
      if (rule.required && !value) {
        errors.push(`${key} is required. ${rule.description || ''}`);
        return;
      }
      
      // Apply default if not set
      if (!value && rule.default) {
        process.env[key] = rule.default;
        this.config[key as keyof EnvironmentVariables] = rule.default;
        info.push(`${key} not set, using default: ${rule.default}`);
        return;
      }
      
      // Skip validation if not set and not required
      if (!value) {
        if (key === 'OPENAI_API_KEY') {
          warnings.push('OPENAI_API_KEY not set - AI features will be disabled');
        } else if (key === 'SLACK_WEBHOOK_URL') {
          warnings.push('SLACK_WEBHOOK_URL not set - Slack integration will be disabled');
        } else if (key.endsWith('_GPT_ID')) {
          const routeName = key.replace('_GPT_ID', '').replace(/_/g, ' ');
          warnings.push(`${key} not set - ${routeName} assistant will not be available`);
        }
        return;
      }
      
      // Store value
      this.config[key as keyof EnvironmentVariables] = value;
      
      // Type validation
      if (rule.type) {
        switch (rule.type) {
          case 'number':
            const num = parseInt(value);
            if (isNaN(num)) {
              errors.push(`${key} must be a number`);
              return;
            }
            if (rule.min !== undefined && num < rule.min) {
              errors.push(`${key} must be at least ${rule.min}`);
            }
            if (rule.max !== undefined && num > rule.max) {
              errors.push(`${key} must be at most ${rule.max}`);
            }
            break;
          
          case 'boolean':
            if (!['true', 'false', '1', '0'].includes(value.toLowerCase())) {
              errors.push(`${key} must be a boolean (true/false)`);
            }
            break;
          
          case 'url':
            try {
              new URL(value);
            } catch {
              errors.push(`${key} must be a valid URL`);
            }
            break;
          
          case 'email':
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
              errors.push(`${key} must be a valid email address`);
            }
            break;
        }
      }
      
      // Pattern validation
      if (rule.pattern && !rule.pattern.test(value)) {
        errors.push(`${key} has invalid format. ${rule.description || ''}`);
      }
      
      // Length validation
      if (rule.minLength && value.length < rule.minLength) {
        errors.push(`${key} must be at least ${rule.minLength} characters`);
      }
      
      // Custom validation
      if (rule.custom) {
        const result = rule.custom(value);
        if (result !== true) {
          errors.push(typeof result === 'string' ? result : `${key} validation failed`);
        }
      }
    });
    
    // Production-specific checks
    if (process.env.NODE_ENV === 'production') {
      if (process.env.JWT_SECRET === 'clubosv1_jwt_secret_dev_2024') {
        errors.push('JWT_SECRET must be changed from default value in production');
      }
      if (process.env.SESSION_SECRET === 'clubosv1_session_secret_dev_2024') {
        errors.push('SESSION_SECRET must be changed from default value in production');
      }
      if (process.env.ENABLE_DEBUG_ENDPOINTS === 'true') {
        warnings.push('Debug endpoints are enabled in production');
      }
    }
    
    // Display validation results
    if (info.length > 0) {
      logger.info('ℹ️  Environment info:');
      info.forEach(msg => logger.info(`   - ${msg}`));
    }
    
    if (warnings.length > 0) {
      logger.warn('⚠️  Environment warnings:');
      warnings.forEach(msg => logger.warn(`   - ${msg}`));
    }
    
    if (errors.length > 0) {
      logger.error('❌ Environment validation failed:');
      errors.forEach(msg => logger.error(`   - ${msg}`));
      logger.error('\n📋 Please check .env.template for configuration guide');
      process.exit(1);
    }
    
    // Log successful validation
    logger.info('✅ Environment validation passed');
    logger.info(`🔧 Environment: ${this.config.NODE_ENV}`);
    logger.info(`🚀 Port: ${this.config.PORT}`);
    logger.info(`🗄️ Database: ${this.config.DATABASE_URL ? 'PostgreSQL configured' : 'Not configured'}`);
    logger.info(`🤖 AI: ${this.config.OPENAI_API_KEY ? 'Enabled' : 'Disabled'}`);
    logger.info(`💬 Slack: ${this.config.SLACK_WEBHOOK_URL ? 'Enabled' : 'Disabled'}`);
    
    this.validated = true;
  }
  
  getConfig(): EnvironmentVariables {
    if (!this.validated) {
      this.validate();
    }
    return this.config;
  }
  
  get<K extends keyof EnvironmentVariables>(key: K): EnvironmentVariables[K] {
    if (!this.validated) {
      this.validate();
    }
    return this.config[key];
  }
  
  getBoolean(key: keyof EnvironmentVariables): boolean {
    const value = this.get(key);
    return value === 'true' || value === '1';
  }
  
  getNumber(key: keyof EnvironmentVariables): number {
    const value = this.get(key);
    return parseInt(value || '0');
  }
  
  isProduction(): boolean {
    return this.get('NODE_ENV') === 'production';
  }
  
  isDevelopment(): boolean {
    return this.get('NODE_ENV') === 'development';
  }
  
  isTest(): boolean {
    return this.get('NODE_ENV') === 'test';
  }
}

export const envValidator = EnvironmentValidator.getInstance();
export const config = envValidator.getConfig();

// Convenience exports
export const isDev = () => envValidator.isDevelopment();
export const isProd = () => envValidator.isProduction();
export const isTest = () => envValidator.isTest();
