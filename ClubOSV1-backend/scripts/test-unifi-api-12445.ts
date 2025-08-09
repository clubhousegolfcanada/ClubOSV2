#!/usr/bin/env npx tsx

/**
 * Test UniFi Access API on port 12445
 * Based on official UniFi Access API documentation
 */

import * as dotenv from 'dotenv';
import https from 'https';

// Load environment variables
dotenv.config();

const API_TOKEN = process.env.UNIFI_API_TOKEN || '5lXwpnBmlVAWoA5TK3GkVw';
const API_PORT = 12445;

const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

// Make API request
async function makeApiRequest(hostname: string, path: string, method: string = 'GET', body?: any) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname,
      port: API_PORT,
      path,
      method,
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      rejectUnauthorized: false // Self-signed certificate
    };

    console.log(`${method} https://${hostname}:${API_PORT}${path}`);

    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.code === 'SUCCESS') {
            console.log(`${colors.green}✓ Success${colors.reset}`);
            resolve(json.data);
          } else {
            console.log(`${colors.red}✗ API Error: ${json.msg}${colors.reset}`);
            resolve(null);
          }
        } catch (e) {
          console.log(`${colors.red}✗ HTTP ${res.statusCode}: ${data.substring(0, 100)}${colors.reset}`);
          resolve(null);
        }
      });
    });

    req.on('error', (error) => {
      console.log(`${colors.red}✗ Connection error: ${error.message}${colors.reset}`);
      resolve(null);
    });

    req.setTimeout(5000, () => {
      console.log(`${colors.red}✗ Request timeout${colors.reset}`);
      req.destroy();
      resolve(null);
    });

    if (body) {
      req.write(JSON.stringify(body));
    }

    req.end();
  });
}

async function testController(name: string, hostname: string) {
  console.log(`\n${colors.blue}Testing ${name} Controller${colors.reset}`);
  console.log(`Hostname: ${hostname}`);
  console.log(`Port: ${API_PORT}`);
  console.log('');

  // Test 1: Get system info
  console.log('1. Getting system info...');
  const info = await makeApiRequest(hostname, '/api/v1/info');
  if (info) {
    console.log('   System info retrieved successfully');
  }

  // Test 2: Get devices (doors)
  console.log('\n2. Getting devices...');
  const devices = await makeApiRequest(hostname, '/api/v1/devices');
  if (devices && Array.isArray(devices)) {
    console.log(`   Found ${devices.length} devices`);
    devices.forEach((device: any) => {
      if (device.type === 'door' || device.type === 'access_point') {
        console.log(`   - ${device.name} (${device.type})`);
      }
    });
  }

  // Test 3: Get doors specifically
  console.log('\n3. Getting door list...');
  const doors = await makeApiRequest(hostname, '/api/v1/doors');
  if (doors && Array.isArray(doors)) {
    console.log(`   Found ${doors.length} doors`);
    doors.forEach((door: any) => {
      console.log(`   - ${door.name} [${door.id}]`);
    });
  }

  // Test 4: Test door unlock (dry run - commented out for safety)
  console.log('\n4. Door unlock capability...');
  console.log('   Endpoint would be: POST /api/v1/doors/{doorId}/unlock');
  console.log('   Body: { "duration": 30 }');
  
  // Uncomment to actually test unlock:
  // const unlockResult = await makeApiRequest(
  //   hostname, 
  //   '/api/v1/doors/BEDFORD-STAFF-001/unlock',
  //   'POST',
  //   { duration: 5 }
  // );
}

async function runTests() {
  console.log(`${colors.blue}===================================`);
  console.log('UniFi Access API Test (Port 12445)');
  console.log(`===================================${colors.reset}`);
  console.log(`\nUsing API Token: ${API_TOKEN.substring(0, 10)}...`);
  console.log('\nIMPORTANT: This test requires direct network access to the controllers.');
  console.log('The controllers must be accessible on port 12445.\n');

  // Test Bedford controller
  const bedfordIp = process.env.BEDFORD_CONTROLLER_IP || '192.168.1.1';
  await testController('Bedford', bedfordIp);

  // Test Dartmouth controller
  const dartmouthIp = process.env.DARTMOUTH_CONTROLLER_IP || '192.168.1.1';
  if (dartmouthIp !== bedfordIp) {
    await testController('Dartmouth', dartmouthIp);
  }

  console.log(`\n${colors.blue}===================================`);
  console.log('Test Complete');
  console.log(`===================================${colors.reset}\n`);

  console.log('If tests failed with "Connection error":');
  console.log('1. Controllers are not accessible from this network');
  console.log('2. You need one of:');
  console.log('   - VPN access to the controller networks');
  console.log('   - Port forwarding for port 12445');
  console.log('   - Be on the same network as the controllers\n');

  console.log('Next steps for remote access:');
  console.log('1. Set up port forwarding at each location:');
  console.log('   - Forward external port 12445 → controller:12445');
  console.log('   - Use dynamic DNS or static IP');
  console.log('2. Update .env with public IPs/domains:');
  console.log('   BEDFORD_CONTROLLER_IP=bedford.yourdomain.com');
  console.log('   DARTMOUTH_CONTROLLER_IP=dartmouth.yourdomain.com\n');
}

// Run the tests
runTests().catch(error => {
  console.error(`${colors.red}Test failed:${colors.reset}`, error);
  process.exit(1);
});