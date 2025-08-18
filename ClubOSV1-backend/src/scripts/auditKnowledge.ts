import db from '../utils/db-consolidated';
import { logger } from '../utils/logger';
import * as fs from 'fs';
import * as path from 'path';

interface KnowledgeAudit {
  table: string;
  totalRecords: number;
  sampleRecords: any[];
  categories: Record<string, number>;
  coverage: {
    hasHours: boolean;
    hasPricing: boolean;
    hasBooking: boolean;
    hasTechnical: boolean;
    hasEmergency: boolean;
    hasPolicies: boolean;
  };
  quality: {
    avgConfidence: number;
    withHighConfidence: number;
    withLowConfidence: number;
    outdated: number;
  };
}

async function auditKnowledgeTable(tableName: string): Promise<KnowledgeAudit | null> {
  try {
    // Get total count
    const countResult = await db.query(`SELECT COUNT(*) as count FROM ${tableName}`);
    const totalRecords = parseInt(countResult.rows[0].count);

    if (totalRecords === 0) {
      return {
        table: tableName,
        totalRecords: 0,
        sampleRecords: [],
        categories: {},
        coverage: {
          hasHours: false,
          hasPricing: false,
          hasBooking: false,
          hasTechnical: false,
          hasEmergency: false,
          hasPolicies: false
        },
        quality: {
          avgConfidence: 0,
          withHighConfidence: 0,
          withLowConfidence: 0,
          outdated: 0
        }
      };
    }

    // Get sample records
    const sampleResult = await db.query(`
      SELECT * FROM ${tableName} 
      ORDER BY created_at DESC 
      LIMIT 10
    `);

    // Analyze categories based on table structure
    let categories: Record<string, number> = {};
    let coverage = {
      hasHours: false,
      hasPricing: false,
      hasBooking: false,
      hasTechnical: false,
      hasEmergency: false,
      hasPolicies: false
    };

    // Different analysis based on table
    if (tableName === 'knowledge_store') {
      // Analyze knowledge_store
      const categoryResult = await db.query(`
        SELECT 
          COALESCE(metadata->>'category', 'uncategorized') as category,
          COUNT(*) as count
        FROM knowledge_store
        GROUP BY metadata->>'category'
      `);
      
      categoryResult.rows.forEach(row => {
        categories[row.category] = parseInt(row.count);
      });

      // Check coverage
      const coverageChecks = [
        { field: 'hasHours', keywords: ['hours', 'open', 'close', 'schedule'] },
        { field: 'hasPricing', keywords: ['price', 'cost', 'fee', 'rate', '$'] },
        { field: 'hasBooking', keywords: ['book', 'reserve', 'cancel', 'reschedule'] },
        { field: 'hasTechnical', keywords: ['trackman', 'simulator', 'technical', 'equipment'] },
        { field: 'hasEmergency', keywords: ['emergency', 'fire', 'injury', 'accident'] },
        { field: 'hasPolicies', keywords: ['policy', 'rule', 'terms', 'conditions'] }
      ];

      for (const check of coverageChecks) {
        const keywordSearch = check.keywords.map(k => `searchable_content ILIKE '%${k}%'`).join(' OR ');
        const result = await db.query(`
          SELECT COUNT(*) as count 
          FROM knowledge_store 
          WHERE ${keywordSearch}
        `);
        coverage[check.field] = parseInt(result.rows[0].count) > 0;
      }

      // Analyze quality
      const qualityResult = await db.query(`
        SELECT 
          AVG(confidence) as avg_confidence,
          COUNT(CASE WHEN confidence > 0.8 THEN 1 END) as high_confidence,
          COUNT(CASE WHEN confidence < 0.5 THEN 1 END) as low_confidence,
          COUNT(CASE WHEN created_at < NOW() - INTERVAL '90 days' THEN 1 END) as outdated
        FROM knowledge_store
      `);

      const quality = {
        avgConfidence: parseFloat(qualityResult.rows[0].avg_confidence || 0),
        withHighConfidence: parseInt(qualityResult.rows[0].high_confidence || 0),
        withLowConfidence: parseInt(qualityResult.rows[0].low_confidence || 0),
        outdated: parseInt(qualityResult.rows[0].outdated || 0)
      };

      return {
        table: tableName,
        totalRecords,
        sampleRecords: sampleResult.rows,
        categories,
        coverage,
        quality
      };
    }

    // Basic audit for other tables
    return {
      table: tableName,
      totalRecords,
      sampleRecords: sampleResult.rows,
      categories: { unknown: totalRecords },
      coverage,
      quality: {
        avgConfidence: 0,
        withHighConfidence: 0,
        withLowConfidence: 0,
        outdated: 0
      }
    };

  } catch (error) {
    logger.error(`Failed to audit table ${tableName}:`, error);
    return null;
  }
}

