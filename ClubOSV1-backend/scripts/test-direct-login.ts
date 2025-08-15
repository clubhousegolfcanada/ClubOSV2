#!/usr/bin/env npx tsx
import dotenv from 'dotenv';
import path from 'path';
import fetch from 'node-fetch';
import * as tough from 'tough-cookie';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

async function testDirectLogin() {
  console.log('🔐 Testing UniFi Direct Login\n');

  const username = process.env.UNIFI_CLOUD_USERNAME || process.env.UNIFI_USERNAME;
  const password = process.env.UNIFI_CLOUD_PASSWORD || process.env.UNIFI_PASSWORD;
  const consoleId = process.env.UNIFI_CONSOLE_ID;

  if (!username || !password) {
    console.log('❌ Missing credentials');
    process.exit(1);
  }

  console.log(`Username: ${username}`);
  console.log(`Console ID: ${consoleId}\n`);

  const cookieJar = new tough.CookieJar();

  try {
    // Step 1: Try direct login without CSRF (some versions don't need it)
    console.log('🔑 Attempting direct login...');
    
    const loginResponse = await fetch('https://account.ui.com/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      },
      body: JSON.stringify({
        username,
        password,
        rememberMe: true
      })
    });

    console.log(`Login response: ${loginResponse.status} ${loginResponse.statusText}`);
    
    const responseText = await loginResponse.text();
    console.log('Response preview:', responseText.substring(0, 200));

    if (loginResponse.ok) {
      try {
        const loginData = JSON.parse(responseText);
        console.log('✅ Login successful!');
        console.log('User ID:', loginData.userId || loginData.user?.id);
        
        // Store cookies
        const cookies = loginResponse.headers.raw()['set-cookie'];
        if (cookies) {
          console.log(`\n🍪 Got ${cookies.length} cookie(s)`);
          for (const cookie of cookies) {
            await cookieJar.setCookie(cookie, 'https://account.ui.com');
          }
        }

        // Step 2: Try to access the console
        if (consoleId) {
          console.log('\n📡 Testing console access...');
          const cookieString = await cookieJar.getCookieString('https://unifi.ui.com');
          
          const consoleUrl = `https://unifi.ui.com/proxy/consoles/${consoleId}/access/api/v1/developer/doors`;
          console.log(`URL: ${consoleUrl}`);
          
          const doorsResponse = await fetch(consoleUrl, {
            method: 'GET',
            headers: {
              'Cookie': cookieString,
              'Accept': 'application/json',
              'User-Agent': 'Mozilla/5.0'
            }
          });

          console.log(`Doors response: ${doorsResponse.status} ${doorsResponse.statusText}`);
          
          if (doorsResponse.ok) {
            const doorsData = await doorsResponse.json();
            console.log('✅ Successfully accessed doors API!');
            console.log(`Found ${doorsData.data?.length || 0} doors`);
          } else {
            const errorText = await doorsResponse.text();
            console.log('Response:', errorText.substring(0, 200));
          }
        }
      } catch (e) {
        console.log('Failed to parse as JSON');
      }
    } else if (loginResponse.status === 401) {
      // Check for MFA requirement
      if (responseText.includes('totpAuthRequired') || responseText.includes('2fa')) {
        console.log('\n❌ Two-Factor Authentication is required!');
        console.log('Please disable 2FA temporarily or use a service account without 2FA.');
      } else {
        console.log('❌ Invalid credentials');
      }
    } else {
      console.log('❌ Login failed:', responseText.substring(0, 500));
    }

  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
  }
}

// Alternative: Test with API key in Authorization header
async function testAPIKeyAuth() {
  console.log('\n🔑 Testing API Key Authentication...\n');
  
  const apiKey = process.env.UNIFI_ACCESS_API_TOKEN || process.env.UNIFI_API_KEY;
  const consoleId = process.env.UNIFI_CONSOLE_ID;
  
  if (!apiKey || !consoleId) {
    console.log('❌ Missing API key or console ID');
    return;
  }

  try {
    const url = `https://unifi.ui.com/proxy/consoles/${consoleId}/access/api/v1/developer/doors`;
    console.log(`URL: ${url}`);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json',
        'User-Agent': 'ClubOS/1.0'
      }
    });

    console.log(`Response: ${response.status} ${response.statusText}`);
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ API key authentication worked!');
      console.log(`Found ${data.data?.length || 0} doors`);
    } else {
      const text = await response.text();
      console.log('Response:', text.substring(0, 200));
      
      if (response.status === 401) {
        console.log('\n💡 API key doesn\'t have access to Developer API');
        console.log('You need a Developer API token from UniFi Access settings');
      }
    }
  } catch (error: any) {
    console.error('Error:', error.message);
  }
}

// Run both tests
async function runTests() {
  await testDirectLogin();
  await testAPIKeyAuth();
}

runTests().catch(console.error);