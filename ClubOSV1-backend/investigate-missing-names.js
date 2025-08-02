#!/usr/bin/env node

require('dotenv').config();
const { Pool } = require('pg');
const axios = require('axios');

async function investigateMissingNames() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  
  console.log('🔍 Investigating Missing HubSpot Names\n');
  
  try {
    // 1. Test specific number: Roger Kugler
    console.log('1. Testing Roger Kugler (+19024998318):');
    await testSpecificNumber('+19024998318', 'Roger Kugler');
    
    // 2. Get sample of conversations without names
    console.log('\n2. Analyzing conversations without names:');
    const nameless = await pool.query(`
      SELECT 
        phone_number,
        customer_name,
        created_at,
        updated_at,
        jsonb_array_length(messages) as message_count
      FROM openphone_conversations
      WHERE (customer_name IS NULL 
        OR customer_name = 'Unknown' 
        OR customer_name = phone_number)
      AND phone_number IS NOT NULL
      AND phone_number != 'Unknown'
      ORDER BY updated_at DESC
      LIMIT 10
    `);
    
    console.log(`   Found ${nameless.rows.length} recent conversations without names\n`);
    
    // 3. Test each one with different strategies
    for (const conv of nameless.rows) {
      console.log(`\n   Testing: ${conv.phone_number}`);
      await testAllFormats(conv.phone_number);
    }
    
    // 4. Check cache misses
    console.log('\n3. Checking cache behavior:');
    const cacheStats = await pool.query(`
      SELECT 
        COUNT(*) as total_cached,
        COUNT(CASE WHEN customer_name IS NOT NULL THEN 1 END) as with_names,
        COUNT(CASE WHEN customer_name IS NULL THEN 1 END) as without_names,
        COUNT(CASE WHEN last_checked < NOW() - INTERVAL '24 hours' THEN 1 END) as stale_entries
      FROM hubspot_cache
    `);
    
    const stats = cacheStats.rows[0];
    console.log(`   Total cached: ${stats.total_cached}`);
    console.log(`   With names: ${stats.with_names}`);
    console.log(`   Without names (not found): ${stats.without_names}`);
    console.log(`   Stale entries: ${stats.stale_entries}`);
    
    // 5. Look for patterns in phone formats
    console.log('\n4. Phone format analysis:');
    const patterns = await pool.query(`
      SELECT 
        CASE 
          WHEN customer_name IS NULL OR customer_name = 'Unknown' OR customer_name = phone_number 
          THEN 'No Name' 
          ELSE 'Has Name' 
        END as status,
        COUNT(*) as count,
        ARRAY_AGG(DISTINCT 
          CASE 
            WHEN phone_number LIKE '+1%' THEN '+1 prefix'
            WHEN phone_number LIKE '1%' THEN '1 prefix'
            WHEN phone_number ~ '^[0-9]{10}$' THEN '10 digits'
            ELSE 'other'
          END
        ) as formats
      FROM openphone_conversations
      WHERE phone_number IS NOT NULL
      GROUP BY status
    `);
    
    patterns.rows.forEach(row => {
      console.log(`   ${row.status}: ${row.count} (formats: ${row.formats.join(', ')})`);
    });
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

async function testSpecificNumber(phoneNumber, expectedName) {
  const normalized = phoneNumber.replace(/\D/g, '').slice(-10);
  const formats = [
    { value: '1' + normalized, desc: '1 + 10 digits' },
    { value: '+1' + normalized, desc: '+1 + 10 digits' },
    { value: normalized, desc: '10 digits only' },
    { value: phoneNumber, desc: 'Original format' },
  ];
  
  for (const format of formats) {
    try {
      const response = await axios.post(
        'https://api.hubapi.com/crm/v3/objects/contacts/search',
        {
          filterGroups: [{
            filters: [{
              propertyName: 'phone',
              operator: 'EQ',
              value: format.value
            }]
          }, {
            filters: [{
              propertyName: 'mobilephone',
              operator: 'EQ',
              value: format.value
            }]
          }],
          properties: ['firstname', 'lastname', 'phone', 'mobilephone', 'hs_lead_status'],
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
        console.log(`   ✅ Found with ${format.desc}: "${name}"`);
        console.log(`      Phone: ${contact.phone || 'null'}`);
        console.log(`      Mobile: ${contact.mobilephone || 'null'}`);
        console.log(`      Status: ${contact.hs_lead_status || 'null'}`);
        if (name === expectedName) {
          console.log(`      ✅ Matches expected name!`);
        }
        return true;
      }
    } catch (error) {
      console.log(`   ❌ Error with ${format.desc}: ${error.message}`);
    }
  }
  
  console.log(`   ❌ Not found in any format`);
  return false;
}

async function testAllFormats(phoneNumber) {
  const normalized = phoneNumber.replace(/\D/g, '').slice(-10);
  
  // Try different search strategies
  const strategies = [
    {
      name: 'Exact match both fields',
      filterGroups: [{
        filters: [
          { propertyName: 'phone', operator: 'EQ', value: '1' + normalized },
          { propertyName: 'mobilephone', operator: 'EQ', value: '1' + normalized }
        ]
      }]
    },
    {
      name: 'Phone contains',
      filterGroups: [{
        filters: [
          { propertyName: 'phone', operator: 'CONTAINS_TOKEN', value: normalized }
        ]
      }]
    },
    {
      name: 'All phone fields',
      filterGroups: [{
        filters: [
          { propertyName: 'phone', operator: 'EQ', value: '1' + normalized }
        ]
      }, {
        filters: [
          { propertyName: 'mobilephone', operator: 'EQ', value: '1' + normalized }
        ]
      }, {
        filters: [
          { propertyName: 'phone', operator: 'EQ', value: '+1' + normalized }
        ]
      }, {
        filters: [
          { propertyName: 'mobilephone', operator: 'EQ', value: '+1' + normalized }
        ]
      }]
    }
  ];
  
  for (const strategy of strategies) {
    try {
      const response = await axios.post(
        'https://api.hubapi.com/crm/v3/objects/contacts/search',
        {
          ...strategy,
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
        console.log(`     ✅ ${strategy.name}: Found "${name}"`);
        return true;
      }
    } catch (error) {
      // Silently continue
    }
  }
  
  console.log(`     ❌ Not found with any strategy`);
  return false;
}

investigateMissingNames().catch(console.error);