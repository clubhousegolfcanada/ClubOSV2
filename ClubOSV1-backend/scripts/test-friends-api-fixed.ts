#!/usr/bin/env npx tsx
/**
 * Test script to validate friend request functionality
 * Tests sending, accepting, and viewing friend requests
 * Fixed version that ensures users are in both tables
 */

import axios from 'axios';
import { pool } from '../src/utils/database';

const API_URL = process.env.API_URL || 'http://localhost:5005';

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

async function syncUserToLowercase(userId: string) {
  // Ensure user exists in lowercase users table for foreign key constraints
  try {
    await pool.query(`
      INSERT INTO users (id, email, password, name, phone, role, created_at, updated_at, is_active)
      SELECT 
        id, 
        email, 
        password, 
        name, 
        phone, 
        CASE 
          WHEN role::text = 'customer' THEN 'customer'
          ELSE 'support'
        END as role,
        "createdAt",
        "updatedAt",
        "isActive"
      FROM "Users"
      WHERE id = $1
      ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        name = EXCLUDED.name,
        updated_at = EXCLUDED.updated_at
    `, [userId]);
    console.log(`  ✓ Synced user ${userId} to lowercase users table`);
  } catch (error) {
    console.error(`  ✗ Failed to sync user ${userId}:`, error);
  }
}

