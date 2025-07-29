import { db } from '../utils/database';
import { intelligentSOPModule } from '../services/intelligentSOPModule';
import { logger } from '../utils/logger';
import dotenv from 'dotenv';
import { assistantService } from '../services/assistantService';

// Load environment variables
dotenv.config();

/**
 * Verify SOP Module Setup and Database Readiness
 * Run with: npm run verify:sop
 */

async function verifyDatabase() {
  console.log('\n🔍 Verifying Database Setup');
  console.log('━'.repeat(50));
  
  try {
    // Check database connection
    await db.initialize();
    console.log('✅ Database connected successfully');
    
    // Check required tables
    const tables = [
      'openphone_conversations',
      'extracted_knowledge',
      'sop_shadow_comparisons',
      'sop_embeddings',
      'sop_metrics'
    ];
    
    for (const table of tables) {
      const result = await db.query(`
        SELECT COUNT(*) as count FROM information_schema.tables 
        WHERE table_name = $1
      `, [table]);
      
      if (result.rows[0].count > 0) {
        // Get row count
        const countResult = await db.query(`SELECT COUNT(*) as total FROM "${table.replace(/"/g, '""')}"`);
        console.log(`✅ Table '${table}' exists - ${countResult.rows[0].total} rows`);
      } else {
        console.log(`❌ Table '${table}' is missing!`);
      }
    }
    
    // Check if migrations have been run
    const migrationCheck = await db.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'sop_shadow_comparisons' 
      AND column_name = 'assistant_time_ms'
    `);
    
    if (migrationCheck.rows.length > 0) {
      console.log('✅ All migrations appear to be up to date');
    } else {
      console.log('⚠️  Some migrations may be missing');
    }
    
  } catch (error) {
    console.error('❌ Database verification failed:', error);
    return false;
  }
  
  return true;
}

async function verifySOPModule() {
  console.log('\n🧠 Verifying SOP Module');
  console.log('━'.repeat(50));
  
  const status = intelligentSOPModule.getStatus();
  
  console.log(`Initialized: ${status.initialized ? '✅ Yes' : '❌ No'}`);
  console.log(`Document Count: ${status.documentCount}`);
  console.log(`Assistants Configured: ${status.assistants.join(', ')}`);
  
  if (!status.initialized) {
    console.log('\n⚠️  SOP Module not initialized. Attempting initialization...');
    // The module initializes automatically when imported
    await new Promise(resolve => setTimeout(resolve, 3000)); // Give it time
    const newStatus = intelligentSOPModule.getStatus();
    console.log(`After wait - Initialized: ${newStatus.initialized ? '✅ Yes' : '❌ No'}`);
  }
  
  // Check embeddings in database
  if (db.initialized) {
    const embeddingsResult = await db.query(`
      SELECT 
        assistant,
        COUNT(*) as doc_count,
        COUNT(DISTINCT metadata->>'source') as unique_sources
      FROM sop_embeddings
      GROUP BY assistant
    `);
    
    if (embeddingsResult.rows.length > 0) {
      console.log('\n📚 SOP Embeddings in Database:');
      embeddingsResult.rows.forEach(row => {
        console.log(`   ${row.assistant}: ${row.doc_count} documents from ${row.unique_sources} sources`);
      });
    } else {
      console.log('\n⚠️  No embeddings found in database');
    }
  }
  
  return status.initialized;
}

async function testSOPResponse() {
  console.log('\n🧪 Testing SOP Response');
  console.log('━'.repeat(50));
  
  const testQueries = [
    {
      route: 'TechSupport',
      query: 'My TrackMan screen is frozen and I cannot restart it'
    },
    {
      route: 'Booking & Access',
      query: 'I need to cancel my booking for tomorrow'
    },
    {
      route: 'Emergency',
      query: 'There is water leaking from the ceiling in bay 5'
    }
  ];
  
  for (const test of testQueries) {
    console.log(`\n📝 Testing: ${test.route}`);
    console.log(`   Query: "${test.query}"`);
    
    try {
      const response = await intelligentSOPModule.processWithContext(
        test.query,
        test.route,
        { location: 'Test Location' }
      );
      
      console.log(`   ✅ Confidence: ${(response.confidence * 100).toFixed(1)}%`);
      console.log(`   Response preview: ${response.response.substring(0, 100)}...`);
      
    } catch (error) {
      console.error(`   ❌ Error:`, error);
    }
  }
}

async function verifyShadowMode() {
  console.log('\n👥 Verifying Shadow Mode Configuration');
  console.log('━'.repeat(50));
  
  const config = {
    USE_INTELLIGENT_SOP: process.env.USE_INTELLIGENT_SOP === 'true',
    SOP_SHADOW_MODE: process.env.SOP_SHADOW_MODE === 'true',
    SOP_CONFIDENCE_THRESHOLD: parseFloat(process.env.SOP_CONFIDENCE_THRESHOLD || '0.75')
  };
  
  console.log('Current Configuration:');
  console.log(`   USE_INTELLIGENT_SOP: ${config.USE_INTELLIGENT_SOP ? '✅ Enabled' : '❌ Disabled'}`);
  console.log(`   SOP_SHADOW_MODE: ${config.SOP_SHADOW_MODE ? '✅ Enabled' : '❌ Disabled'}`);
  console.log(`   SOP_CONFIDENCE_THRESHOLD: ${config.SOP_CONFIDENCE_THRESHOLD}`);
  
  if (config.USE_INTELLIGENT_SOP && config.SOP_SHADOW_MODE) {
    console.log('\n⚠️  Warning: Both USE_INTELLIGENT_SOP and SOP_SHADOW_MODE are enabled!');
    console.log('   Set SOP_SHADOW_MODE=false when you want to use SOP responses');
  }
  
  // Test assistant service integration
  if (assistantService) {
    console.log('\n🔗 Assistant Service Integration:');
    try {
      // Make a test request to see shadow mode in action
      const testResponse = await assistantService.getAssistantResponse(
        'TechSupport',
        'Test query for shadow mode verification',
        {}
      );
      
      console.log(`   ✅ Assistant service is working`);
      console.log(`   Response source: ${testResponse.assistantId}`);
      
      // Check for shadow comparisons
      if (db.initialized && config.SOP_SHADOW_MODE) {
        const recentComparisons = await db.query(`
          SELECT COUNT(*) as count 
          FROM sop_shadow_comparisons 
          WHERE created_at > NOW() - INTERVAL '1 hour'
        `);
        console.log(`   Shadow comparisons (last hour): ${recentComparisons.rows[0].count}`);
      }
      
    } catch (error) {
      console.error('   ❌ Assistant service test failed:', error);
    }
  }
}

async function checkSOPFiles() {
  console.log('\n📁 Checking SOP Files');
  console.log('━'.repeat(50));
  
  const fs = await import('fs/promises');
  const path = await import('path');
  
  const sopDirs = ['booking', 'emergency', 'tech', 'brand'];
  const projectRoot = path.join(__dirname, '../../..');
  
  for (const dir of sopDirs) {
    const sopPath = path.join(projectRoot, 'sops', dir);
    try {
      const files = await fs.readdir(sopPath);
      console.log(`✅ sops/${dir}/: ${files.length} files`);
      files.forEach(file => {
        console.log(`   - ${file}`);
      });
    } catch (error) {
      console.log(`❌ sops/${dir}/: Directory not found`);
    }
  }
}

async function runAllVerifications() {
  console.log('🚀 SOP System Verification Suite');
  console.log('═'.repeat(50));
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Database URL: ${process.env.DATABASE_URL ? 'Configured' : 'Not configured'}`);
  console.log(`OpenAI API: ${process.env.OPENAI_API_KEY ? 'Configured' : 'Not configured'}`);
  console.log('═'.repeat(50));
  
  // Run all checks
  const dbReady = await verifyDatabase();
  if (!dbReady) {
    console.log('\n❌ Database not ready. Please check your connection.');
    process.exit(1);
  }
  
  await checkSOPFiles();
  const sopReady = await verifySOPModule();
  
  if (sopReady) {
    await testSOPResponse();
  }
  
  await verifyShadowMode();
  
  // Summary
  console.log('\n📊 Verification Summary');
  console.log('═'.repeat(50));
  
  if (dbReady && sopReady) {
    console.log('✅ System is ready for SOP module testing!');
    console.log('\nNext steps:');
    console.log('1. Enable shadow mode: SOP_SHADOW_MODE=true');
    console.log('2. Monitor shadow comparisons in the database');
    console.log('3. Use the Knowledge panel to extract from OpenPhone');
    console.log('4. When confident, switch to: USE_INTELLIGENT_SOP=true, SOP_SHADOW_MODE=false');
  } else {
    console.log('❌ System needs configuration. Check the errors above.');
  }
  
  process.exit(0);
}

// Run verifications
runAllVerifications().catch(error => {
  console.error('Verification suite failed:', error);
  process.exit(1);
});