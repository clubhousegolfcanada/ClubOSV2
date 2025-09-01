#!/usr/bin/env tsx

import axios from 'axios';

const checkDeployment = async () => {
  console.log('🔍 Checking Railway deployment status...\n');
  
  const testEndpoints = [
    {
      url: 'https://clubosv2-production.up.railway.app/api/slack/threads',
      method: 'GET',
      description: 'Slack threads endpoint'
    }
  ];

  for (const endpoint of testEndpoints) {
    try {
      console.log(`Testing ${endpoint.description}...`);
      const response = await axios({
        method: endpoint.method,
        url: endpoint.url,
        validateStatus: () => true // Don't throw on any status
      });
      
      console.log(`  Status: ${response.status}`);
      
      // Check for specific error messages that indicate old code
      if (response.data?.error?.includes('blacklisted_tokens')) {
        console.log('  ❌ OLD CODE: Still seeing blacklisted_tokens error');
        console.log('  Railway deployment not complete yet');
      } else if (response.status === 401) {
        console.log('  ✅ NEW CODE: Auth working without blacklisted_tokens error');
        console.log('  Deployment appears complete!');
      } else {
        console.log('  Response:', JSON.stringify(response.data, null, 2).substring(0, 200));
      }
    } catch (error: any) {
      console.log(`  Error: ${error.message}`);
    }
    console.log('');
  }
  
  console.log('\n📝 Summary:');
  console.log('If you see "blacklisted_tokens" errors, the deployment is not complete.');
  console.log('Once deployed, those errors should disappear and Slack replies should work.');
  console.log('\nYou can run this script again in a few minutes to check status.');
};

checkDeployment().catch(console.error);