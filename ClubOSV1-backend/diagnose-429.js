const https = require('https');
const { Pool } = require('pg');

console.log('=== 429 Error Diagnostic Tool ===\n');

// Test 1: Check Railway API directly
async function testRailwayAPI() {
  console.log('1. Testing Railway API Endpoint...');
  
  return new Promise((resolve) => {
    const options = {
      hostname: 'clubosv2-production.up.railway.app',
      port: 443,
      path: '/health',
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        console.log(`   Status: ${res.statusCode}`);
        console.log(`   Headers:`, res.headers);
        if (res.statusCode === 429) {
          console.log('   ❌ Rate limit detected at Railway level');
          console.log(`   Retry-After: ${res.headers['retry-after']} seconds`);
          console.log(`   Rate limit headers:`, {
            'x-ratelimit-limit': res.headers['x-ratelimit-limit'],
            'x-ratelimit-remaining': res.headers['x-ratelimit-remaining'],
            'x-ratelimit-reset': res.headers['x-ratelimit-reset']
          });
        } else {
          console.log(`   ✅ Health check passed: ${data}\n`);
        }
        resolve();
      });
    });

    req.on('error', (e) => {
      console.error(`   ❌ Error: ${e.message}\n`);
      resolve();
    });

    req.end();
  });
}

// Test 2: Check database connection pool
async function testDatabasePool() {
  console.log('2. Testing Database Connection Pool...');
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || "postgresql://postgres:FnlIdpRyrGXKyzhLEdxTCxuVXJcOyxeI@yamanote.proxy.rlwy.net:31482/railway",
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });

  try {
    // Test pool status
    console.log(`   Total connections: ${pool.totalCount}`);
    console.log(`   Idle connections: ${pool.idleCount}`);
    console.log(`   Waiting connections: ${pool.waitingCount}`);
    
    // Test a simple query
    const start = Date.now();
    const result = await pool.query('SELECT 1 as test');
    const duration = Date.now() - start;
    
    console.log(`   ✅ Database query successful (${duration}ms)`);
    
    // Test concurrent connections
    console.log('   Testing concurrent connections...');
    const promises = [];
    for (let i = 0; i < 25; i++) {
      promises.push(pool.query('SELECT pg_sleep(0.1)'));
    }
    
    try {
      await Promise.all(promises);
      console.log('   ✅ 25 concurrent connections handled');
    } catch (e) {
      console.log(`   ❌ Failed at concurrent connections: ${e.message}`);
    }
    
    console.log(`   Final pool status:`);
    console.log(`     - Total: ${pool.totalCount}`);
    console.log(`     - Idle: ${pool.idleCount}`);
    console.log(`     - Waiting: ${pool.waitingCount}\n`);
    
  } catch (error) {
    console.log(`   ❌ Database error: ${error.message}\n`);
  } finally {
    await pool.end();
  }
}

// Test 3: Check for request loops
async function testAPIEndpoints() {
  console.log('3. Testing API Endpoints for loops/retries...');
  
  const endpoints = [
    '/api/messages/conversations?limit=2',
    '/api/messages/health',
    '/api/llm/health'
  ];
  
  for (const endpoint of endpoints) {
    console.log(`   Testing ${endpoint}...`);
    
    const options = {
      hostname: 'clubosv2-production.up.railway.app',
      port: 443,
      path: endpoint,
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Origin': 'https://clubos-frontend.vercel.app'
      }
    };

    await new Promise((resolve) => {
      const req = https.request(options, (res) => {
        console.log(`     Status: ${res.statusCode}`);
        
        if (res.statusCode === 429) {
          console.log(`     ❌ Rate limited`);
          console.log(`     Headers:`, res.headers);
        } else if (res.statusCode === 401) {
          console.log(`     ⚠️  Authentication required (expected)`);
        } else if (res.statusCode >= 200 && res.statusCode < 300) {
          console.log(`     ✅ Success`);
        } else {
          console.log(`     ⚠️  Unexpected status`);
        }
        
        res.on('data', () => {}); // Consume response
        res.on('end', resolve);
      });

      req.on('error', (e) => {
        console.error(`     ❌ Error: ${e.message}`);
        resolve();
      });

      req.end();
    });
    
    // Small delay between requests
    await new Promise(r => setTimeout(r, 500));
  }
  console.log('');
}

// Test 4: Check rate limit configuration
async function checkRateLimitConfig() {
  console.log('4. Rate Limit Configuration Analysis...');
  
  console.log('   Default rate limits (from code):');
  console.log('   - General API: 300 requests/15 min (production)');
  console.log('   - Auth endpoints: 5 attempts/15 min');
  console.log('   - LLM endpoints: 30 requests/1 min');
  console.log('   - Message sending: 30 messages/1 min');
  console.log('');
  
  console.log('   Possible causes of 429 errors:');
  console.log('   1. Railway platform rate limiting (not our app)');
  console.log('   2. Cloudflare/CDN rate limiting');
  console.log('   3. Frontend making excessive API calls');
  console.log('   4. Retry logic causing request amplification');
  console.log('   5. Database connection pool exhaustion');
  console.log('');
}

// Test 5: Check for infinite loops in frontend
async function analyzeRequestPattern() {
  console.log('5. Request Pattern Analysis...');
  
  console.log('   Common patterns that cause 429:');
  console.log('   - useEffect without dependencies causing infinite loops');
  console.log('   - Aggressive polling intervals (< 5 seconds)');
  console.log('   - Retry logic without exponential backoff');
  console.log('   - Multiple components fetching same data');
  console.log('   - Missing error boundaries causing re-renders');
  console.log('');
  
  console.log('   Recommended fixes:');
  console.log('   1. Add proper dependencies to useEffect hooks');
  console.log('   2. Implement request deduplication');
  console.log('   3. Use exponential backoff for retries');
  console.log('   4. Cache API responses');
  console.log('   5. Implement request batching');
  console.log('');
}

// Run all tests
async function runDiagnostics() {
  await testRailwayAPI();
  await testDatabasePool();
  await testAPIEndpoints();
  await checkRateLimitConfig();
  await analyzeRequestPattern();
  
  console.log('=== Diagnosis Complete ===\n');
  console.log('Most likely causes:');
  console.log('1. Frontend making excessive requests (polling/retry loops)');
  console.log('2. Railway platform-level rate limiting');
  console.log('3. Database connection pool issues');
}

runDiagnostics().catch(console.error);