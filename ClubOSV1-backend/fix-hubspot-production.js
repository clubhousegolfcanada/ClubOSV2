#!/usr/bin/env node

require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function fixHubSpotProduction() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  
  console.log('🔧 Fixing HubSpot Production Issues\n');
  
  try {
    // 1. Check and create cache table
    console.log('1. Checking cache table...');
    const tableExists = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'hubspot_cache'
      ) as exists
    `);
    
    if (!tableExists.rows[0].exists) {
      console.log('   Creating hubspot_cache table...');
      
      // Read and execute migration
      const migrationPath = path.join(__dirname, 'src/database/migrations/028_simple_hubspot_cache.sql');
      const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
      
      await pool.query(migrationSQL);
      console.log('   ✅ Cache table created');
    } else {
      console.log('   ✅ Cache table already exists');
    }
    
    // 2. Test HubSpot connection with a known number
    console.log('\n2. Testing HubSpot connection...');
    const axios = require('axios');
    
    // Test with different phone formats
    const testPhones = [
      { format: '19024783209', desc: 'No symbols' },
      { format: '+19024783209', desc: 'With plus' },
      { format: '9024783209', desc: '10 digits' },
    ];
    
    for (const test of testPhones) {
      try {
        const response = await axios.post(
          'https://api.hubapi.com/crm/v3/objects/contacts/search',
          {
            filterGroups: [{
              filters: [{
                propertyName: 'phone',
                operator: 'EQ',
                value: test.format
              }]
            }, {
              filters: [{
                propertyName: 'mobilephone',
                operator: 'EQ',
                value: test.format
              }]
            }],
            properties: ['firstname', 'lastname', 'phone', 'mobilephone'],
            limit: 1
          },
          {
            headers: {
              'Authorization': `Bearer ${process.env.HUBSPOT_API_KEY}`,
              'Content-Type': 'application/json'
            }
          }
        );
        
        if (response.data.results.length > 0) {
          const contact = response.data.results[0].properties;
          console.log(`   ✅ Found with ${test.desc}: ${contact.firstname} ${contact.lastname}`);
          break;
        } else {
          console.log(`   ❌ Not found with ${test.desc}`);
        }
      } catch (error) {
        console.log(`   ❌ Error with ${test.desc}: ${error.message}`);
      }
    }
    
    // 3. Update existing conversations with missing names
    console.log('\n3. Checking for conversations to update...');
    const namelessConvs = await pool.query(`
      SELECT DISTINCT phone_number 
      FROM openphone_conversations 
      WHERE (customer_name IS NULL 
        OR customer_name = 'Unknown' 
        OR customer_name = phone_number)
      AND phone_number IS NOT NULL
      LIMIT 5
    `);
    
    console.log(`   Found ${namelessConvs.rows.length} conversations without names`);
    
    // Test enrichment for each
    for (const conv of namelessConvs.rows) {
      const phone = conv.phone_number;
      const normalized = phone.replace(/\D/g, '').slice(-10);
      
      console.log(`\n   Testing ${phone} (normalized: ${normalized})`);
      
      // Try the exact search approach that worked
      try {
        const response = await axios.post(
          'https://api.hubapi.com/crm/v3/objects/contacts/search',
          {
            filterGroups: [{
              filters: [{
                propertyName: 'phone',
                operator: 'EQ',
                value: '1' + normalized
              }]
            }, {
              filters: [{
                propertyName: 'mobilephone',
                operator: 'EQ',
                value: '+1' + normalized
              }]
            }],
            properties: ['firstname', 'lastname', 'phone', 'mobilephone'],
            limit: 1
          },
          {
            headers: {
              'Authorization': `Bearer ${process.env.HUBSPOT_API_KEY}`,
              'Content-Type': 'application/json'
            }
          }
        );
        
        if (response.data.results.length > 0) {
          const contact = response.data.results[0].properties;
          const name = `${contact.firstname || ''} ${contact.lastname || ''}`.trim();
          console.log(`     ✅ Found: ${name}`);
          
          // Update conversation
          await pool.query(`
            UPDATE openphone_conversations 
            SET customer_name = $1 
            WHERE phone_number = $2
          `, [name, phone]);
          
          console.log(`     ✅ Updated conversation`);
        } else {
          console.log(`     ❌ No contact found`);
        }
      } catch (error) {
        console.log(`     ❌ Error: ${error.message}`);
      }
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

fixHubSpotProduction().catch(console.error);