async function testFriendRequestFlow() {
  let user1Id: string | null = null;
  let user2Id: string | null = null;
  let user1Token: string | null = null;
  let user2Token: string | null = null;
  let friendRequestId: string | null = null;

  try {
    console.log('\n🤝 Testing Friend Request Flow');
    console.log('===============================\n');

    // Step 1: Create first test user
    console.log('👤 Step 1: Creating first test user...');
    const user1Email = `friend_test1_${Date.now()}@clubhouse.test`;
    try {
      const signup1Response = await axios.post(`${API_URL}/api/auth/signup`, {
        email: user1Email,
        password: 'TestPass123!',
        name: 'Friend User 1',
        role: 'customer'
      });

      if (signup1Response.data.success) {
        user1Id = signup1Response.data.data?.user?.id;
        user1Token = signup1Response.data.data?.token;
        
        // Sync to lowercase users table
        await syncUserToLowercase(user1Id);
        
        logResult('User 1 Creation', true, 'First user created successfully', {
          userId: user1Id,
          email: user1Email
        });
      }
    } catch (error: any) {
      logResult('User 1 Creation', false, `Failed: ${error.message}`);
      throw error;
    }

    // Step 2: Create second test user
    console.log('\n👤 Step 2: Creating second test user...');
    const user2Email = `friend_test2_${Date.now()}@clubhouse.test`;
    try {
      const signup2Response = await axios.post(`${API_URL}/api/auth/signup`, {
        email: user2Email,
        password: 'TestPass123!',
        name: 'Friend User 2',
        role: 'customer'
      });

      if (signup2Response.data.success) {
        user2Id = signup2Response.data.data?.user?.id;
        user2Token = signup2Response.data.data?.token;
        
        // Sync to lowercase users table
        await syncUserToLowercase(user2Id);
        
        logResult('User 2 Creation', true, 'Second user created successfully', {
          userId: user2Id,
          email: user2Email
        });
      }
    } catch (error: any) {
      logResult('User 2 Creation', false, `Failed: ${error.message}`);
      throw error;
    }

    // Step 3: User 1 sends friend request to User 2
    console.log('\n📤 Step 3: Sending friend request from User 1 to User 2...');
    if (user1Token && user2Id) {
      try {
        const requestResponse = await axios.post(
          `${API_URL}/api/friends/request`,
          {
            target_user_id: user2Id,
            message: 'Let\'s be friends!'
          },
          {
            headers: { Authorization: `Bearer ${user1Token}` }
          }
        );

        if (requestResponse.data.success) {
          friendRequestId = requestResponse.data.data?.request_id;
          logResult('Send Friend Request', true, 'Friend request sent successfully', {
            requestId: friendRequestId
          });
        }
      } catch (error: any) {
        logResult('Send Friend Request', false, `Failed: ${error.response?.data?.error || error.message}`);
      }
    }

    // Step 4: Check User 2's pending friend requests
    console.log('\n📥 Step 4: Checking User 2\'s pending friend requests...');
    if (user2Token) {
      try {
        const pendingResponse = await axios.get(
          `${API_URL}/api/friends/pending`,
          {
            headers: { Authorization: `Bearer ${user2Token}` }
          }
        );

        if (pendingResponse.data.success) {
          const pendingRequests = pendingResponse.data.data?.requests || [];
          const hasRequest = pendingRequests.some((r: any) => r.id === friendRequestId);
          logResult(
            'Check Pending Requests',
            hasRequest,
            hasRequest 
              ? `Found friend request in pending list (${pendingRequests.length} total)`
              : 'Friend request not found in pending list',
            {
              totalPending: pendingRequests.length,
              incoming: pendingResponse.data.data?.incoming,
              outgoing: pendingResponse.data.data?.outgoing
            }
          );
        }
      } catch (error: any) {
        logResult('Check Pending Requests', false, `Failed: ${error.message}`);
      }
    }

    // Step 5: User 2 accepts the friend request
    console.log('\n✅ Step 5: User 2 accepting friend request...');
    if (user2Token && friendRequestId) {
      try {
        const acceptResponse = await axios.put(
          `${API_URL}/api/friends/${friendRequestId}/accept`,
          {},
          {
            headers: { Authorization: `Bearer ${user2Token}` }
          }
        );

        if (acceptResponse.data.success) {
          logResult('Accept Friend Request', true, 'Friend request accepted successfully');
        }
      } catch (error: any) {
        logResult('Accept Friend Request', false, `Failed: ${error.response?.data?.error || error.message}`);
      }
    }

    // Step 6: Check User 1's friends list
    console.log('\n👥 Step 6: Checking User 1\'s friends list...');
    if (user1Token) {
      try {
        const friendsResponse = await axios.get(
          `${API_URL}/api/friends`,
          {
            headers: { Authorization: `Bearer ${user1Token}` }
          }
        );

        if (friendsResponse.data.success) {
          const friends = friendsResponse.data.data?.friends || [];
          const isFriend = friends.some((f: any) => f.user_id === user2Id);
          logResult(
            'Check Friends List (User 1)',
            isFriend,
            isFriend
              ? `User 2 found in friends list (${friends.length} total friends)`
              : 'User 2 not found in friends list',
            {
              totalFriends: friends.length,
              friendNames: friends.map((f: any) => f.name)
            }
          );
        }
      } catch (error: any) {
        logResult('Check Friends List (User 1)', false, `Failed: ${error.message}`);
      }
    }

    // Step 7: Check User 2's friends list
    console.log('\n👥 Step 7: Checking User 2\'s friends list...');
    if (user2Token) {
      try {
        const friendsResponse = await axios.get(
          `${API_URL}/api/friends`,
          {
            headers: { Authorization: `Bearer ${user2Token}` }
          }
        );

        if (friendsResponse.data.success) {
          const friends = friendsResponse.data.data?.friends || [];
          const isFriend = friends.some((f: any) => f.user_id === user1Id);
          logResult(
            'Check Friends List (User 2)',
            isFriend,
            isFriend
              ? `User 1 found in friends list (${friends.length} total friends)`
              : 'User 1 not found in friends list',
            {
              totalFriends: friends.length,
              friendNames: friends.map((f: any) => f.name)
            }
          );
        }
      } catch (error: any) {
        logResult('Check Friends List (User 2)', false, `Failed: ${error.message}`);
      }
    }

    // Step 8: Test friend search functionality
    console.log('\n🔍 Step 8: Testing friend search...');
    if (user1Token) {
      try {
        const searchResponse = await axios.post(
          `${API_URL}/api/friends/search`,
          {
            query: 'Friend User 2',
            type: 'name'
          },
          {
            headers: { Authorization: `Bearer ${user1Token}` }
          }
        );

        if (searchResponse.data.success) {
          const searchResults = searchResponse.data.data?.users || [];
          const foundUser2 = searchResults.some((u: any) => u.id === user2Id);
          logResult(
            'Friend Search',
            foundUser2,
            foundUser2
              ? `Found User 2 in search results (${searchResults.length} total results)`
              : 'User 2 not found in search',
            {
              totalResults: searchResults.length
            }
          );
        }
      } catch (error: any) {
        logResult('Friend Search', false, `Failed: ${error.message}`);
      }
    }

    // Step 9: Verify database records
    console.log('\n🗄️ Step 9: Verifying database records...');
    if (user1Id && user2Id) {
      const friendshipResult = await pool.query(
        `SELECT * FROM friendships 
         WHERE ((user_id = $1 AND friend_id = $2) 
            OR (user_id = $2 AND friend_id = $1))
         AND status = 'accepted'`,
        [user1Id, user2Id]
      );

      if (friendshipResult.rows.length > 0) {
        const friendship = friendshipResult.rows[0];
        logResult('Database Verification', true, 'Friendship record found in database', {
          status: friendship.status,
          acceptedAt: friendship.accepted_at
        });
      } else {
        logResult('Database Verification', false, 'No accepted friendship found in database');
      }
    }

  } catch (error) {
    console.error('\n❌ Test failed with error:', error);
  } finally {
    // Cleanup: Delete test users from both tables
    console.log('\n🧹 Cleaning up test data...');
    if (user1Id) {
      try {
        await pool.query('DELETE FROM users WHERE id = $1', [user1Id]);
        await pool.query('DELETE FROM "Users" WHERE id = $1', [user1Id]);
        console.log('✅ Test user 1 deleted from both tables');
      } catch (error) {
        console.error('❌ Failed to delete test user 1:', error);
      }
    }
    if (user2Id) {
      try {
        await pool.query('DELETE FROM users WHERE id = $1', [user2Id]);
        await pool.query('DELETE FROM "Users" WHERE id = $1', [user2Id]);
        console.log('✅ Test user 2 deleted from both tables');
      } catch (error) {
        console.error('❌ Failed to delete test user 2:', error);
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
testFriendRequestFlow().catch(console.error);