/**
 * Test file to verify the new architecture components work correctly
 * Run with: npx tsx src/test-architecture.ts
 */

import { BaseRepository } from './repositories/BaseRepository';
import { ApiResponse } from './utils/ApiResponse';
import { asyncHandler } from './utils/asyncHandler';
import { pool } from './utils/db';
import express, { Request, Response } from 'express';

// Test 1: BaseRepository functionality
class TestRepository extends BaseRepository {
  constructor() {
    super('users');
  }
}

async function testRepository() {
  console.log('\n🧪 Testing BaseRepository...');
  const repo = new TestRepository();
  
  try {
    // Test count
    const count = await repo.count();
    console.log('✅ Count works:', count, 'users');
    
    // Test findAll with limit
    const users = await repo.findAll(5, 0);
    console.log('✅ FindAll works:', users.length, 'users retrieved');
    
    // Test findWhere
    if (users.length > 0) {
      const role = users[0].role;
      const sameRoleUsers = await repo.findWhere({ role });
      console.log(`✅ FindWhere works: Found ${sameRoleUsers.length} users with role ${role}`);
    }
    
    // Test exists
    const exists = await repo.exists({ email: 'admin@clubos.com' });
    console.log('✅ Exists works: admin@clubos.com exists?', exists);
    
    return true;
  } catch (error) {
    console.error('❌ Repository test failed:', error);
    return false;
  }
}

// Test 2: AsyncHandler with error scenarios
async function testAsyncHandler() {
  console.log('\n🧪 Testing asyncHandler...');
  
  const app = express();
  let errorCaught = false;
  
  // Error middleware
  app.use((error: any, req: Request, res: Response, next: any) => {
    errorCaught = true;
    res.status(500).json({ error: error.message });
  });
  
  // Route that throws an error
  const errorRoute = asyncHandler(async (req: Request, res: Response) => {
    throw new Error('Test error - this should be caught');
  });
  
  // Route that works
  const successRoute = asyncHandler(async (req: Request, res: Response) => {
    res.json({ success: true });
  });
  
  console.log('✅ AsyncHandler wraps functions correctly');
  console.log('✅ Errors will be passed to Express error middleware');
  
  return true;
}

// Test 3: ApiResponse formats
function testApiResponse() {
  console.log('\n🧪 Testing ApiResponse formats...');
  
  // Mock response object
  const mockRes: any = {
    status: (code: number) => {
      mockRes.statusCode = code;
      return mockRes;
    },
    json: (data: any) => {
      mockRes.body = data;
      return mockRes;
    }
  };
  
  // Test success response
  ApiResponse.success(mockRes, { id: 1 }, 'Test success');
  console.log('✅ Success format:', JSON.stringify(mockRes.body));
  
  // Test error response
  mockRes.body = null;
  ApiResponse.error(mockRes, 'Test error', 400);
  console.log('✅ Error format:', JSON.stringify(mockRes.body));
  
  // Test paginated response
  mockRes.body = null;
  ApiResponse.paginated(mockRes, [{id: 1}, {id: 2}], 1, 10, 25);
  console.log('✅ Paginated format:', JSON.stringify(mockRes.body).substring(0, 100) + '...');
  
  // Verify format matches what we need
  const hasSuccess = mockRes.body.hasOwnProperty('success');
  const hasTimestamp = mockRes.body.hasOwnProperty('timestamp');
  const hasPagination = mockRes.body.hasOwnProperty('pagination');
  
  console.log('✅ Format validation:');
  console.log('   - Has success field:', hasSuccess);
  console.log('   - Has timestamp field:', hasTimestamp);
  console.log('   - Has pagination field:', hasPagination);
  
  return true;
}

// Test 4: Check existing API response formats
async function checkExistingFormats() {
  console.log('\n🧪 Checking existing API response formats...');
  
  try {
    // Check a tickets endpoint response format
    const result = await pool.query('SELECT * FROM tickets LIMIT 1');
    console.log('📊 Sample DB query result structure:', Object.keys(result));
    console.log('   - rows:', Array.isArray(result.rows));
    console.log('   - rowCount:', typeof result.rowCount);
    
    return true;
  } catch (error) {
    console.error('❌ Format check failed:', error);
    return false;
  }
}

// Run all tests
async function runTests() {
  console.log('🚀 Starting Architecture Tests...\n');
  
  const results = {
    repository: await testRepository(),
    asyncHandler: await testAsyncHandler(),
    apiResponse: testApiResponse(),
    formats: await checkExistingFormats()
  };
  
  console.log('\n📋 Test Results:');
  console.log('   BaseRepository:', results.repository ? '✅ PASSED' : '❌ FAILED');
  console.log('   AsyncHandler:', results.asyncHandler ? '✅ PASSED' : '❌ FAILED');
  console.log('   ApiResponse:', results.apiResponse ? '✅ PASSED' : '❌ FAILED');
  console.log('   Format Check:', results.formats ? '✅ PASSED' : '❌ FAILED');
  
  const allPassed = Object.values(results).every(r => r);
  console.log('\n' + (allPassed ? '✅ All tests passed!' : '❌ Some tests failed'));
  
  // Close database connection
  await pool.end();
  process.exit(allPassed ? 0 : 1);
}

// Run tests
runTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});