async function generateKnowledgeReport(): Promise<void> {
  console.log('\n🔍 CLUBOS KNOWLEDGE DATABASE AUDIT');
  console.log('=' .repeat(60));

  const tables = [
    'knowledge_store',
    'assistant_knowledge',
    'extracted_knowledge',
    'knowledge_audit_log'
  ];

  const auditResults: KnowledgeAudit[] = [];
  let totalKnowledgeItems = 0;
  let tablesWithData = 0;

  for (const table of tables) {
    const audit = await auditKnowledgeTable(table);
    if (audit) {
      auditResults.push(audit);
      totalKnowledgeItems += audit.totalRecords;
      if (audit.totalRecords > 0) tablesWithData++;
      
      console.log(`\n📊 ${table.toUpperCase()}`);
      console.log('-'.repeat(40));
      console.log(`Total Records: ${audit.totalRecords}`);
      
      if (audit.totalRecords > 0) {
        console.log(`Categories:`, audit.categories);
        console.log(`Coverage:`);
        Object.entries(audit.coverage).forEach(([key, value]) => {
          console.log(`  ${key}: ${value ? '✅' : '❌'}`);
        });
        
        if (audit.quality.avgConfidence > 0) {
          console.log(`Quality:`);
          console.log(`  Avg Confidence: ${(audit.quality.avgConfidence * 100).toFixed(1)}%`);
          console.log(`  High Confidence (>80%): ${audit.quality.withHighConfidence}`);
          console.log(`  Low Confidence (<50%): ${audit.quality.withLowConfidence}`);
          console.log(`  Outdated (>90 days): ${audit.quality.outdated}`);
        }
        
        console.log(`\nSample Records (first 3):`);
        audit.sampleRecords.slice(0, 3).forEach((record, i) => {
          console.log(`  ${i + 1}. ${record.key || record.question || 'N/A'}`);
          if (record.value) {
            const preview = typeof record.value === 'string' 
              ? record.value.substring(0, 100) 
              : JSON.stringify(record.value).substring(0, 100);
            console.log(`     → ${preview}...`);
          }
        });
      }
    }
  }

  // Generate summary
  console.log('\n' + '='.repeat(60));
  console.log('📈 SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total Knowledge Items: ${totalKnowledgeItems}`);
  console.log(`Tables with Data: ${tablesWithData}/${tables.length}`);
  
  // Identify gaps
  const gaps: string[] = [];
  const combinedCoverage = {
    hasHours: false,
    hasPricing: false,
    hasBooking: false,
    hasTechnical: false,
    hasEmergency: false,
    hasPolicies: false
  };

  auditResults.forEach(audit => {
    Object.keys(combinedCoverage).forEach(key => {
      if (audit.coverage[key]) {
        combinedCoverage[key] = true;
      }
    });
  });

  console.log('\n🎯 KNOWLEDGE COVERAGE:');
  Object.entries(combinedCoverage).forEach(([key, value]) => {
    const label = key.replace('has', '').replace(/([A-Z])/g, ' $1').trim();
    console.log(`  ${label}: ${value ? '✅ Covered' : '❌ Missing'}`);
    if (!value) gaps.push(label);
  });

  if (gaps.length > 0) {
    console.log('\n⚠️  CRITICAL GAPS:');
    gaps.forEach(gap => {
      console.log(`  - No knowledge about: ${gap}`);
    });
  }

  // Test common questions
  console.log('\n🧪 TEST QUESTIONS:');
  const testQuestions = [
    'What are your hours?',
    'How much does it cost?',
    'How do I book a simulator?',
    'My TrackMan is frozen',
    'Is there an emergency?'
  ];

  for (const question of testQuestions) {
    const searchTerms = question.toLowerCase().split(' ').filter(w => w.length > 3);
    let found = false;
    
    for (const audit of auditResults) {
      if (audit.totalRecords > 0) {
        // Simple check if any sample contains these terms
        const hasMatch = audit.sampleRecords.some(record => {
          const content = JSON.stringify(record).toLowerCase();
          return searchTerms.some(term => content.includes(term));
        });
        if (hasMatch) {
          found = true;
          break;
        }
      }
    }
    
    console.log(`  "${question}" → ${found ? '✅ Likely answerable' : '❌ No clear answer'}`);
  }

  // Save report
  const reportPath = path.join(process.cwd(), 'KNOWLEDGE_AUDIT_REPORT.md');
  const reportContent = `# Knowledge Database Audit Report
Generated: ${new Date().toISOString()}

## Summary
- Total Knowledge Items: ${totalKnowledgeItems}
- Tables with Data: ${tablesWithData}/${tables.length}

## Coverage
${Object.entries(combinedCoverage).map(([key, value]) => 
  `- ${key}: ${value ? '✅' : '❌'}`).join('\n')}

## Gaps
${gaps.length > 0 ? gaps.map(g => `- ${g}`).join('\n') : 'None identified'}

## Recommendations
${totalKnowledgeItems === 0 ? '1. **CRITICAL**: No knowledge in database! Upload knowledge immediately.' : ''}
${gaps.length > 0 ? `2. Add knowledge for: ${gaps.join(', ')}` : ''}
3. ${totalKnowledgeItems < 100 ? 'Expand knowledge base - current coverage is minimal' : 'Knowledge base has good coverage'}

## Raw Data
${JSON.stringify(auditResults, null, 2)}
`;

  fs.writeFileSync(reportPath, reportContent);
  console.log(`\n📄 Full report saved to: ${reportPath}`);

  // Final verdict
  console.log('\n' + '='.repeat(60));
  console.log('🎯 VERDICT:');
  if (totalKnowledgeItems === 0) {
    console.log('❌ NO KNOWLEDGE IN DATABASE - System cannot answer from DB!');
  } else if (totalKnowledgeItems < 50) {
    console.log('⚠️  MINIMAL KNOWLEDGE - Most questions will hit OpenAI');
  } else {
    console.log('✅ Knowledge exists but NOT BEING USED by the system');
  }
  console.log('='.repeat(60));
}

// Run the audit
if (require.main === module) {
  generateKnowledgeReport()
    .then(() => {
      console.log('\nAudit complete!');
      process.exit(0);
    })
    .catch(error => {
      console.error('Audit failed:', error);
      process.exit(1);
    });
}

export { auditKnowledgeTable, generateKnowledgeReport };