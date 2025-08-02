#!/usr/bin/env node

require('dotenv').config();
const { Pool } = require('pg');
const axios = require('axios');

async function checkHubSpotCacheIssue() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  
  console.log('🔍 HubSpot Cache Investigation\n');
  
  try {
    // 1. Check cache table structure
    console.log('1. Cache table structure:');
    const columns = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'hubspot_cache'
      ORDER BY ordinal_position
    `);
    
    console.log('   Columns:');
    columns.rows.forEach(col => {
      console.log(`   - ${col.column_name} (${col.data_type})`);
    });
    
    // 2. Check if contacts are being cached but not updating conversations
    console.log('\n2. Checking for contacts that should have names:');
    
    // Get Roger Kugler's info
    const rogerCheck = await pool.query(`
      SELECT 
        c.phone_number,
        c.customer_name as conv_name,
        h.customer_name as cache_name,
        h.company,
        h.updated_at as cache_updated,
        c.updated_at as conv_updated
      FROM openphone_conversations c
      LEFT JOIN hubspot_cache h ON h.phone_number = c.phone_number
      WHERE c.phone_number = '+19024998318'
    `);
    
    if (rogerCheck.rows.length > 0) {
      const roger = rogerCheck.rows[0];
      console.log(`\n   Roger Kugler (+19024998318):`);
      console.log(`   - Conversation name: "${roger.conv_name}"`);
      console.log(`   - Cache name: "${roger.cache_name || 'NOT CACHED'}"`);
      console.log(`   - Cache updated: ${roger.cache_updated || 'Never'}`);
      console.log(`   - Conversation updated: ${roger.conv_updated}`);
    }
    
    // 3. Check why some lookups fail
    console.log('\n3. Testing numbers that failed lookup:');
    const failedNumbers = ['+19028778656', '+19024788262', '+18005550100'];
    
    for (const phone of failedNumbers) {
      console.log(`\n   Testing ${phone}:`);
      
      // Check if it's cached as "not found"
      const cached = await pool.query(
        'SELECT * FROM hubspot_cache WHERE phone_number = $1',
        [phone]
      );
      
      if (cached.rows.length > 0) {
        console.log(`     Cached: ${cached.rows[0].customer_name || 'NULL (not found)'}`);
      } else {
        console.log(`     Not in cache`);
      }
      
      // Try direct API lookup
      await testDirectLookup(phone);
    }
    
    // 4. Check if the issue is with the update logic
    console.log('\n4. Checking update logic issue:');
    const needsUpdate = await pool.query(`
      SELECT 
        c.phone_number,
        c.customer_name,
        h.customer_name as hubspot_name,
        h.company
      FROM openphone_conversations c
      JOIN hubspot_cache h ON h.phone_number = c.phone_number
      WHERE h.customer_name IS NOT NULL
        AND h.customer_name != 'Unknown'
        AND (c.customer_name IS NULL 
          OR c.customer_name = 'Unknown' 
          OR c.customer_name = c.phone_number)
      LIMIT 10
    `);
    
    console.log(`   Found ${needsUpdate.rows.length} conversations that have HubSpot data but no name`);
    needsUpdate.rows.forEach(row => {
      console.log(`   - ${row.phone_number}: Conv="${row.customer_name}" HubSpot="${row.hubspot_name}"`);
    });
    
    // 5. Manual update test for Roger
    if (needsUpdate.rows.length > 0 || rogerCheck.rows[0]?.cache_name) {
      console.log('\n5. Testing manual update:');
      const testPhone = rogerCheck.rows[0]?.cache_name ? '+19024998318' : needsUpdate.rows[0].phone_number;
      
      // First, ensure it's in cache
      await pool.query(`
        INSERT INTO hubspot_cache (phone_number, customer_name, company, updated_at)
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT (phone_number) 
        DO UPDATE SET 
          customer_name = EXCLUDED.customer_name,
          company = EXCLUDED.company,
          updated_at = NOW()
      `, [testPhone, 'Roger Kugler', null]);
      
      // Then update conversation
      const updateResult = await pool.query(`
        UPDATE openphone_conversations 
        SET customer_name = $1
        WHERE phone_number = $2
        RETURNING *
      `, ['Roger Kugler', testPhone]);
      
      if (updateResult.rows.length > 0) {
        console.log(`   ✅ Successfully updated ${testPhone} to "Roger Kugler"`);
      }
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

async function testDirectLookup(phone) {
  const normalized = phone.replace(/\D/g, '').slice(-10);
  
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
            value: '1' + normalized
          }]
        }],
        properties: ['firstname', 'lastname', 'email', 'hs_lead_status'],
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
      console.log(`     ✅ Found in HubSpot: "${name}" (${contact.email || 'no email'})`);
    } else {
      console.log(`     ❌ Not found in HubSpot`);
    }
  } catch (error) {
    console.log(`     ❌ API Error: ${error.response?.status || error.message}`);
  }
}

checkHubSpotCacheIssue().catch(console.error);