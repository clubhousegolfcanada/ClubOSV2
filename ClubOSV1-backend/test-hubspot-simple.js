#!/usr/bin/env node

// Simple HubSpot connection test
require('dotenv').config();
const axios = require('axios');

async function testHubSpot() {
  const apiKey = process.env.HUBSPOT_API_KEY;
  
  console.log('HubSpot Integration Test\n');
  console.log('API Key:', apiKey ? '✅ Found' : '❌ Missing');
  
  if (!apiKey) return;
  
  try {
    // Test basic connection
    const response = await axios.get('https://api.hubapi.com/crm/v3/objects/contacts?limit=10', {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });
    
    console.log('Connection: ✅ Success');
    console.log(`Total contacts in HubSpot: ${response.data.total || 0}`);
    
    if (response.data.results && response.data.results.length > 0) {
      console.log('\nSample contacts:');
      response.data.results.slice(0, 3).forEach((contact, i) => {
        const props = contact.properties;
        console.log(`${i + 1}. ${props.firstname || ''} ${props.lastname || ''} - ${props.phone || props.email || 'No contact info'}`);
      });
    }
    
    console.log('\n✅ HubSpot integration is ready!');
    console.log('Customer names will now appear in your messages.');
    
  } catch (error) {
    console.log('Connection: ❌ Failed');
    console.log('Error:', error.response?.data?.message || error.message);
  }
}

testHubSpot();