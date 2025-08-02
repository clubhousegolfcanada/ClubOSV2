#!/usr/bin/env node

require('dotenv').config();
const { Pool } = require('pg');
const axios = require('axios');

async function populateHubSpotCache() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  
  console.log('🔄 Populating HubSpot Cache\n');
  
  try {
    // 1. Get conversations without proper names
    const conversations = await pool.query(`
      SELECT DISTINCT phone_number 
      FROM openphone_conversations 
      WHERE (customer_name IS NULL 
        OR customer_name = 'Unknown' 
        OR customer_name = phone_number)
      AND phone_number IS NOT NULL
      AND phone_number != 'Unknown'
      ORDER BY phone_number
    `);
    
    console.log(`Found ${conversations.rows.length} conversations to check\n`);
    
    let found = 0;
    let notFound = 0;
    let errors = 0;
    
    // Process in batches to avoid rate limits
    for (let i = 0; i < conversations.rows.length; i++) {
      const { phone_number } = conversations.rows[i];
      const normalized = phone_number.replace(/\D/g, '').slice(-10);
      
      console.log(`[${i+1}/${conversations.rows.length}] Checking ${phone_number}...`);
      
      // Try HubSpot lookup
      let contactFound = false;
      const variations = [
        '1' + normalized,
        '+1' + normalized,
        normalized
      ];
      
      for (const variation of variations) {
        try {
          const response = await axios.post(
            'https://api.hubapi.com/crm/v3/objects/contacts/search',
            {
              filterGroups: [{
                filters: [{
                  propertyName: 'phone',
                  operator: 'EQ',
                  value: variation
                }]
              }, {
                filters: [{
                  propertyName: 'mobilephone',
                  operator: 'EQ',
                  value: variation
                }]
              }],
              properties: ['firstname', 'lastname', 'company', 'email', 'phone', 'mobilephone'],
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
            const contact = response.data.results[0];
            const props = contact.properties;
            const name = `${props.firstname || ''} ${props.lastname || ''}`.trim();
            
            if (name) {
              // Cache in database
              await pool.query(`
                INSERT INTO hubspot_cache (phone_number, customer_name, company, email, hubspot_contact_id, updated_at)
                VALUES ($1, $2, $3, $4, $5, NOW())
                ON CONFLICT (phone_number) 
                DO UPDATE SET 
                  customer_name = EXCLUDED.customer_name,
                  company = EXCLUDED.company,
                  email = EXCLUDED.email,
                  hubspot_contact_id = EXCLUDED.hubspot_contact_id,
                  updated_at = NOW()
              `, [phone_number, name, props.company, props.email, contact.id]);
              
              // Update conversation
              await pool.query(`
                UPDATE openphone_conversations 
                SET customer_name = $1
                WHERE phone_number = $2
              `, [name, phone_number]);
              
              console.log(`  ✅ Found: ${name}`);
              found++;
              contactFound = true;
              break;
            }
          }
        } catch (error) {
          if (error.response?.status === 429) {
            console.log('  ⏸️  Rate limited, waiting 2 seconds...');
            await new Promise(resolve => setTimeout(resolve, 2000));
            i--; // Retry this number
            break;
          }
        }
      }
      
      if (!contactFound) {
        // Cache as not found
        await pool.query(`
          INSERT INTO hubspot_cache (phone_number, customer_name, updated_at)
          VALUES ($1, NULL, NOW())
          ON CONFLICT (phone_number) 
          DO UPDATE SET 
            customer_name = NULL,
            updated_at = NOW()
        `, [phone_number]);
        
        console.log(`  ❌ Not found`);
        notFound++;
      }
      
      // Small delay to avoid rate limits
      if (i < conversations.rows.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    console.log('\n📊 Summary:');
    console.log(`   Total checked: ${conversations.rows.length}`);
    console.log(`   Found: ${found}`);
    console.log(`   Not found: ${notFound}`);
    console.log(`   Errors: ${errors}`);
    
    // Show cache stats
    const cacheStats = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(customer_name) as with_names
      FROM hubspot_cache
    `);
    
    console.log('\n💾 Cache Status:');
    console.log(`   Total cached: ${cacheStats.rows[0].total}`);
    console.log(`   With names: ${cacheStats.rows[0].with_names}`);
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

populateHubSpotCache().catch(console.error);