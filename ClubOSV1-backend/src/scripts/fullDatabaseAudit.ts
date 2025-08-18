import db from '../utils/db-consolidated';
import { logger } from '../utils/logger';
import * as fs from 'fs';
import * as path from 'path';

interface TableAudit {
  tableName: string;
  recordCount: number;
  columns: string[];
  sampleData: any[];
  hasSearchableContent: boolean;
  knowledgeType?: string;
}

async function getAllTables(): Promise<string[]> {
  try {
    const result = await db.query(`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public' 
      AND tablename LIKE '%knowledge%'
      ORDER BY tablename
    `);
    return result.rows.map(row => row.tablename);
  } catch (error) {
    console.error('Failed to get tables:', error);
    return [];
  }
}

async function getTableColumns(tableName: string): Promise<string[]> {
  try {
    const result = await db.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = $1
      ORDER BY ordinal_position
    `, [tableName]);
    return result.rows.map(row => row.column_name);
  } catch (error) {
    console.error(`Failed to get columns for ${tableName}:`, error);
    return [];
  }
}

async function auditTable(tableName: string): Promise<TableAudit> {
  try {
    // Get record count
    const countResult = await db.query(`SELECT COUNT(*) as count FROM ${tableName}`);
    const recordCount = parseInt(countResult.rows[0].count);

    // Get columns
    const columns = await getTableColumns(tableName);

    // Get sample data
    let sampleData = [];
    if (recordCount > 0) {
      // Build dynamic query based on available columns
      let orderByClause = '';
      if (columns.includes('created_at')) {
        orderByClause = 'ORDER BY created_at DESC';
      } else if (columns.includes('updated_at')) {
        orderByClause = 'ORDER BY updated_at DESC';
      } else if (columns.includes('id')) {
        orderByClause = 'ORDER BY id DESC';
      }

      const sampleResult = await db.query(`
        SELECT * FROM ${tableName} 
        ${orderByClause}
        LIMIT 5
      `);
      sampleData = sampleResult.rows;
    }

    // Check for searchable content
    const hasSearchableContent = columns.some(col => 
      col.includes('content') || 
      col.includes('text') || 
      col.includes('value') || 
      col.includes('knowledge') ||
      col.includes('response') ||
      col.includes('description')
    );

    // Determine knowledge type
    let knowledgeType = 'unknown';
    if (tableName.includes('assistant')) knowledgeType = 'assistant';
    else if (tableName.includes('extracted')) knowledgeType = 'extracted';
    else if (tableName.includes('store')) knowledgeType = 'structured';
    else if (tableName.includes('base')) knowledgeType = 'base';
    else if (tableName.includes('cache')) knowledgeType = 'cached';
    else if (tableName.includes('export')) knowledgeType = 'exported';
    else if (tableName.includes('parsed')) knowledgeType = 'parsed';

    return {
      tableName,
      recordCount,
      columns,
      sampleData,
      hasSearchableContent,
      knowledgeType
    };
  } catch (error) {
    console.error(`Failed to audit ${tableName}:`, error);
    return {
      tableName,
      recordCount: 0,
      columns: [],
      sampleData: [],
      hasSearchableContent: false,
      knowledgeType: 'error'
    };
  }
}

async function searchForCommonQuestions(): Promise<void> {
  console.log('\n🔍 SEARCHING FOR COMMON QUESTIONS ACROSS ALL TABLES');
  console.log('=' .repeat(60));

  const questions = [
    { q: 'hours', keywords: ['hour', 'open', 'close', 'schedule', 'time'] },
    { q: 'pricing', keywords: ['price', 'cost', 'fee', 'rate', 'payment', 'dollar', '$'] },
    { q: 'booking', keywords: ['book', 'reserve', 'cancel', 'schedule', 'appointment'] },
    { q: 'technical', keywords: ['trackman', 'simulator', 'technical', 'equipment', 'problem'] },
    { q: 'location', keywords: ['location', 'address', 'where', 'direction', 'find'] },
    { q: 'gift cards', keywords: ['gift', 'card', 'purchase', 'buy'] }
  ];

  const tables = await getAllTables();
  
  for (const question of questions) {
    console.log(`\n📌 Searching for: ${question.q.toUpperCase()}`);
    let foundCount = 0;
    
    for (const table of tables) {
      try {
        // Get columns for this table
        const columns = await getTableColumns(table);
        
        // Build search query for text columns
        const textColumns = columns.filter(col => 
          !col.includes('id') && 
          !col.includes('created') && 
          !col.includes('updated')
        );
        
        if (textColumns.length === 0) continue;
        
        // Build WHERE clause for all keywords
        const whereConditions = [];
        for (const col of textColumns) {
          for (const keyword of question.keywords) {
            whereConditions.push(`CAST(${col} AS TEXT) ILIKE '%${keyword}%'`);
          }
        }
        
        if (whereConditions.length === 0) continue;
        
        const searchQuery = `
          SELECT COUNT(*) as count 
          FROM ${table} 
          WHERE ${whereConditions.join(' OR ')}
        `;
        
        const result = await db.query(searchQuery);
        const count = parseInt(result.rows[0].count);
        
        if (count > 0) {
          foundCount += count;
          console.log(`  ✅ Found ${count} matches in ${table}`);
          
          // Get a sample
          const sampleQuery = `
            SELECT * FROM ${table} 
            WHERE ${whereConditions.join(' OR ')}
            LIMIT 1
          `;
          const sample = await db.query(sampleQuery);
          if (sample.rows[0]) {
            const preview = JSON.stringify(sample.rows[0]).substring(0, 150);
            console.log(`     Sample: ${preview}...`);
          }
        }
      } catch (error) {
        // Silently continue if search fails for this table
      }
    }
    
    if (foundCount === 0) {
      console.log(`  ❌ No matches found in any table`);
    } else {
      console.log(`  📊 Total: ${foundCount} matches across all tables`);
    }
  }
}

async function fullDatabaseAudit(): Promise<void> {
  console.log('\n🔍 COMPLETE POSTGRESQL DATABASE AUDIT');
  console.log('=' .repeat(60));
  
  try {
    // First, get ALL tables (not just knowledge ones)
    const allTablesResult = await db.query(`
      SELECT tablename, 
             pg_size_pretty(pg_total_relation_size(quote_ident(tablename)::regclass)) as size
      FROM pg_tables 
      WHERE schemaname = 'public' 
      ORDER BY pg_total_relation_size(quote_ident(tablename)::regclass) DESC
    `);
    
    console.log('\n📊 ALL DATABASE TABLES:');
    console.log('-'.repeat(40));
    
    let totalKnowledgeTables = 0;
    let totalKnowledgeRecords = 0;
    const knowledgeTables: TableAudit[] = [];
    
    for (const table of allTablesResult.rows) {
      const audit = await auditTable(table.tablename);
      
      // Check if this is a knowledge-related table
      const isKnowledge = table.tablename.includes('knowledge') || 
                         table.tablename.includes('assistant') ||
                         table.tablename.includes('extracted') ||
                         table.tablename.includes('learning');
      
      if (isKnowledge) {
        totalKnowledgeTables++;
        totalKnowledgeRecords += audit.recordCount;
        knowledgeTables.push(audit);
        console.log(`📚 ${table.tablename}: ${audit.recordCount} records (${table.size})`);
      } else {
        console.log(`   ${table.tablename}: ${audit.recordCount} records (${table.size})`);
      }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('📚 KNOWLEDGE TABLES DETAILED AUDIT');
    console.log('='.repeat(60));
    
    for (const audit of knowledgeTables) {
      if (audit.recordCount > 0) {
        console.log(`\n📊 ${audit.tableName.toUpperCase()}`);
        console.log('-'.repeat(40));
        console.log(`Records: ${audit.recordCount}`);
        console.log(`Columns: ${audit.columns.join(', ')}`);
        console.log(`Has Searchable Content: ${audit.hasSearchableContent ? '✅' : '❌'}`);
        console.log(`Knowledge Type: ${audit.knowledgeType}`);
        
        if (audit.sampleData.length > 0) {
          console.log('\nSample Data (first record):');
          const sample = audit.sampleData[0];
          
          // Show key fields
          Object.keys(sample).forEach(key => {
            if (!key.includes('id') && !key.includes('created') && !key.includes('updated')) {
              let value = sample[key];
              if (typeof value === 'object') {
                value = JSON.stringify(value);
              }
              if (value && value.toString().length > 100) {
                value = value.toString().substring(0, 100) + '...';
              }
              console.log(`  ${key}: ${value}`);
            }
          });
        }
      }
    }
    
    // Search for common questions
    await searchForCommonQuestions();
    
    // Final Summary
    console.log('\n' + '='.repeat(60));
    console.log('📈 FINAL SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total Tables in Database: ${allTablesResult.rows.length}`);
    console.log(`Knowledge-Related Tables: ${totalKnowledgeTables}`);
    console.log(`Total Knowledge Records: ${totalKnowledgeRecords}`);
    
    if (totalKnowledgeRecords === 0) {
      console.log('\n❌ NO KNOWLEDGE RECORDS FOUND');
    } else if (totalKnowledgeRecords < 10) {
      console.log('\n⚠️  VERY LIMITED KNOWLEDGE (< 10 records)');
    } else if (totalKnowledgeRecords < 100) {
      console.log('\n⚠️  LIMITED KNOWLEDGE (< 100 records)');
    } else {
      console.log('\n✅ SUBSTANTIAL KNOWLEDGE BASE EXISTS');
    }
    
    // Save detailed report
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalTables: allTablesResult.rows.length,
        knowledgeTables: totalKnowledgeTables,
        totalKnowledgeRecords: totalKnowledgeRecords
      },
      tables: knowledgeTables,
      recommendation: totalKnowledgeRecords > 100 
        ? 'Knowledge exists - need to connect it to the assistant service'
        : 'Need to add more knowledge to the database'
    };
    
    const reportPath = path.join(process.cwd(), 'FULL_DATABASE_AUDIT.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n📄 Detailed report saved to: ${reportPath}`);
    
  } catch (error) {
    console.error('Audit failed:', error);
  }
}

// Run the audit
if (require.main === module) {
  fullDatabaseAudit()
    .then(() => {
      console.log('\n✅ Audit complete!');
      process.exit(0);
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

export { fullDatabaseAudit };