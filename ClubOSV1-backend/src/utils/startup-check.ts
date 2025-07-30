import { logger } from './logger';

export async function performStartupChecks() {
  logger.info('🔍 Performing startup checks...');
  
  const checks = {
    node_version: process.version,
    memory: process.memoryUsage(),
    env: {
      NODE_ENV: process.env.NODE_ENV,
      PORT: process.env.PORT,
      DATABASE_URL: process.env.DATABASE_URL ? '✅ Set' : '❌ Missing',
      OPENAI_API_KEY: process.env.OPENAI_API_KEY ? '✅ Set' : '❌ Missing',
      SLACK_APP_TOKEN: process.env.SLACK_APP_TOKEN ? '✅ Set' : '⚠️ Optional',
      OPENPHONE_API_KEY: process.env.OPENPHONE_API_KEY ? '✅ Set' : '⚠️ Optional',
      OPENPHONE_DEFAULT_NUMBER: process.env.OPENPHONE_DEFAULT_NUMBER ? '✅ Set' : '⚠️ Optional',
      JWT_SECRET: process.env.JWT_SECRET ? '✅ Set' : '❌ Missing',
    },
    working_directory: process.cwd(),
    platform: process.platform,
    arch: process.arch,
  };
  
  logger.info('System info:', checks);
  
  // Check critical environment variables
  const criticalVars = ['DATABASE_URL', 'OPENAI_API_KEY', 'JWT_SECRET'];
  const missingVars = criticalVars.filter(v => !process.env[v]);
  
  if (missingVars.length > 0) {
    logger.error('❌ Missing critical environment variables:', missingVars);
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
  }
  
  logger.info('✅ All critical environment variables present');
  
  // Check if dist folder exists (for production)
  if (process.env.NODE_ENV === 'production') {
    const fs = require('fs');
    const path = require('path');
    const distPath = path.join(process.cwd(), 'dist');
    
    if (!fs.existsSync(distPath)) {
      logger.error('❌ dist folder not found! Did the build fail?');
      throw new Error('dist folder not found');
    }
    
    logger.info('✅ dist folder exists');
  }
  
  return checks;
}