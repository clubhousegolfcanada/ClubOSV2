#!/usr/bin/env node

/**
 * ClubOSV1 Configuration Checker
 * This script validates your environment configuration
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔍 ClubOSV1 Configuration Checker\n');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m'
};

const log = {
  info: (msg) => console.log(`${colors.blue}ℹ${colors.reset}  ${msg}`),
  success: (msg) => console.log(`${colors.green}✓${colors.reset}  ${msg}`),
  warning: (msg) => console.log(`${colors.yellow}⚠${colors.reset}  ${msg}`),
  error: (msg) => console.log(`${colors.red}✗${colors.reset}  ${msg}`)
};

// Check Node.js version
const checkNodeVersion = () => {
  const nodeVersion = process.version;
  const major = parseInt(nodeVersion.split('.')[0].substring(1));
  
  if (major >= 18) {
    log.success(`Node.js version: ${nodeVersion}`);
    return true;
  } else {
    log.error(`Node.js version ${nodeVersion} is too old. Required: v18.0.0 or higher`);
    return false;
  }
};

// Check if npm is installed
const checkNpm = () => {
  try {
    const npmVersion = execSync('npm --version', { encoding: 'utf8' }).trim();
    log.success(`npm version: ${npmVersion}`);
    return true;
  } catch {
    log.error('npm is not installed');
    return false;
  }
};

// Check if .env file exists
const checkEnvFile = () => {
  const envPath = path.join(__dirname, '../.env');
  const envExamplePath = path.join(__dirname, '../.env.example');
  const envTemplatePath = path.join(__dirname, '../.env.template');
  
  if (fs.existsSync(envPath)) {
    log.success('.env file exists');
    return true;
  } else {
    log.warning('.env file not found');
    
    if (fs.existsSync(envExamplePath)) {
      log.info('Run: cp .env.example .env');
    } else if (fs.existsSync(envTemplatePath)) {
      log.info('Run: cp .env.template .env');
    }
    
    return false;
  }
};

// Check environment variables
const checkEnvVars = () => {
  if (!fs.existsSync(path.join(__dirname, '../.env'))) {
    return false;
  }
  
  require('dotenv').config({ path: path.join(__dirname, '../.env') });
  
  const required = ['PORT', 'NODE_ENV', 'JWT_SECRET', 'SESSION_SECRET'];
  const optional = ['OPENAI_API_KEY', 'SLACK_WEBHOOK_URL'];
  
  let hasErrors = false;
  
  console.log('\n📋 Required Variables:');
  required.forEach(key => {
    const value = process.env[key];
    if (!value) {
      log.error(`${key} is not set`);
      hasErrors = true;
    } else if (key.includes('SECRET') && value.includes('dev_2024')) {
      log.warning(`${key} is using default value - should be changed for production`);
    } else {
      log.success(`${key} is set`);
    }
  });
  
  console.log('\n📋 Optional Variables:');
  optional.forEach(key => {
    const value = process.env[key];
    if (!value || value.includes('your_') || value.includes('YOUR')) {
      log.warning(`${key} is not configured - related features will be disabled`);
    } else {
      log.success(`${key} is configured`);
    }
  });
  
  return !hasErrors;
};

// Check dependencies
const checkDependencies = () => {
  const packagePath = path.join(__dirname, '../package.json');
  
  if (!fs.existsSync(packagePath)) {
    log.error('package.json not found');
    return false;
  }
  
  const nodeModulesPath = path.join(__dirname, '../node_modules');
  
  if (!fs.existsSync(nodeModulesPath)) {
    log.warning('node_modules not found - run: npm install');
    return false;
  }
  
  log.success('Dependencies folder exists');
  
  // Check for key dependencies
  const keyDeps = ['express', 'helmet', 'jsonwebtoken', 'winston'];
  let allFound = true;
  
  keyDeps.forEach(dep => {
    const depPath = path.join(nodeModulesPath, dep);
    if (!fs.existsSync(depPath)) {
      log.error(`Missing dependency: ${dep}`);
      allFound = false;
    }
  });
  
  if (allFound) {
    log.success('All key dependencies found');
  }
  
  return allFound;
};

// Check data directory
const checkDataDirectory = () => {
  const dataPath = path.join(__dirname, '../src/data');
  
  if (!fs.existsSync(dataPath)) {
    log.warning('Data directory not found - will be created on first run');
    return true;
  }
  
  log.success('Data directory exists');
  return true;
};

// Check ports
const checkPorts = () => {
  require('dotenv').config({ path: path.join(__dirname, '../.env') });
  const port = process.env.PORT || 3001;
  
  // Simple port check - in production, use proper port checking
  log.info(`Backend will run on port: ${port}`);
  log.info('Frontend expects port: 3000');
  
  return true;
};

// Main checker
const runChecks = () => {
  console.log('Running configuration checks...\n');
  
  const checks = [
    { name: 'Node.js Version', fn: checkNodeVersion },
    { name: 'npm Installation', fn: checkNpm },
    { name: 'Environment File', fn: checkEnvFile },
    { name: 'Environment Variables', fn: checkEnvVars },
    { name: 'Dependencies', fn: checkDependencies },
    { name: 'Data Directory', fn: checkDataDirectory },
    { name: 'Port Configuration', fn: checkPorts }
  ];
  
  let passed = 0;
  let failed = 0;
  
  checks.forEach(check => {
    console.log(`\n🔍 Checking ${check.name}...`);
    if (check.fn()) {
      passed++;
    } else {
      failed++;
    }
  });
  
  console.log('\n' + '='.repeat(50));
  console.log(`\n📊 Results: ${colors.green}${passed} passed${colors.reset}, ${colors.red}${failed} failed${colors.reset}\n`);
  
  if (failed === 0) {
    console.log(`${colors.green}✅ All checks passed! Your ClubOSV1 backend is ready to run.${colors.reset}`);
    console.log('\nTo start the backend: npm run dev');
  } else {
    console.log(`${colors.red}❌ Some checks failed. Please fix the issues above.${colors.reset}`);
    console.log('\nFor help, check the README.md or .env.template');
  }
  
  process.exit(failed > 0 ? 1 : 0);
};

// Run the checks
runChecks();
