#!/usr/bin/env npx tsx
import fetch from 'node-fetch';
import https from 'https';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Ignore self-signed certificates
const httpsAgent = new https.Agent({
  rejectUnauthorized: false
});

interface LocationConfig {
  name: string;
  token: string;
  ip: string;
  port: string;
}

async function testLocation(location: LocationConfig) {
  console.log(`\n📍 Testing ${location.name}...`);
  console.log(`   Token: ${location.token.substring(0, 10)}...`);
  console.log(`   Controller: ${location.ip}:${location.port}`);

  try {
    const url = `https://${location.ip}:${location.port}/api/v1/developer/doors`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${location.token}`,
        'Accept': 'application/json'
      },
      agent: httpsAgent,
      timeout: 5000
    });

    if (response.ok) {
      const data = await response.json();
      
      if (data.code === 'SUCCESS' && data.data) {
        console.log(`   ✅ Connected! Found ${data.data.length} door(s):`);
        
        data.data.forEach((door: any, index: number) => {
          console.log(`      ${index + 1}. ${door.name || door.full_name}`);
          console.log(`         ID: ${door.id}`);
          console.log(`         Can Unlock: ${door.is_bind_hub ? '✅' : '❌'}`);
        });
        
        return { location: location.name, doors: data.data };
      }
    } else {
      console.log(`   ❌ Connection failed: ${response.status} ${response.statusText}`);
    }
  } catch (error: any) {
    console.log(`   ❌ Error: ${error.message}`);
  }
  
  return { location: location.name, doors: [] };
}

async function testAllLocations() {
  console.log('🚪 UniFi Access Multi-Location Test');
  console.log('=' .repeat(50));

  const locations: LocationConfig[] = [
    {
      name: 'Bedford',
      token: process.env.BEDFORD_ACCESS_TOKEN || '',
      ip: process.env.BEDFORD_CONTROLLER_IP || '192.168.1.1',
      port: process.env.BEDFORD_API_PORT || '12445'
    },
    {
      name: 'Dartmouth',
      token: process.env.DARTMOUTH_ACCESS_TOKEN || '',
      ip: process.env.DARTMOUTH_CONTROLLER_IP || '192.168.1.1',
      port: process.env.DARTMOUTH_API_PORT || '12445'
    }
  ];

  const results = [];
  
  for (const location of locations) {
    if (location.token) {
      const result = await testLocation(location);
      results.push(result);
    } else {
      console.log(`\n📍 ${location.name}: ❌ No token configured`);
    }
  }

  // Summary
  console.log('\n' + '=' .repeat(50));
  console.log('📊 Summary:');
  console.log('=' .repeat(50));
  
  let totalDoors = 0;
  results.forEach(result => {
    console.log(`${result.location}: ${result.doors.length} door(s)`);
    totalDoors += result.doors.length;
  });
  
  console.log(`\nTotal: ${totalDoors} door(s) across all locations`);
  
  if (totalDoors > 0) {
    console.log('\n✅ SUCCESS! Your multi-location door control is ready!');
    console.log('\n🚀 You can now control doors at both Bedford and Dartmouth!');
  }
}

// Run the test
testAllLocations().catch(console.error);