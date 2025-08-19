#!/usr/bin/env npx tsx
/**
 * Test script to validate the customer signup flow
 * Ensures new customers get 100 CC and are added to leaderboard
 */

import axios from 'axios';
import { pool } from '../src/utils/database';

const API_URL = process.env.API_URL || 'http://localhost:5005';
const TEST_EMAIL = `test_${Date.now()}@clubhouse.test`;
const TEST_PASSWORD = 'TestPass123!';
const TEST_NAME = 'Test User';

interface TestResult {
  step: string;
  success: boolean;
  message: string;
  data?: any;
}

const results: TestResult[] = [];

async function logResult(step: string, success: boolean, message: string, data?: any) {
  const result = { step, success, message, data };
  results.push(result);
  console.log(`${success ? '✅' : '❌'} ${step}: ${message}`);
  if (data && process.env.DEBUG) {
    console.log('  Data:', JSON.stringify(data, null, 2));
  }
}

async function testSignupFlow() {
  let userId: string | null = null;
  let authToken: string | null = null;

  try {
    console.log('\n🧪 Testing Customer Signup Flow');
    console.log('================================\n');

    // Step 1: Test signup endpoint
    console.log('📝 Step 1: Creating new customer account...');
    try {
      const signupResponse = await axios.post(`${API_URL}/api/auth/signup`, {
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
        name: TEST_NAME,
        role: 'customer'
      });

      if (signupResponse.data.success) {
        userId = signupResponse.data.data?.user?.id;
        authToken = signupResponse.data.data?.token;
        logResult('Signup', true, 'Customer account created successfully', {
          userId,
          hasToken: !!authToken
        });
      } else {
        logResult('Signup', false, 'Signup failed', signupResponse.data);
      }
    } catch (error: any) {
      logResult('Signup', false, `Signup error: ${error.message}`, error.response?.data);
      throw error;
    }

    // Step 2: Verify user was created in database
    if (userId) {
      console.log('\n🔍 Step 2: Verifying user in database...');
      const userResult = await pool.query(
        'SELECT id, email, name, role FROM "Users" WHERE id = $1',
        [userId]
      );

      if (userResult.rows.length > 0) {
        logResult('User Creation', true, 'User found in database', userResult.rows[0]);
      } else {
        logResult('User Creation', false, 'User not found in database');
      }
    }

    // Step 3: Check customer profile was created
    if (userId) {
      console.log('\n👤 Step 3: Checking customer profile...');
      const profileResult = await pool.query(
        'SELECT user_id, cc_balance, total_cc_earned, current_rank FROM customer_profiles WHERE user_id = $1',
        [userId]
      );

      if (profileResult.rows.length > 0) {
        const profile = profileResult.rows[0];
        const balance = parseFloat(profile.cc_balance);
        const hasCorrectBalance = balance === 100;
        logResult(
          'Customer Profile',
          hasCorrectBalance,
          hasCorrectBalance 
            ? 'Profile created with 100 CC signup bonus!' 
            : `Profile created but CC balance is ${profile.cc_balance} instead of 100`,
          profile
        );
      } else {
        logResult('Customer Profile', false, 'Customer profile not found');
      }
    }

    // Step 4: Check CC transaction log
    if (userId) {
      console.log('\n💰 Step 4: Checking CC transaction log...');
      const transactionResult = await pool.query(
        `SELECT type, amount, balance_before, balance_after, description 
         FROM cc_transactions 
         WHERE user_id = $1 AND type = 'initial_grant'
         ORDER BY created_at DESC LIMIT 1`,
        [userId]
      );

      if (transactionResult.rows.length > 0) {
        const transaction = transactionResult.rows[0];
        logResult('CC Transaction', true, 'Initial grant transaction found', transaction);
      } else {
        logResult('CC Transaction', false, 'No initial grant transaction found');
      }
    }

    // Step 5: Check if user was added to current season leaderboard
    if (userId) {
      console.log('\n🏆 Step 5: Checking season leaderboard...');
      
      // First check if there's an active season
      const seasonResult = await pool.query(
        `SELECT id, name FROM seasons WHERE status = 'active' LIMIT 1`
      );

      if (seasonResult.rows.length > 0) {
        const seasonId = seasonResult.rows[0].id;
        const seasonName = seasonResult.rows[0].name;
        
        const leaderboardResult = await pool.query(
          `SELECT user_id, season_id, cc_net, cc_from_bonuses, challenges_completed 
           FROM seasonal_cc_earnings 
           WHERE user_id = $1 AND season_id = $2`,
          [userId, seasonId]
        );

        if (leaderboardResult.rows.length > 0) {
          const entry = leaderboardResult.rows[0];
          const netCC = parseFloat(entry.cc_net);
          const hasCorrectBonus = netCC === 100;
          logResult(
            'Season Leaderboard',
            hasCorrectBonus,
            hasCorrectBonus
              ? `User added to ${seasonName} leaderboard with 100 CC`
              : `User in leaderboard but CC is ${entry.cc_net} instead of 100`,
            entry
          );
        } else {
          logResult('Season Leaderboard', false, `User not found in ${seasonName} leaderboard`);
        }
      } else {
        logResult('Season Leaderboard', false, 'No active season found');
      }
    }

    // Step 6: Test authentication with new account
    if (authToken) {
      console.log('\n🔐 Step 6: Testing authentication...');
      try {
        const meResponse = await axios.get(`${API_URL}/api/auth/me`, {
          headers: { Authorization: `Bearer ${authToken}` }
        });

        if (meResponse.data.success) {
          logResult('Authentication', true, 'Token authentication successful', {
            userId: meResponse.data.data.id,
            email: meResponse.data.data.email
          });
        } else {
          logResult('Authentication', false, 'Token authentication failed');
        }
      } catch (error: any) {
        logResult('Authentication', false, `Auth error: ${error.message}`);
      }
    }

    // Step 7: Test CC balance API endpoint
    if (authToken) {
      console.log('\n💳 Step 7: Testing CC balance API...');
      try {
        const balanceResponse = await axios.get(`${API_URL}/api/challenges/cc-balance`, {
          headers: { Authorization: `Bearer ${authToken}` }
        });

        if (balanceResponse.data.success) {
          const balance = balanceResponse.data.data?.balance;
          const hasCorrectBalance = balance === 100;
          logResult(
            'CC Balance API',
            hasCorrectBalance,
            hasCorrectBalance
              ? 'API returns correct 100 CC balance'
              : `API returns ${balance} CC instead of 100`,
            balanceResponse.data.data
          );
        } else {
          logResult('CC Balance API', false, 'Failed to get CC balance');
        }
      } catch (error: any) {
        logResult('CC Balance API', false, `Balance API error: ${error.message}`);
      }
    }

  } catch (error) {
    console.error('\n❌ Test failed with error:', error);
  } finally {
    // Cleanup: Delete test user
    if (userId) {
      console.log('\n🧹 Cleaning up test data...');
      try {
        await pool.query('DELETE FROM "Users" WHERE id = $1', [userId]);
        console.log('✅ Test user deleted');
      } catch (error) {
        console.error('❌ Failed to delete test user:', error);
      }
    }

    // Print summary
    console.log('\n📊 Test Summary');
    console.log('================');
    const passed = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📈 Success Rate: ${Math.round((passed / results.length) * 100)}%`);
    
    if (failed > 0) {
      console.log('\n❌ Failed Tests:');
      results.filter(r => !r.success).forEach(r => {
        console.log(`  - ${r.step}: ${r.message}`);
      });
    }

    process.exit(failed > 0 ? 1 : 0);
  }
}

// Run the test
testSignupFlow().catch(console.error);