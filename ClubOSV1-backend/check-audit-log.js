const { Pool } = require('pg');

async function checkAuditLog() {
  const pool = new Pool({
    connectionString: "postgresql://postgres:FnlIdpRyrGXKyzhLEdxTCxuVXJcOyxeI@yamanote.proxy.rlwy.net:31482/railway"
  });

  try {
    // Check what's in knowledge_audit_log
    const result = await pool.query(`
      SELECT 
        action,
        category,
        key,
        new_value,
        assistant_target,
        timestamp
      FROM knowledge_audit_log
      WHERE LOWER(new_value) LIKE '%gift%'
      ORDER BY timestamp DESC
      LIMIT 10
    `);

    console.log('Gift card entries in knowledge_audit_log:');
    console.log('Total found:', result.rows.length);
    console.log('');
    
    result.rows.forEach((row, i) => {
      console.log(`Entry ${i + 1}:`);
      console.log('  Assistant Target:', row.assistant_target);
      console.log('  Category:', row.category);
      console.log('  Action:', row.action);
      console.log('  Value:', row.new_value.substring(0, 100) + '...');
      console.log('  Time:', row.timestamp);
      console.log('');
    });

    // Check if BrandTone would find anything
    const brandResult = await pool.query(`
      SELECT COUNT(*) as count
      FROM knowledge_audit_log
      WHERE LOWER(new_value) LIKE '%gift%'
      AND assistant_target = 'brand'
    `);
    
    console.log('Entries for BrandTone (brand):', brandResult.rows[0].count);
    
    const bookingResult = await pool.query(`
      SELECT COUNT(*) as count
      FROM knowledge_audit_log
      WHERE LOWER(new_value) LIKE '%gift%'
      AND assistant_target = 'booking'
    `);
    
    console.log('Entries for Booking & Access (booking):', bookingResult.rows[0].count);

  } finally {
    await pool.end();
  }
}

checkAuditLog().catch(console.error);