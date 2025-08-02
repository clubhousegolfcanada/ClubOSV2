#!/usr/bin/env node

// Direct test of HubSpot API without full backend
require('dotenv').config();
const axios = require('axios');

async function testHubSpotDirect() {
  const apiKey = process.env.HUBSPOT_API_KEY;
  
  console.log('Testing HubSpot API directly...\n');
  console.log('API Key found:', apiKey ? '✅ YES' : '❌ NO');
  
  if (!apiKey) {
    console.log('Please add HUBSPOT_API_KEY to .env file');
    return;
  }
  
  console.log('\nTesting API connection...');
  
  try {
    // Test basic API access
    const response = await axios.get('https://api.hubapi.com/crm/v3/objects/contacts', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      params: { limit: 1 }
    });
    
    console.log('✅ API connection successful!');
    console.log(`Found ${response.data.total || 0} total contacts in HubSpot`);
    
    // Test search functionality
    console.log('\nTesting search by phone...');
    const searchResponse = await axios.post('https://api.hubapi.com/crm/v3/objects/contacts/search', {
      filterGroups: [{
        filters: [{
          propertyName: 'phone',
          operator: 'CONTAINS',
          value: '555'
        }]
      }],
      properties: ['firstname', 'lastname', 'phone', 'company', 'email'],
      limit: 5
    }, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`Found ${searchResponse.data.results.length} contacts with '555' in phone`);
    
    if (searchResponse.data.results.length > 0) {
      console.log('\nFirst contact:');
      const contact = searchResponse.data.results[0];
      const props = contact.properties;
      console.log(`  Name: ${props.firstname || ''} ${props.lastname || ''}`);
      console.log(`  Phone: ${props.phone || 'N/A'}`);
      console.log(`  Company: ${props.company || 'N/A'}`);
    }
    
  } catch (error) {
    if (error.response?.status === 401) {
      console.log('❌ Invalid API key');
    } else if (error.response?.status === 403) {
      console.log('❌ Missing required permissions (needs crm.objects.contacts.read)');
    } else {
      console.log('❌ Error:', error.response?.data?.message || error.message);
    }
  }
}

testHubSpotDirect().catch(console.error);