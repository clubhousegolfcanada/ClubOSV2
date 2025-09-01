#!/usr/bin/env tsx
/**
 * Test script for server-side logout functionality
 * Tests:
 * 1. Login and get token
 * 2. Use token to access protected endpoint
 * 3. Logout (blacklist token)
 * 4. Try to use blacklisted token (should fail)
 */

import axios from 'axios';
import chalk from 'chalk';

// Use production API for testing since local DB isn't configured
const API_URL = 'https://clubosv2-production.up.railway.app/api';

// Test credentials (you'll need to update these with valid credentials)
const TEST_USER = {
  email: 'test@example.com', // Update with a valid test account
  password: 'Test123!',       // Update with valid password
  rememberMe: false
};

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testLogout() {
  console.log(chalk.blue('\n🔐 Testing Server-Side Logout Implementation\n'));
  
  let token: string | null = null;
  
  try {
    // Step 1: Login to get a token
    console.log(chalk.yellow('1. Logging in to get token...'));
    const loginResponse = await axios.post(`${API_URL}/auth/login`, TEST_USER);
    
    if (loginResponse.data.success && loginResponse.data.data?.token) {
      token = loginResponse.data.data.token;
      console.log(chalk.green('✅ Login successful'));
      console.log(chalk.gray(`   Token: ${token.substring(0, 20)}...`));
    } else {
      throw new Error('Login failed - no token received');
    }
    
    // Step 2: Test that token works
    console.log(chalk.yellow('\n2. Testing token with protected endpoint...'));
    try {
      const meResponse = await axios.get(`${API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log(chalk.green('✅ Token is valid - accessed protected endpoint'));
      console.log(chalk.gray(`   User: ${meResponse.data.data?.email}`));
    } catch (error) {
      throw new Error('Token validation failed');
    }
    
    // Step 3: Logout (blacklist the token)
    console.log(chalk.yellow('\n3. Logging out (blacklisting token)...'));
    try {
      const logoutResponse = await axios.post(
        `${API_URL}/auth/logout`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (logoutResponse.data.success) {
        console.log(chalk.green('✅ Logout successful - token blacklisted'));
      } else {
        throw new Error('Logout failed');
      }
    } catch (error: any) {
      if (error.response?.status === 404) {
        console.log(chalk.red('❌ Logout endpoint not found (404) - migration may not have run yet'));
        console.log(chalk.yellow('   The endpoint exists in code but database migration needs to run'));
        return;
      }
      throw error;
    }
    
    // Step 4: Try to use the blacklisted token (should fail)
    console.log(chalk.yellow('\n4. Testing blacklisted token (should fail)...'));
    await delay(1000); // Small delay to ensure blacklist is processed
    
    try {
      await axios.get(`${API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log(chalk.red('❌ ERROR: Blacklisted token was accepted!'));
      console.log(chalk.yellow('   This means the blacklist check is not working'));
    } catch (error: any) {
      if (error.response?.status === 401) {
        console.log(chalk.green('✅ Blacklisted token was rejected (401)'));
        console.log(chalk.gray(`   Error message: ${error.response.data?.message || 'Unauthorized'}`));
        
        if (error.response.data?.message === 'Token has been revoked') {
          console.log(chalk.green('✅ Correct error message for revoked token'));
        }
      } else {
        console.log(chalk.red('❌ Unexpected error:'), error.message);
      }
    }
    
    // Step 5: Test logout-all endpoint
    console.log(chalk.yellow('\n5. Testing logout-all endpoint...'));
    
    // Get a new token first
    const newLoginResponse = await axios.post(`${API_URL}/auth/login`, TEST_USER);
    const newToken = newLoginResponse.data.data?.token;
    
    if (newToken) {
      try {
        const logoutAllResponse = await axios.post(
          `${API_URL}/auth/logout-all`,
          {},
          { headers: { Authorization: `Bearer ${newToken}` } }
        );
        
        if (logoutAllResponse.data.success) {
          console.log(chalk.green('✅ Logout-all endpoint works'));
          console.log(chalk.gray(`   Note: ${logoutAllResponse.data.note || 'Full implementation pending'}`));
        }
      } catch (error: any) {
        if (error.response?.status === 404) {
          console.log(chalk.yellow('⚠️  Logout-all endpoint not available yet'));
        } else {
          console.log(chalk.red('❌ Logout-all failed:'), error.message);
        }
      }
    }
    
    console.log(chalk.blue('\n✨ Logout Implementation Test Complete!\n'));
    
  } catch (error: any) {
    console.error(chalk.red('\n❌ Test failed:'));
    
    if (error.response) {
      console.error(chalk.red(`   Status: ${error.response.status}`));
      console.error(chalk.red(`   Message: ${error.response.data?.message || error.message}`));
      
      if (error.response.status === 400 && error.response.data?.errors) {
        console.error(chalk.red('   Validation errors:'), error.response.data.errors);
      }
    } else {
      console.error(chalk.red(`   ${error.message}`));
    }
    
    console.log(chalk.yellow('\nℹ️  Note: Update TEST_USER credentials with a valid test account'));
    process.exit(1);
  }
}

// Run the test
testLogout().catch(console.error);