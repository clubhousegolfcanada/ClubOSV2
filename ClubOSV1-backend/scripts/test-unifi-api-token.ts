#!/usr/bin/env npx tsx

/**
 * Test UniFi Access API Token
 * This script tests various API endpoints with your token
 */

import * as dotenv from 'dotenv';
import https from 'https';

// Load environment variables
dotenv.config();

const API_TOKEN = process.env.UNIFI_API_TOKEN || '5lXwpnBmlVAWoA5TK3GkVw';
const CONSOLE_ID = '0CEA1424DB29000000000861C4610000000008D3E6AB000000006703125C:145557302';

const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

// Test function for API endpoints
async function testEndpoint(name: string, url: string, headers: any = {}) {
  return new Promise((resolve) => {
    console.log(`\nTesting ${name}...`);
    console.log(`URL: ${url}`);
    
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || 443,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`,
        'Accept': 'application/json',
        ...headers
      },
      rejectUnauthorized: false // For self-signed certificates
    };

    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode === 200 || res.statusCode === 201) {
          console.log(`${colors.green}✓ Success! (HTTP ${res.statusCode})${colors.reset}`);
          if (data) {
            try {
              const json = JSON.parse(data);
              console.log('Response preview:', JSON.stringify(json).substring(0, 200));
            } catch {
              console.log('Response preview:', data.substring(0, 200));
            }
          }
          resolve(true);
        } else if (res.statusCode === 401) {
          console.log(`${colors.yellow}⚠ Unauthorized (HTTP 401) - Token might not have access${colors.reset}`);
          resolve(false);
        } else if (res.statusCode === 404) {
          console.log(`${colors.yellow}⚠ Not Found (HTTP 404) - Endpoint doesn't exist${colors.reset}`);
          resolve(false);
        } else {
          console.log(`${colors.red}✗ Failed (HTTP ${res.statusCode})${colors.reset}`);
          if (data) {
            console.log('Error:', data.substring(0, 200));
          }
          resolve(false);
        }
      });
    });

    req.on('error', (error) => {
      console.log(`${colors.red}✗ Connection error: ${error.message}${colors.reset}`);
      resolve(false);
    });

    req.setTimeout(5000, () => {
      console.log(`${colors.red}✗ Request timeout${colors.reset}`);
      req.destroy();
      resolve(false);
    });

    req.end();
  });
}

async function runTests() {
  console.log(`${colors.blue}===================================`);
  console.log('UniFi Access API Token Test');
  console.log(`===================================${colors.reset}`);
  console.log(`\nUsing API Token: ${API_TOKEN.substring(0, 10)}...`);
  
  // Test different possible endpoints
  const endpoints = [
    // Cloud endpoints
    {
      name: 'UniFi Cloud Proxy API',
      url: `https://unifi.ui.com/proxy/consoles/${CONSOLE_ID}/access/api/v1/info`
    },
    {
      name: 'UniFi Cloud Direct API',
      url: `https://api.ui.com/ea/hosts/${CONSOLE_ID}/access/api/v1/info`
    },
    {
      name: 'UniFi Access Cloud API',
      url: 'https://access.ui.com/api/v1/info'
    },
    // Local endpoints (these won't work from here but good to test)
    {
      name: 'Local Controller (192.168.1.1)',
      url: 'https://192.168.1.1/api/v1/info'
    },
    {
      name: 'Local Controller (192.168.1.1:8443)',
      url: 'https://192.168.1.1:8443/api/v1/info'
    }
  ];

  let workingEndpoint = null;
  
  for (const endpoint of endpoints) {
    const success = await testEndpoint(endpoint.name, endpoint.url);
    if (success) {
      workingEndpoint = endpoint;
      break;
    }
  }

  console.log(`\n${colors.blue}===================================`);
  console.log('Test Results');
  console.log(`===================================${colors.reset}\n`);

  if (workingEndpoint) {
    console.log(`${colors.green}✓ Found working endpoint!${colors.reset}`);
    console.log(`\nAdd this to your .env file:`);
    console.log(`UNIFI_API_URL=${workingEndpoint.url.replace('/v1/info', '')}`);
    console.log(`UNIFI_API_TOKEN=${API_TOKEN}\n`);
  } else {
    console.log(`${colors.yellow}No working endpoints found.${colors.reset}\n`);
    console.log('This could mean:');
    console.log('1. The API token needs different permissions');
    console.log('2. The controller requires local network access');
    console.log('3. The cloud API uses a different endpoint');
    console.log('\nNext steps:');
    console.log('1. Check the UniFi Access API documentation');
    console.log('2. Verify the API token has Device "Edit" permissions');
    console.log('3. Consider using local network access (VPN/port forwarding)');
  }

  console.log('\n' + colors.blue + 'Alternative: Direct Controller Access' + colors.reset);
  console.log('If cloud API doesn\'t work, you\'ll need:');
  console.log('1. VPN access to the controller network');
  console.log('2. Port forwarding (less secure)');
  console.log('3. On-site proxy server\n');
}

// Run the tests
runTests().catch(error => {
  console.error(`${colors.red}Test failed:${colors.reset}`, error);
  process.exit(1);
});