#!/usr/bin/env tsx

import dotenv from 'dotenv';
import { db } from '../utils/database';
import { openPhoneService } from '../services/openphoneService';
import { logger } from '../utils/logger';
import axios from 'axios';

dotenv.config();

async function updateContactNames() {
  console.log('🔍 Updating contact names from OpenPhone...\n');

  try {
    await db.initialize();
    console.log('✅ Database connected\n');

    // Get all conversations with "Unknown" customer name
    const unknownContacts = await db.query(`
      SELECT DISTINCT phone_number 
      FROM openphone_conversations 
      WHERE customer_name = 'Unknown' OR customer_name IS NULL
    `);

    console.log(`Found ${unknownContacts.rows.length} conversations with unknown names\n`);

    if (!process.env.OPENPHONE_API_KEY) {
      console.error('❌ OPENPHONE_API_KEY not set');
      return;
    }

    const client = axios.create({
      baseURL: 'https://api.openphone.com/v1',
      headers: {
        'Authorization': `Bearer ${process.env.OPENPHONE_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    let updated = 0;
    let notFound = 0;

    for (const row of unknownContacts.rows) {
      const phoneNumber = row.phone_number;
      
      try {
        // Search for contact by phone number
        console.log(`Searching for contact: ${phoneNumber}`);
        
        const response = await client.get('/contacts', {
          params: {
            phoneNumber: phoneNumber,
            limit: 1
          }
        });

        if (response.data.data && response.data.data.length > 0) {
          const contact = response.data.data[0];
          const name = contact.name || `${contact.firstName || ''} ${contact.lastName || ''}`.trim();
          
          if (name && name !== '') {
            // Update the database
            await db.query(`
              UPDATE openphone_conversations 
              SET customer_name = $1 
              WHERE phone_number = $2
            `, [name, phoneNumber]);
            
            console.log(`✅ Updated ${phoneNumber} -> ${name}`);
            updated++;
          } else {
            console.log(`⚠️  No name found for ${phoneNumber}`);
            notFound++;
          }
        } else {
          console.log(`❌ Contact not found: ${phoneNumber}`);
          notFound++;
        }

        // Rate limiting - be nice to their API
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (error: any) {
        console.error(`❌ Error looking up ${phoneNumber}:`, error.response?.data || error.message);
      }
    }

    console.log('\n📊 Summary:');
    console.log(`   ✅ Updated: ${updated} contacts`);
    console.log(`   ❌ Not found: ${notFound} contacts`);

  } catch (error) {
    console.error('Fatal error:', error);
  } finally {
    await db.close();
  }
}

// Run update
updateContactNames().catch(console.error);