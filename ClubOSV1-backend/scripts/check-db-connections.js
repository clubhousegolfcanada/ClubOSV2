#!/usr/bin/env node

/**
 * Script to check PostgreSQL connection settings and current usage
 * Run with: node scripts/check-db-connections.js
 */

const { Pool } = require('pg');

// Use Railway production database URL
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:FnlIdpRyrGXKyzhLEdxTCxuVXJcOyxeI@yamanote.proxy.rlwy.net:31482/railway';

async function checkConnections() {
  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 1 // Use minimal connections for this check
  });

  try {
    console.log('🔍 Checking PostgreSQL Connection Settings...\n');
    
    // 1. Check max_connections setting
    const maxConnResult = await pool.query('SHOW max_connections;');
    console.log(`✅ max_connections: ${maxConnResult.rows[0].max_connections}`);
    
    // 2. Check current connection count
    const connCountResult = await pool.query(`
      SELECT count(*) as connection_count 
      FROM pg_stat_activity 
      WHERE datname = current_database()
    `);
    console.log(`📊 Current connections to this database: ${connCountResult.rows[0].connection_count}`);
    
    // 3. Check connection breakdown by state
    const connStateResult = await pool.query(`
      SELECT state, count(*) as count 
      FROM pg_stat_activity 
      WHERE datname = current_database() 
      GROUP BY state
      ORDER BY count DESC
    `);
    console.log('\n📈 Connections by state:');
    connStateResult.rows.forEach(row => {
      console.log(`   ${row.state || 'active'}: ${row.count}`);
    });
    
    // 4. Check connection limit per user
    const userLimitResult = await pool.query(`
      SELECT rolname, rolconnlimit 
      FROM pg_roles 
      WHERE rolname = current_user
    `);
    const userLimit = userLimitResult.rows[0].rolconnlimit;
    console.log(`\n👤 Connection limit for user '${userLimitResult.rows[0].rolname}': ${userLimit === -1 ? 'unlimited' : userLimit}`);
    
    // 5. Check database connection limit
    const dbLimitResult = await pool.query(`
      SELECT datname, datconnlimit 
      FROM pg_database 
      WHERE datname = current_database()
    `);
    const dbLimit = dbLimitResult.rows[0].datconnlimit;
    console.log(`🗄️  Connection limit for database '${dbLimitResult.rows[0].datname}': ${dbLimit === -1 ? 'unlimited' : dbLimit}`);
    
    // 6. Show all current connections with details
    const detailedConns = await pool.query(`
      SELECT 
        pid,
        usename,
        application_name,
        client_addr,
        state,
        state_change,
        query_start,
        SUBSTRING(query, 1, 50) as query_preview
      FROM pg_stat_activity 
      WHERE datname = current_database()
      ORDER BY state_change DESC
      LIMIT 10
    `);
    
    console.log('\n📋 Recent connections (top 10):');
    console.log('─'.repeat(80));
    detailedConns.rows.forEach(conn => {
      console.log(`PID: ${conn.pid} | User: ${conn.usename} | App: ${conn.application_name}`);
      console.log(`State: ${conn.state || 'active'} | Client: ${conn.client_addr || 'local'}`);
      console.log(`Query: ${conn.query_preview || 'none'}...`);
      console.log('─'.repeat(80));
    });
    
    // 7. Check for connection leaks (idle connections > 5 minutes)
    const idleConns = await pool.query(`
      SELECT count(*) as idle_count
      FROM pg_stat_activity 
      WHERE datname = current_database()
        AND state = 'idle'
        AND state_change < NOW() - INTERVAL '5 minutes'
    `);
    
    if (idleConns.rows[0].idle_count > 0) {
      console.log(`\n⚠️  WARNING: ${idleConns.rows[0].idle_count} connections have been idle for > 5 minutes`);
    }
    
    // Recommendations
    console.log('\n💡 Recommendations:');
    const maxConn = parseInt(maxConnResult.rows[0].max_connections);
    const currentConn = parseInt(connCountResult.rows[0].connection_count);
    
    if (maxConn <= 100) {
      console.log(`   - max_connections (${maxConn}) seems low for Railway Pro plan`);
      console.log('   - Consider asking Railway support to increase it');
    }
    
    if (dbLimit > -1 && dbLimit < 50) {
      console.log(`   - Database connection limit (${dbLimit}) is restrictive`);
      console.log('   - This is likely causing the "2/2 connections" issue');
    }
    
    if (userLimit > -1 && userLimit < 50) {
      console.log(`   - User connection limit (${userLimit}) is restrictive`);
      console.log('   - This is likely causing the "2/2 connections" issue');
    }
    
    if (currentConn > maxConn * 0.8) {
      console.log('   - Currently using > 80% of available connections');
      console.log('   - Consider optimizing connection pooling');
    }
    
    console.log('\n✅ Check complete!');
    
  } catch (error) {
    console.error('❌ Error checking connections:', error.message);
  } finally {
    await pool.end();
  }
}

// Run the check
checkConnections().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});