const { db } = require('./dist/utils/database');

async function debugSearch() {
  await db.initialize();
  
  console.log('\n=== Debug Knowledge Search ===\n');
  
  // 1. Check if knowledge_store table exists and has data
  const storeCheck = await db.query(`
    SELECT COUNT(*) as count FROM knowledge_store
  `);
  console.log('knowledge_store records:', storeCheck.rows[0].count);
  
  // 2. Check knowledge_audit_log
  const auditCheck = await db.query(`
    SELECT COUNT(*) as count FROM knowledge_audit_log
    WHERE LOWER(new_value) LIKE '%gift%'
  `);
  console.log('knowledge_audit_log gift records:', auditCheck.rows[0].count);
  
  // 3. Test the actual search query for audit log
  const searchTerms = ['gift', 'giftcards', 'sell'];
  const searchConditions = searchTerms.map((term, index) => 
    `(LOWER(new_value) LIKE '%${term}%' OR LOWER(key) LIKE '%${term}%' OR LOWER(category) LIKE '%${term}%')`
  ).join(' OR ');
  
  console.log('\nSearch query:', searchConditions);
  
  const auditResults = await db.query(`
    SELECT 
      action,
      category,
      key,
      new_value,
      assistant_target,
      timestamp
    FROM knowledge_audit_log
    WHERE ${searchConditions}
    ORDER BY timestamp DESC
    LIMIT 5
  `);
  
  console.log('\nAudit log search results:', auditResults.rows.length);
  auditResults.rows.forEach(row => {
    console.log('  Target:', row.assistant_target, 'Category:', row.category);
    console.log('  Value:', row.new_value.substring(0, 100));
  });
  
  // 4. Check assistant type mapping
  console.log('\n=== Testing assistant type mapping ===');
  const assistantMap = {
    'emergency': 'emergency',
    'booking': 'booking',
    'booking & access': 'booking',
    'techsupport': 'tech',
    'tech': 'tech',
    'brandtone': 'brand',
    'brand': 'brand'
  };
  
  const testType = 'brandtone';
  const mappedType = assistantMap[testType.toLowerCase()] || testType;
  console.log(`Input: "${testType}" → Mapped: "${mappedType}"`);
  
  // 5. Check what's actually being searched
  const filteredResults = await db.query(`
    SELECT 
      action,
      category,
      key,
      new_value,
      assistant_target,
      timestamp
    FROM knowledge_audit_log
    WHERE (${searchConditions})
    AND assistant_target = $1
    ORDER BY timestamp DESC
    LIMIT 5
  `, [mappedType]);
  
  console.log(`\nFiltered by assistant_target="${mappedType}":`, filteredResults.rows.length);
  
  process.exit(0);
}

debugSearch().catch(console.error);