const { db } = require('./dist/utils/database');

async function checkKnowledge() {
  await db.initialize();
  
  console.log('\n=== Checking knowledge_store table ===\n');
  
  // Check what's in knowledge_store
  const storeResult = await db.query(`
    SELECT key, value, confidence, created_at 
    FROM knowledge_store 
    WHERE key LIKE '%gift%' OR value::text ILIKE '%gift%'
    ORDER BY created_at DESC
    LIMIT 5
  `);
  
  console.log('Gift card knowledge in knowledge_store:');
  if (storeResult.rows.length === 0) {
    console.log('  No gift card knowledge found');
  } else {
    storeResult.rows.forEach(row => {
      console.log({
        key: row.key,
        value: row.value,
        confidence: row.confidence,
        created: row.created_at
      });
    });
  }
  
  console.log('\n=== Checking assistant_knowledge table ===\n');
  
  // Check assistant_knowledge
  const assistantResult = await db.query(`
    SELECT route, fact, tags, created_at
    FROM assistant_knowledge
    WHERE LOWER(fact) LIKE '%gift%' OR LOWER(tags::text) LIKE '%gift%'
    ORDER BY created_at DESC
    LIMIT 5
  `);
  
  console.log('Gift card knowledge in assistant_knowledge:');
  if (assistantResult.rows.length === 0) {
    console.log('  No gift card knowledge found');
  } else {
    assistantResult.rows.forEach(row => {
      console.log({
        route: row.route,
        fact: row.fact,
        tags: row.tags,
        created: row.created_at
      });
    });
  }
  
  console.log('\n=== Checking knowledge_audit_log table ===\n');
  
  // Check audit log
  const auditResult = await db.query(`
    SELECT action, category, key, new_value, assistant_target, timestamp
    FROM knowledge_audit_log
    WHERE LOWER(new_value) LIKE '%gift%' OR LOWER(key) LIKE '%gift%'
    ORDER BY timestamp DESC
    LIMIT 5
  `);
  
  console.log('Gift card knowledge in audit log:');
  if (auditResult.rows.length === 0) {
    console.log('  No gift card knowledge found');
  } else {
    auditResult.rows.forEach(row => {
      console.log({
        action: row.action,
        category: row.category,
        key: row.key,
        value: row.new_value.substring(0, 100) + '...',
        target: row.assistant_target,
        time: row.timestamp
      });
    });
  }
  
  process.exit(0);
}

checkKnowledge().catch(console.error);