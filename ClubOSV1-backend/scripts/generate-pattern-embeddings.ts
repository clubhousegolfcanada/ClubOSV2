#!/usr/bin/env tsx
/**
 * Generate Embeddings for Existing Patterns
 * 
 * This script generates OpenAI embeddings for all patterns to enable semantic search.
 * Must be run where OPENAI_API_KEY is configured.
 * 
 * Usage: npm run generate-embeddings
 */

import { Pool } from 'pg';
import OpenAI from 'openai';
import { logger } from '../src/utils/logger';

// Database connection
const db = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:FnlIdpRyrGXKyzhLEdxTCxuVXJcOyxeI@yamanote.proxy.rlwy.net:31482/railway',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// OpenAI configuration
if (!process.env.OPENAI_API_KEY) {
  logger.error('❌ OPENAI_API_KEY not configured!');
  logger.error('This script requires OpenAI to generate embeddings.');
  logger.error('Either:');
  logger.error('1. Run this on Railway where OpenAI is configured');
  logger.error('2. Set OPENAI_API_KEY locally');
  process.exit(1);
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * Generate embedding for a text string
 */
async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
    });
    
    return response.data[0].embedding;
  } catch (error) {
    logger.error('Failed to generate embedding:', error);
    throw error;
  }
}

/**
 * Calculate cosine similarity between two vectors
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  if (normA === 0 || normB === 0) return 0;
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Main function to generate embeddings for all patterns
 */
async function generatePatternEmbeddings() {
  try {
    logger.info('🚀 Starting pattern embedding generation...');
    
    // Get all active patterns without embeddings
    const patterns = await db.query(`
      SELECT 
        id, 
        pattern_type, 
        trigger_text, 
        response_template,
        trigger_keywords
      FROM decision_patterns
      WHERE is_active = TRUE
        AND embedding IS NULL
      ORDER BY confidence_score DESC, id
    `);
    
    logger.info(`📊 Found ${patterns.rows.length} patterns without embeddings`);
    
    if (patterns.rows.length === 0) {
      // Check if patterns already have embeddings
      const withEmbeddings = await db.query(`
        SELECT COUNT(*) as count
        FROM decision_patterns
        WHERE embedding IS NOT NULL
      `);
      
      logger.info(`✅ ${withEmbeddings.rows[0].count} patterns already have embeddings`);
      return;
    }
    
    let processed = 0;
    let failed = 0;
    const similarities: Array<{patternA: number, patternB: number, score: number}> = [];
    const embeddings: Map<number, number[]> = new Map();
    
    // Process each pattern
    for (const pattern of patterns.rows) {
      try {
        // Create a comprehensive text representation for embedding
        const textForEmbedding = [
          pattern.trigger_text || '',
          pattern.response_template || '',
          ...(pattern.trigger_keywords || [])
        ].filter(Boolean).join(' ');
        
        logger.info(`🔄 Processing pattern ${pattern.id} (${pattern.pattern_type})...`);
        
        // Generate embedding
        const embedding = await generateEmbedding(textForEmbedding);
        embeddings.set(pattern.id, embedding);
        
        // Update pattern with embedding
        await db.query(`
          UPDATE decision_patterns
          SET 
            embedding = $1,
            embedding_model = 'text-embedding-3-small',
            embedding_generated_at = NOW(),
            semantic_search_enabled = TRUE
          WHERE id = $2
        `, [embedding, pattern.id]);
        
        processed++;
        logger.info(`✅ Pattern ${pattern.id} embedding saved (${processed}/${patterns.rows.length})`);
        
        // Rate limiting - OpenAI allows 3000 RPM for embeddings
        await new Promise(resolve => setTimeout(resolve, 100)); // ~600 per minute
        
      } catch (error) {
        logger.error(`❌ Failed to process pattern ${pattern.id}:`, error);
        failed++;
      }
    }
    
    logger.info('🔍 Calculating pattern similarities...');
    
    // Calculate similarities between all patterns
    const patternIds = Array.from(embeddings.keys());
    for (let i = 0; i < patternIds.length; i++) {
      for (let j = i + 1; j < patternIds.length; j++) {
        const embeddingA = embeddings.get(patternIds[i])!;
        const embeddingB = embeddings.get(patternIds[j])!;
        const similarity = cosineSimilarity(embeddingA, embeddingB);
        
        if (similarity > 0.85) { // Only store high similarities
          similarities.push({
            patternA: patternIds[i],
            patternB: patternIds[j],
            score: similarity
          });
        }
      }
    }
    
    // Store similarities in database
    if (similarities.length > 0) {
      logger.info(`💾 Storing ${similarities.length} high-similarity pairs...`);
      
      for (const sim of similarities) {
        try {
          await db.query(`
            INSERT INTO pattern_similarities (pattern_a_id, pattern_b_id, similarity_score)
            VALUES ($1, $2, $3)
            ON CONFLICT (pattern_a_id, pattern_b_id) 
            DO UPDATE SET 
              similarity_score = $3,
              last_calculated = NOW()
          `, [
            Math.min(sim.patternA, sim.patternB),
            Math.max(sim.patternA, sim.patternB),
            sim.score
          ]);
        } catch (error) {
          logger.warn(`Failed to store similarity for patterns ${sim.patternA}-${sim.patternB}:`, error);
        }
      }
    }
    
    // Find potential duplicates
    const duplicates = similarities.filter(s => s.score > 0.95);
    if (duplicates.length > 0) {
      logger.warn('⚠️  Found potential duplicate patterns:');
      for (const dup of duplicates) {
        const patternA = patterns.rows.find(p => p.id === dup.patternA);
        const patternB = patterns.rows.find(p => p.id === dup.patternB);
        logger.warn(`  - Pattern ${dup.patternA} and ${dup.patternB} (similarity: ${dup.score.toFixed(3)})`);
        if (patternA && patternB) {
          logger.warn(`    A: "${patternA.trigger_text?.substring(0, 50)}..."`);
          logger.warn(`    B: "${patternB.trigger_text?.substring(0, 50)}..."`);
        }
      }
    }
    
    // Summary
    logger.info('📈 Embedding Generation Complete:');
    logger.info(`  ✅ Processed: ${processed} patterns`);
    logger.info(`  ❌ Failed: ${failed} patterns`);
    logger.info(`  🔗 High similarity pairs: ${similarities.length}`);
    logger.info(`  ⚠️  Potential duplicates: ${duplicates.length}`);
    
    // Update patterns to mark semantic search as enabled
    await db.query(`
      UPDATE decision_patterns
      SET semantic_search_enabled = TRUE
      WHERE embedding IS NOT NULL
    `);
    
    logger.info('✨ Semantic search is now enabled for patterns with embeddings!');
    
  } catch (error) {
    logger.error('Fatal error:', error);
    process.exit(1);
  } finally {
    await db.end();
  }
}

// Add to package.json scripts if needed
async function updatePackageJson() {
  try {
    const fs = require('fs');
    const path = require('path');
    const packagePath = path.join(__dirname, '..', 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    
    if (!packageJson.scripts['generate-embeddings']) {
      packageJson.scripts['generate-embeddings'] = 'tsx scripts/generate-pattern-embeddings.ts';
      fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2));
      logger.info('📦 Added generate-embeddings script to package.json');
    }
  } catch (error) {
    // Ignore if can't update package.json
  }
}

// Run the script
updatePackageJson().then(() => {
  generatePatternEmbeddings();
});