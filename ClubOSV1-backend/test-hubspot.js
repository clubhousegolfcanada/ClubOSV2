#!/usr/bin/env node

// Test script for HubSpot integration
require('dotenv').config();

const { hubspotService } = require('./dist/services/hubspotService');

async function testHubSpot() {
  console.log('Testing HubSpot Integration...\n');
  
  // Test 1: Check connection
  console.log('1. Testing HubSpot connection...');
  const isConnected = hubspotService.isHubSpotConnected();
  console.log(`   Connected: ${isConnected ? '✅ YES' : '❌ NO'}`);
  
  if (!isConnected) {
    console.log('\n❌ HubSpot is not connected. Please check:');
    console.log('   - HUBSPOT_API_KEY is set in .env');
    console.log('   - The API key has correct permissions');
    console.log('   - Run: npm run dev to restart the service\n');
    return;
  }
  
  // Test 2: Search by phone
  console.log('\n2. Testing phone lookup...');
  const testPhone = process.argv[2] || '(555) 123-4567';
  console.log(`   Searching for: ${testPhone}`);
  
  try {
    const contact = await hubspotService.searchByPhone(testPhone);
    if (contact) {
      console.log('   ✅ Contact found:');
      console.log(`      Name: ${contact.name}`);
      console.log(`      Company: ${contact.company || 'N/A'}`);
      console.log(`      Email: ${contact.email || 'N/A'}`);
      console.log(`      HubSpot ID: ${contact.hubspotId}`);
    } else {
      console.log('   ℹ️  No contact found for this phone number');
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
  }
  
  // Test 3: Search by name
  console.log('\n3. Testing name search...');
  const searchQuery = process.argv[3] || 'John';
  console.log(`   Searching for: "${searchQuery}"`);
  
  try {
    const contacts = await hubspotService.searchContacts(searchQuery);
    console.log(`   Found ${contacts.length} contacts`);
    
    contacts.slice(0, 3).forEach((contact, index) => {
      console.log(`   ${index + 1}. ${contact.name} - ${contact.phone} ${contact.company ? `(${contact.company})` : ''}`);
    });
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
  }
  
  // Test 4: Cache stats
  console.log('\n4. Cache statistics:');
  const stats = hubspotService.getCacheStats();
  console.log(`   Cache entries: ${stats.size}`);
  console.log(`   Cached phones: ${stats.entries.join(', ') || 'None'}`);
  
  console.log('\n✅ Test completed!\n');
  console.log('Usage: node test-hubspot.js [phone] [name]');
  console.log('Example: node test-hubspot.js "(902) 555-1234" "Smith"');
}

// Run the test
testHubSpot().catch(console.error);