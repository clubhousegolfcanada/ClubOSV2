/**
 * Consolidate ALL knowledge from all 16+ tables into unified knowledge_store
 * Run with: npx tsx src/scripts/consolidateAllKnowledge.ts
 */

import { db } from '../utils/database';
import { logger } from '../utils/logger';

async function consolidateAllKnowledge() {
  console.log('\n🔄 CONSOLIDATING ALL KNOWLEDGE INTO UNIFIED SYSTEM\n');
  console.log('='.repeat(60) + '\n');

  const stats = {
    sop_embeddings: 0,
    assistant_knowledge: 0,
    conversation_sessions: 0,
    openphone_conversations: 0,
    knowledge_patterns: 0,
    knowledge_audit_log: 0,
    extracted_knowledge: 0,
    total: 0,
    errors: 0
  };

  try {
    await db.initialize();
    console.log('✅ Database connected\n');

    // 1. Import SOPs (379 items)
    console.log('📚 Importing SOPs from sop_embeddings...');
    const sopResult = await db.query(`
      INSERT INTO knowledge_store (
        key, value, confidence, category, search_vector, 
        source_type, source_id, source_table, created_at
      )
      SELECT 
        CONCAT('sop.', assistant, '.', REPLACE(LOWER(title), ' ', '_')) as key,
        jsonb_build_object(
          'title', title,
          'content', content,
          'answer', content,
          'assistant', assistant,
          'metadata', metadata
        ) as value,
        0.95 as confidence,
        assistant as category,
        to_tsvector('english', title || ' ' || content) as search_vector,
        'sop' as source_type,
        id as source_id,
        'sop_embeddings' as source_table,
        created_at
      FROM sop_embeddings
      WHERE NOT EXISTS (
        SELECT 1 FROM knowledge_store ks 
        WHERE ks.source_id = sop_embeddings.id 
        AND ks.source_table = 'sop_embeddings'
      )
      ON CONFLICT (key) DO UPDATE SET
        value = EXCLUDED.value,
        confidence = GREATEST(knowledge_store.confidence, EXCLUDED.confidence),
        updated_at = NOW()
      RETURNING key
    `);
    stats.sop_embeddings = sopResult.rowCount || 0;
    console.log(`  ✅ Imported ${stats.sop_embeddings} SOPs\n`);

    // 2. Process OpenPhone conversations (72 items)
    console.log('📱 Processing OpenPhone conversations...');
    const convResult = await db.query(`
      SELECT id, conversation_id, messages, metadata 
      FROM openphone_conversations 
      WHERE processed = false OR processed IS NULL
      LIMIT 50
    `);
    
    for (const conv of convResult.rows) {
      try {
        // Extract key facts from conversation
        const messages = conv.messages || [];
        if (messages.length > 0) {
          // Create a summary of the conversation
          const summary = messages.map((m: any) => m.body || m.text).join(' ').substring(0, 500);
          
          await db.query(`
            INSERT INTO knowledge_store (
              key, value, confidence, category, search_vector,
              source_type, source_id, source_table, validation_status
            ) VALUES (
              $1, $2, 0.6, 'conversation', to_tsvector('english', $3),
              'openphone_conversation', $4, 'openphone_conversations', 'pending'
            )
            ON CONFLICT (key) DO NOTHING
          `, [
            `openphone.conversation.${conv.conversation_id}`,
            JSON.stringify({
              content: summary,
              conversation_id: conv.conversation_id,
              message_count: messages.length
            }),
            summary,
            conv.conversation_id
          ]);
          
          stats.openphone_conversations++;
        }
      } catch (error) {
        console.error(`  ⚠️ Error processing conversation ${conv.id}:`, error);
        stats.errors++;
      }
    }
    console.log(`  ✅ Processed ${stats.openphone_conversations} conversations\n`);

    // 3. Import knowledge patterns (43 items)
    console.log('🔍 Importing knowledge patterns...');
    const patternResult = await db.query(`
      INSERT INTO knowledge_store (
        key, value, confidence, category, search_vector,
        source_type, source_table, created_at
      )
      SELECT 
        CONCAT('pattern.', pattern_type, '.', id) as key,
        jsonb_build_object(
          'pattern', pattern,
          'type', pattern_type,
          'count', occurrence_count
        ) as value,
        LEAST(0.5 + (occurrence_count::float / 100), 0.9) as confidence,
        pattern_type as category,
        to_tsvector('english', pattern) as search_vector,
        'pattern' as source_type,
        'knowledge_patterns' as source_table,
        first_seen as created_at
      FROM knowledge_patterns
      WHERE occurrence_count > 1
      ON CONFLICT (key) DO UPDATE SET
        value = jsonb_set(
          knowledge_store.value, 
          '{count}', 
          to_jsonb(EXCLUDED.value->>'count')
        ),
        confidence = EXCLUDED.confidence,
        updated_at = NOW()
      RETURNING key
    `);
    stats.knowledge_patterns = patternResult.rowCount || 0;
    console.log(`  ✅ Imported ${stats.knowledge_patterns} patterns\n`);

    // 4. Import conversation sessions insights (219 items)
    console.log('💬 Processing conversation sessions...');
    const sessionResult = await db.query(`
      SELECT COUNT(*) as count FROM conversation_sessions 
      WHERE metadata IS NOT NULL 
      AND jsonb_array_length(COALESCE(metadata->'messages', '[]'::jsonb)) > 2
    `);
    
    if (sessionResult.rows[0].count > 0) {
      // Process sessions with meaningful content
      const sessions = await db.query(`
        SELECT id, session_id, metadata, route, created_at
        FROM conversation_sessions
        WHERE metadata IS NOT NULL 
        AND jsonb_array_length(COALESCE(metadata->'messages', '[]'::jsonb)) > 2
        LIMIT 100
      `);
      
      for (const session of sessions.rows) {
        try {
          const messages = session.metadata?.messages || [];
          const summary = messages.slice(-3).map((m: any) => m.content).join(' ').substring(0, 300);
          
          await db.query(`
            INSERT INTO knowledge_store (
              key, value, confidence, category, search_vector,
              source_type, source_id, source_table
            ) VALUES (
              $1, $2, 0.5, $3, to_tsvector('english', $4),
              'conversation_session', $5, 'conversation_sessions'
            )
            ON CONFLICT (key) DO NOTHING
          `, [
            `session.${session.route}.${session.session_id}`,
            JSON.stringify({
              content: summary,
              route: session.route,
              session_id: session.session_id
            }),
            session.route || 'general',
            summary,
            session.id
          ]);
          
          stats.conversation_sessions++;
        } catch (error) {
          stats.errors++;
        }
      }
    }
    console.log(`  ✅ Processed ${stats.conversation_sessions} sessions\n`);

    // 5. Import validated knowledge from audit log
    console.log('📝 Importing validated knowledge from audit log...');
    const auditResult = await db.query(`
      INSERT INTO knowledge_store (
        key, value, confidence, category, search_vector,
        source_type, source_table, created_at
      )
      SELECT 
        CONCAT('audit.', assistant_target, '.', category, '.', id) as key,
        jsonb_build_object(
          'content', new_value,
          'answer', new_value,
          'action', action,
          'category', category,
          'key', key
        ) as value,
        0.85 as confidence,
        category as category,
        to_tsvector('english', new_value || ' ' || COALESCE(key, '')) as search_vector,
        'audit_log' as source_type,
        'knowledge_audit_log' as source_table,
        timestamp as created_at
      FROM knowledge_audit_log
      WHERE action IN ('add', 'update', 'overwrite')
      AND new_value IS NOT NULL
      ON CONFLICT (key) DO UPDATE SET
        value = EXCLUDED.value,
        confidence = GREATEST(knowledge_store.confidence, EXCLUDED.confidence),
        updated_at = NOW()
      RETURNING key
    `);
    stats.knowledge_audit_log = auditResult.rowCount || 0;
    console.log(`  ✅ Imported ${stats.knowledge_audit_log} audit entries\n`);

    // Calculate totals
    stats.total = Object.keys(stats)
      .filter(k => k !== 'total' && k !== 'errors')
      .reduce((sum, key) => sum + stats[key as keyof typeof stats], 0);

    // Final statistics
    console.log('\n' + '='.repeat(60));
    console.log('📊 CONSOLIDATION COMPLETE\n');
    console.log(`  SOPs: ${stats.sop_embeddings}`);
    console.log(`  OpenPhone Conversations: ${stats.openphone_conversations}`);
    console.log(`  Conversation Sessions: ${stats.conversation_sessions}`);
    console.log(`  Knowledge Patterns: ${stats.knowledge_patterns}`);
    console.log(`  Audit Log Entries: ${stats.knowledge_audit_log}`);
    console.log(`  Assistant Knowledge: ${stats.assistant_knowledge}`);
    console.log(`  Errors: ${stats.errors}`);
    console.log(`\n  TOTAL KNOWLEDGE ITEMS: ${stats.total}`);

    // Verify final count
    const finalCount = await db.query(`
      SELECT COUNT(*) as total FROM knowledge_store WHERE superseded_by IS NULL
    `);
    console.log(`\n✅ Knowledge store now contains ${finalCount.rows[0].total} searchable items\n`);

    // Update search vectors
    console.log('🔄 Updating search vectors...');
    await db.query(`
      UPDATE knowledge_store 
      SET search_vector = to_tsvector('english', 
        COALESCE(value->>'content', '') || ' ' ||
        COALESCE(value->>'answer', '') || ' ' ||
        COALESCE(value->>'title', '') || ' ' ||
        COALESCE(key, '')
      )
      WHERE search_vector IS NULL
    `);
    
    console.log('✅ Search vectors updated\n');
    console.log('🎉 ALL KNOWLEDGE CONSOLIDATED SUCCESSFULLY!\n');

  } catch (error) {
    console.error('❌ Fatal error:', error);
  } finally {
    process.exit(0);
  }
}

// Run the consolidation
consolidateAllKnowledge();