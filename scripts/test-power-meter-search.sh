#!/bin/bash

# Test script to check power meter data in knowledge_store
echo "Testing power meter knowledge retrieval..."

# Connect to local database and test queries
cd "/Users/michaelbelairch1/Desktop/Clubhouse OS (Root)/CLUBOSV1/ClubOSV1-backend"

# Run various test queries
npx tsx -e "
import { db } from './src/utils/database';

async function testPowerMeter() {
  try {
    // Check if database is connected
    const connected = await db.isEnabled();
    console.log('Database connected:', connected);

    if (!connected) {
      console.log('Database not connected. Exiting...');
      return;
    }

    // Test 1: Check if any power meter entries exist
    console.log('\\n=== Test 1: Searching for power meter entries ===');
    const powerEntries = await db.query(\`
      SELECT key, value, confidence, search_vector IS NOT NULL as has_vector
      FROM knowledge_store
      WHERE key ILIKE '%power%' OR value::text ILIKE '%power meter%'
      LIMIT 5
    \`);
    console.log('Power meter entries found:', powerEntries.rowCount);
    powerEntries.rows.forEach(row => {
      console.log('- Key:', row.key);
      console.log('  Has search_vector:', row.has_vector);
      console.log('  Value preview:', JSON.stringify(row.value).substring(0, 100));
    });

    // Test 2: Check for 2214683 specifically
    console.log('\\n=== Test 2: Searching for meter number 2214683 ===');
    const meterNumber = await db.query(\`
      SELECT key, value, confidence
      FROM knowledge_store
      WHERE value::text ILIKE '%2214683%' OR key ILIKE '%2214683%'
      LIMIT 5
    \`);
    console.log('Entries with 2214683:', meterNumber.rowCount);
    meterNumber.rows.forEach(row => {
      console.log('- Key:', row.key);
      console.log('  Value:', JSON.stringify(row.value));
    });

    // Test 3: Test the actual search query from llm.ts
    console.log('\\n=== Test 3: Testing full-text search (as llm.ts does) ===');
    const searchTerms = ['power meter', 'power meter 2214683', 'meter 2214683', '2214683'];

    for (const term of searchTerms) {
      console.log(\`\\nSearching for: \"\${term}\"\`);
      const searchResult = await db.query(\`
        SELECT key, value, confidence
        FROM knowledge_store
        WHERE
          search_vector @@ plainto_tsquery('english', \$1)
          AND superseded_by IS NULL
          AND verification_status != 'rejected'
        ORDER BY
          verification_status = 'verified' DESC,
          confidence DESC,
          updated_at DESC
        LIMIT 3
      \`, [term]);

      console.log(\`  Results: \${searchResult.rowCount}\`);
      searchResult.rows.forEach(row => {
        console.log(\`  - Key: \${row.key}, Confidence: \${row.confidence}\`);
      });
    }

    // Test 4: Check if search_vector is populated
    console.log('\\n=== Test 4: Checking search_vector population ===');
    const vectorCheck = await db.query(\`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN search_vector IS NOT NULL THEN 1 ELSE 0 END) as with_vector,
        SUM(CASE WHEN search_vector IS NULL THEN 1 ELSE 0 END) as without_vector
      FROM knowledge_store
    \`);
    const stats = vectorCheck.rows[0];
    console.log('Total entries:', stats.total);
    console.log('With search_vector:', stats.with_vector);
    console.log('Without search_vector:', stats.without_vector);

    // Test 5: Try adding power meter data if none exists
    console.log('\\n=== Test 5: Checking/Adding power meter test data ===');
    const testKey = 'power_meter_2214683';
    const existing = await db.query(
      'SELECT key FROM knowledge_store WHERE key = \$1',
      [testKey]
    );

    if (existing.rowCount === 0) {
      console.log('Adding test power meter entry...');
      await db.query(\`
        INSERT INTO knowledge_store (key, value, confidence, verification_status, category)
        VALUES (\$1, \$2, 1.0, 'verified', 'equipment')
      \`, [
        testKey,
        JSON.stringify({
          question: 'What is the power meter number?',
          response: 'The power meter number is 2214683. This meter is located in the main electrical room.',
          category: 'equipment',
          tags: ['power', 'meter', 'electrical', '2214683']
        })
      ]);
      console.log('Test entry added successfully!');

      // Wait for trigger to populate search_vector
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Test search again
      const newSearch = await db.query(\`
        SELECT key, value, confidence
        FROM knowledge_store
        WHERE search_vector @@ plainto_tsquery('english', \$1)
        LIMIT 1
      \`, ['power meter']);

      console.log('New search after adding entry:', newSearch.rowCount, 'results');
    } else {
      console.log('Test entry already exists');
    }

  } catch (error) {
    console.error('Error testing power meter:', error);
  } finally {
    await db.end();
  }
}

testPowerMeter();
"