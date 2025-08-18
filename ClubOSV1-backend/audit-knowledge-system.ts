/**
 * COMPREHENSIVE KNOWLEDGE SYSTEM AUDIT
 * Tests all aspects of the unified knowledge system
 */

import { config } from 'dotenv';
config();

const API_URL = 'https://clubosv2-production.up.railway.app/api';

interface TestResult {
  query: string;
  category: string;
  foundKnowledge: boolean;
  usedLocal: boolean;
  apiCallsSaved: number;
  confidence?: number;
  responseTime?: number;
  source?: string;
}

const TEST_QUERIES = [
  // Should find in SOPs
  { query: "Do you offer gift cards?", category: "pricing" },
  { query: "What are your refund policies?", category: "policy" },
  { query: "How do I book a simulator?", category: "booking" },
  { query: "What equipment do you use?", category: "tech" },
  { query: "Do you have tournaments?", category: "events" },
  { query: "What are your membership options?", category: "pricing" },
  { query: "Can I bring guests?", category: "policy" },
  { query: "What is TrackMan?", category: "tech" },
  
  // Should NOT find (test OpenAI fallback)
  { query: "What's the weather like today?", category: "unrelated" },
  { query: "How do I cook pasta?", category: "unrelated" },
  
  // Edge cases
  { query: "emergency help needed", category: "emergency" },
  { query: "simulator broken", category: "tech_support" },
  { query: "hours of operation", category: "info" },
  { query: "pricing", category: "pricing" }, // Single word
  { query: "7 iron distance", category: "golf" },
];

async function testQuery(query: string): Promise<TestResult> {
  const startTime = Date.now();
  
  try {
    const response = await fetch(`${API_URL}/test-knowledge?query=${encodeURIComponent(query)}`);
    const data = await response.json();
    
    const responseTime = Date.now() - startTime;
    
    return {
      query,
      category: 'auto',
      foundKnowledge: data.summary?.knowledgeFound || false,
      usedLocal: data.summary?.localKnowledgeUsed || false,
      apiCallsSaved: data.summary?.apiCallsSaved || 0,
      confidence: data.searchServiceResults?.topResult?.combinedScore,
      responseTime,
      source: data.searchServiceResults?.topResult?.key?.split('.')[0]
    };
  } catch (error) {
    console.error(`Error testing "${query}":`, error);
    return {
      query,
      category: 'error',
      foundKnowledge: false,
      usedLocal: false,
      apiCallsSaved: 0,
      responseTime: Date.now() - startTime
    };
  }
}

async function runFullAudit() {
  console.log('\n' + '='.repeat(70));
  console.log('🔍 COMPREHENSIVE KNOWLEDGE SYSTEM AUDIT');
  console.log('='.repeat(70) + '\n');
  
  const results: TestResult[] = [];
  
  // Test all queries
  console.log('📊 Testing queries...\n');
  
  for (const testCase of TEST_QUERIES) {
    process.stdout.write(`Testing: "${testCase.query.padEnd(35)}" `);
    const result = await testQuery(testCase.query);
    results.push({ ...result, category: testCase.category });
    
    if (result.usedLocal) {
      console.log(`✅ LOCAL (${(result.confidence! * 100).toFixed(1)}%)`);
    } else if (result.foundKnowledge) {
      console.log(`⚠️  FOUND but used OpenAI`);
    } else {
      console.log(`❌ OpenAI (no local knowledge)`);
    }
    
    // Rate limit
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  // Analyze results
  console.log('\n' + '-'.repeat(70));
  console.log('📈 ANALYSIS\n');
  
  const stats = {
    total: results.length,
    usedLocal: results.filter(r => r.usedLocal).length,
    foundButNotUsed: results.filter(r => r.foundKnowledge && !r.usedLocal).length,
    usedOpenAI: results.filter(r => !r.usedLocal).length,
    apiCallsSaved: results.reduce((sum, r) => sum + r.apiCallsSaved, 0),
    avgResponseTime: results.reduce((sum, r) => sum + (r.responseTime || 0), 0) / results.length,
    avgConfidence: results.filter(r => r.confidence).reduce((sum, r) => sum + r.confidence!, 0) / results.filter(r => r.confidence).length
  };
  
  console.log(`Total Queries Tested: ${stats.total}`);
  console.log(`Used Local Knowledge: ${stats.usedLocal} (${(stats.usedLocal / stats.total * 100).toFixed(1)}%)`);
  console.log(`Used OpenAI: ${stats.usedOpenAI} (${(stats.usedOpenAI / stats.total * 100).toFixed(1)}%)`);
  console.log(`Found but Below Threshold: ${stats.foundButNotUsed}`);
  console.log(`API Calls Saved: ${stats.apiCallsSaved}`);
  console.log(`Average Response Time: ${stats.avgResponseTime.toFixed(0)}ms`);
  console.log(`Average Confidence: ${(stats.avgConfidence * 100).toFixed(1)}%`);
  
  // Category breakdown
  console.log('\n📂 BY CATEGORY:\n');
  const categories = [...new Set(results.map(r => r.category))];
  
  for (const category of categories) {
    const catResults = results.filter(r => r.category === category);
    const localCount = catResults.filter(r => r.usedLocal).length;
    console.log(`${category.padEnd(15)} - ${localCount}/${catResults.length} used local (${(localCount/catResults.length * 100).toFixed(0)}%)`);
  }
  
  // Source breakdown
  console.log('\n📚 KNOWLEDGE SOURCES:\n');
  const sources = results.filter(r => r.source).map(r => r.source!);
  const sourceCounts = sources.reduce((acc, source) => {
    acc[source] = (acc[source] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  for (const [source, count] of Object.entries(sourceCounts)) {
    console.log(`${source.padEnd(15)} - ${count} queries`);
  }
  
  // Low confidence queries
  console.log('\n⚠️  LOW CONFIDENCE (<30%):\n');
  const lowConfidence = results.filter(r => r.confidence && r.confidence < 0.3);
  
  if (lowConfidence.length > 0) {
    for (const result of lowConfidence) {
      console.log(`- "${result.query}" (${(result.confidence! * 100).toFixed(1)}%)`);
    }
  } else {
    console.log('None - all queries had sufficient confidence!');
  }
  
  // Cost savings estimate
  const OPENAI_COST_PER_CALL = 0.002; // Estimated
  const costSaved = stats.apiCallsSaved * OPENAI_COST_PER_CALL;
  
  console.log('\n💰 COST ANALYSIS:\n');
  console.log(`API Calls Saved: ${stats.apiCallsSaved}`);
  console.log(`Estimated Cost Saved: $${costSaved.toFixed(4)}`);
  console.log(`Monthly Projection (1000 queries): $${(costSaved * (1000 / stats.total)).toFixed(2)}`);
  
  // Final verdict
  console.log('\n' + '='.repeat(70));
  
  const successRate = stats.usedLocal / stats.total;
  if (successRate > 0.7) {
    console.log('✅ SYSTEM STATUS: EXCELLENT');
    console.log(`Knowledge system is working well! ${(successRate * 100).toFixed(1)}% local usage.`);
  } else if (successRate > 0.5) {
    console.log('⚠️  SYSTEM STATUS: GOOD');
    console.log(`Knowledge system is working but could be improved. ${(successRate * 100).toFixed(1)}% local usage.`);
  } else {
    console.log('❌ SYSTEM STATUS: NEEDS ATTENTION');
    console.log(`Knowledge system needs optimization. Only ${(successRate * 100).toFixed(1)}% local usage.`);
  }
  
  console.log('='.repeat(70) + '\n');
}

// Run the audit
runFullAudit().catch(console.error);