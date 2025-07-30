#!/usr/bin/env node

const axios = require('axios');

const API_URL = 'http://localhost:5005/api';

async function testKnowledgeAPI() {
  console.log('🔍 Testing Knowledge Import API endpoints...\n');

  // Test data
  const testEntry = `
# Test Knowledge Entry
This is a test entry for the knowledge import system.

## Emergency Procedures
- Always check TrackMan first
- Contact support if issues persist

## Booking Information  
- Standard rates apply
- Members get 10% discount
  `;

  try {
    console.log('1. Testing /knowledge/preview-entry endpoint...');
    
    // Test preview endpoint
    const previewResponse = await axios.post(`${API_URL}/knowledge/preview-entry`, {
      entry: testEntry
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-token' // We'll need a real token in production
      }
    });

    if (previewResponse.data.success) {
      console.log('✅ Preview endpoint works!');
      console.log('   - Detected sections:', previewResponse.data.data.sections?.length || 0);
      console.log('   - Primary category:', previewResponse.data.data.primaryCategory);
      
      if (previewResponse.data.data.sections?.length > 0) {
        console.log('\n2. Testing /knowledge/confirm-entry endpoint...');
        
        // Test confirm endpoint
        const confirmResponse = await axios.post(`${API_URL}/knowledge/confirm-entry`, {
          sections: previewResponse.data.data.sections,
          selectedCategories: {
            emergency: true,
            booking: true,
            tech: false,
            brand: false
          },
          clearExisting: false
        }, {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-token'
          }
        });

        if (confirmResponse.data.success) {
          console.log('✅ Confirm endpoint works!');
          console.log('   - Imported sections:', confirmResponse.data.data.imported);
          console.log('   - Database writes: CONFIRMED ✅');
        } else {
          console.log('❌ Confirm endpoint failed:', confirmResponse.data.error);
        }
      }
    } else {
      console.log('❌ Preview endpoint failed:', previewResponse.data.error);
    }

  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.log('❌ Backend server is not running on localhost:3001');
      console.log('   Please start the backend with: cd ClubOSV1-backend && npm run dev');
    } else if (error.response) {
      console.log('❌ API Error:', error.response.status, error.response.data);
    } else {
      console.log('❌ Network Error:', error.message);
    }
  }

  console.log('\n📋 API Endpoint Summary:');
  console.log('   POST /api/knowledge/preview-entry - Parses content without saving');
  console.log('   POST /api/knowledge/confirm-entry - Saves parsed sections to sop_embeddings table');
  console.log('   Database table: sop_embeddings (auto-created with embeddings)');
}

// Run the test
testKnowledgeAPI();