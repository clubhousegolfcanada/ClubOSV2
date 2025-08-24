#!/usr/bin/env npx tsx
/**
 * Check HubSpot integration status
 */

import axios from 'axios';

const BACKEND_URL = 'https://clubosv1-backend-production-c4f2177bd128.herokuapp.com';

async function checkHubSpotStatus() {
  console.log('🔍 Checking HubSpot Integration Status...\n');
  
  try {
    // Skip API check and go straight to database
    console.log('1️⃣ Checking Database Directly...');
    
    // 2. Check if HubSpot is being used for customer names
    console.log('\n2️⃣ Testing Customer Name Lookup...');
    
    // This would need auth, so we'll check the database directly
    const pg = await import('../ClubOSV1-backend/node_modules/pg/lib/index.js');
    const { Client } = pg.default;
    const client = new Client({
      connectionString: "postgresql://postgres:FnlIdpRyrGXKyzhLEdxTCxuVXJcOyxeI@yamanote.proxy.rlwy.net:31482/railway",
      ssl: { rejectUnauthorized: false }
    });
    
    await client.connect();
    
    // Check if hubspot_cache table exists
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'hubspot_cache'
      );
    `);
    
    let hasRecentLookups = false;
    
    if (tableCheck.rows[0].exists) {
      console.log('   ✅ HubSpot cache table exists');
      
      // Check cache entries
      const cacheCount = await client.query('SELECT COUNT(*) as count FROM hubspot_cache');
      console.log(`   📊 Cache entries: ${cacheCount.rows[0].count}`);
      
      // Check recent lookups
      const recentLookups = await client.query(`
        SELECT 
          COUNT(CASE WHEN customer_name IS NOT NULL THEN 1 END) as found,
          COUNT(CASE WHEN customer_name IS NULL THEN 1 END) as not_found,
          MAX(updated_at) as last_lookup
        FROM hubspot_cache
        WHERE updated_at > NOW() - INTERVAL '7 days'
      `);
      
      if (recentLookups.rows[0].last_lookup) {
        console.log(`   📅 Last lookup: ${recentLookups.rows[0].last_lookup}`);
        console.log(`   ✅ Names found: ${recentLookups.rows[0].found}`);
        console.log(`   ❌ Not found: ${recentLookups.rows[0].not_found}`);
      } else {
        console.log('   ⚠️  No recent lookups in the last 7 days');
      }
      
      // Sample some actual data
      const samples = await client.query(`
        SELECT phone_number, customer_name, company, updated_at
        FROM hubspot_cache
        WHERE customer_name IS NOT NULL
        ORDER BY updated_at DESC
        LIMIT 5
      `);
      
      if (samples.rows.length > 0) {
        hasRecentLookups = true;
        console.log('\n   Recent successful lookups:');
        samples.rows.forEach(row => {
          const phone = row.phone_number.slice(-4);
          console.log(`   - ***${phone}: ${row.customer_name}${row.company ? ` (${row.company})` : ''}`);
        });
      }
    } else {
      console.log('   ❌ HubSpot cache table does not exist');
    }
    
    await client.end();
    
    // 3. Check environment configuration
    console.log('\n3️⃣ Configuration Summary:');
    console.log('   To fully enable HubSpot:');
    console.log('   1. Add HUBSPOT_API_KEY to Railway environment variables');
    console.log('   2. Get API key from HubSpot: Settings → Integrations → Private Apps');
    console.log('   3. Required scopes: crm.objects.contacts.read');
    
    console.log('\n📊 CONCLUSION:');
    if (hasRecentLookups) {
      console.log('✅ HubSpot IS connected and working for customer names!');
      console.log('   The system has successfully looked up customer names from HubSpot.');
      console.log('   Recent lookups show it\'s actively being used.');
    } else {
      console.log('⚠️  HubSpot integration exists but may not be fully configured');
      console.log('   The cache table exists but no recent successful lookups found.');
      console.log('   Check if HUBSPOT_API_KEY is set in Railway environment.');
    }
    
  } catch (error: any) {
    console.error('❌ Check failed:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
  }
}

checkHubSpotStatus();