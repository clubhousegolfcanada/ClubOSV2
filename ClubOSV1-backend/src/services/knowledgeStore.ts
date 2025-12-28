/**
 * KnowledgeStore Service
 * Ultra-flexible Winston-style storage for any type of knowledge
 */

import { query, pool } from '../utils/db';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';
import { cacheService } from './cacheService';

export interface KnowledgeEntry {
  id?: string;
  key: string;
  value: any;
  confidence?: number;
  verification_status?: 'verified' | 'learned' | 'pending' | 'rejected';
  source_type?: string;
  metadata?: any;
}

export interface SearchResult {
  key: string;
  value: any;
  confidence: number;
  relevance?: number;
  usage_count?: number;
  verification_status?: string;
}

export class KnowledgeStore {
  /**
   * Set a value by key (creates or updates)
   */
  async set(
    key: string, 
    value: any, 
    options?: {
      confidence?: number;
      verification_status?: string;
      source_type?: string;
      metadata?: any;
      created_by?: string;
    }
  ): Promise<string> {
    try {
      // Ensure value is properly formatted for JSONB
      const jsonValue = typeof value === 'string' 
        ? JSON.stringify(value) 
        : JSON.stringify(value);

      const sql = `
        INSERT INTO knowledge_store (
          key, value, confidence, verification_status, 
          source_type, metadata, created_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (key) 
        DO UPDATE SET 
          value = $2,
          confidence = COALESCE($3, knowledge_store.confidence),
          verification_status = COALESCE($4, knowledge_store.verification_status),
          metadata = COALESCE($6, knowledge_store.metadata),
          updated_at = NOW(),
          source_count = knowledge_store.source_count + 1
        RETURNING id
      `;

      const result = await query(sql, [
        key,
        jsonValue,
        options?.confidence || 0.5,
        options?.verification_status || 'learned',
        options?.source_type || 'manual',
        options?.metadata ? JSON.stringify(options.metadata) : '{}',
        options?.created_by || null
      ]);

      logger.info('Knowledge stored', {
        key,
        id: result.rows[0].id,
        confidence: options?.confidence
      });

      // Invalidate knowledge search caches so new data is immediately available
      try {
        await cacheService.invalidatePattern('knowledge:search:*');
        await cacheService.invalidatePattern('knowledge:*');
        logger.debug('Knowledge cache invalidated after store', { key });
      } catch (cacheError) {
        // Don't fail the store if cache invalidation fails
        logger.warn('Failed to invalidate knowledge cache', { key, error: cacheError });
      }

      return result.rows[0].id;
    } catch (error) {
      logger.error('Failed to store knowledge', { key, error });
      throw error;
    }
  }

  /**
   * Get a value by key (supports dot notation patterns)
   */
  async get(key: string): Promise<any> {
    try {
      // First try exact match
      let sql = `
        SELECT key, value, confidence, verification_status, usage_count 
        FROM knowledge_store 
        WHERE key = $1 AND (expires_at IS NULL OR expires_at > NOW())
      `;
      let result = await query(sql, [key]);

      if (result.rows.length > 0) {
        // Update usage tracking
        await this.trackUsage(result.rows[0].key);
        return result.rows[0].value;
      }

      // Try pattern match for nested keys (e.g., "company.brand" gets all "company.brand.*")
      sql = `
        SELECT key, value 
        FROM knowledge_store 
        WHERE key LIKE $1 AND (expires_at IS NULL OR expires_at > NOW())
        ORDER BY key
      `;
      result = await query(sql, [key + '.%']);

      if (result.rows.length > 0) {
        // Build nested object from results
        const nested: any = {};
        for (const row of result.rows) {
          const subKey = row.key.replace(key + '.', '');
          this.setNestedValue(nested, subKey, row.value);
          await this.trackUsage(row.key);
        }
        return nested;
      }

      return null;
    } catch (error) {
      logger.error('Failed to get knowledge', { key, error });
      throw error;
    }
  }

  /**
   * Search across all knowledge
   */
  async search(
    searchQuery: string, 
    options?: {
      limit?: number;
      minConfidence?: number;
      verificationStatus?: string;
      includeMetadata?: boolean;
    }
  ): Promise<SearchResult[]> {
    try {
      const limit = options?.limit || 10;
      const minConfidence = options?.minConfidence || 0;

      let sql = `
        SELECT 
          key, 
          value, 
          confidence,
          verification_status,
          usage_count,
          ts_rank(search_vector, plainto_tsquery('english', $1)) as relevance
        FROM knowledge_store
        WHERE 
          (search_vector @@ plainto_tsquery('english', $1)
           OR key ILIKE $2
           OR value::text ILIKE $2)
          AND confidence >= $3
          AND (expires_at IS NULL OR expires_at > NOW())
      `;

      const params: any[] = [searchQuery, `%${searchQuery}%`, minConfidence];
      let paramCount = 3;

      if (options?.verificationStatus) {
        paramCount++;
        sql += ` AND verification_status = $${paramCount}`;
        params.push(options.verificationStatus);
      }

      sql += ` ORDER BY relevance DESC, confidence DESC, usage_count DESC LIMIT $${paramCount + 1}`;
      params.push(limit);

      const result = await query(sql, params);

      return result.rows.map(row => ({
        key: row.key,
        value: row.value,
        confidence: row.confidence,
        relevance: row.relevance,
        usage_count: row.usage_count,
        verification_status: row.verification_status
      }));
    } catch (error) {
      logger.error('Failed to search knowledge', { searchQuery, error });
      throw error;
    }
  }

  /**
   * Delete by key or pattern
   */
  async delete(pattern: string): Promise<number> {
    try {
      const sql = `
        DELETE FROM knowledge_store 
        WHERE key = $1 OR key LIKE $2
        RETURNING key
      `;
      const result = await query(sql, [pattern, pattern + '.%']);
      
      logger.info('Knowledge deleted', { 
        pattern, 
        deletedCount: result.rowCount 
      });

      return result.rowCount || 0;
    } catch (error) {
      logger.error('Failed to delete knowledge', { pattern, error });
      throw error;
    }
  }

  /**
   * List all keys (with optional prefix filter)
   */
  async keys(prefix?: string): Promise<string[]> {
    try {
      const sql = prefix
        ? `SELECT key FROM knowledge_store 
           WHERE key LIKE $1 AND (expires_at IS NULL OR expires_at > NOW())
           ORDER BY key`
        : `SELECT key FROM knowledge_store 
           WHERE expires_at IS NULL OR expires_at > NOW()
           ORDER BY key`;

      const result = await query(sql, prefix ? [prefix + '%'] : []);
      return result.rows.map(r => r.key);
    } catch (error) {
      logger.error('Failed to list keys', { prefix, error });
      throw error;
    }
  }

  /**
   * Get all entries as object
   */
  async getAll(prefix?: string): Promise<Record<string, any>> {
    try {
      const sql = prefix
        ? `SELECT key, value FROM knowledge_store 
           WHERE key LIKE $1 AND (expires_at IS NULL OR expires_at > NOW())`
        : `SELECT key, value FROM knowledge_store 
           WHERE expires_at IS NULL OR expires_at > NOW()`;

      const result = await query(sql, prefix ? [prefix + '%'] : []);

      const obj: Record<string, any> = {};
      for (const row of result.rows) {
        obj[row.key] = row.value;
      }
      return obj;
    } catch (error) {
      logger.error('Failed to get all knowledge', { error });
      throw error;
    }
  }

  /**
   * Bulk operations
   */
  async bulk(operations: Array<{
    action: 'set' | 'delete';
    key: string;
    value?: any;
    options?: any;
  }>): Promise<void> {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      for (const op of operations) {
        if (op.action === 'set') {
          const jsonValue = typeof op.value === 'string' 
            ? JSON.stringify(op.value) 
            : JSON.stringify(op.value);

          await client.query(`
            INSERT INTO knowledge_store (key, value)
            VALUES ($1, $2)
            ON CONFLICT (key) 
            DO UPDATE SET value = $2, updated_at = NOW()
          `, [op.key, jsonValue]);
        } else if (op.action === 'delete') {
          await client.query(`
            DELETE FROM knowledge_store 
            WHERE key = $1 OR key LIKE $2
          `, [op.key, op.key + '.%']);
        }
      }

      await client.query('COMMIT');
      logger.info('Bulk operations completed', { count: operations.length });
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Bulk operations failed', { error });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Update confidence based on usage
   */
  async updateConfidence(
    key: string, 
    success: boolean
  ): Promise<void> {
    try {
      const column = success ? 'success_count' : 'failure_count';
      
      const sql = `
        UPDATE knowledge_store 
        SET 
          ${column} = ${column} + 1,
          confidence = CASE 
            WHEN success_count + failure_count > 0 
            THEN success_count::float / (success_count + failure_count + 1)
            ELSE confidence
          END
        WHERE key = $1
      `;

      await query(sql, [key]);
    } catch (error) {
      logger.error('Failed to update confidence', { key, error });
    }
  }

  /**
   * Promote knowledge to verified status
   */
  async promote(key: string): Promise<void> {
    try {
      await query(`
        UPDATE knowledge_store 
        SET verification_status = 'verified', confidence = 1.0
        WHERE key = $1
      `, [key]);

      logger.info('Knowledge promoted to verified', { key });
    } catch (error) {
      logger.error('Failed to promote knowledge', { key, error });
      throw error;
    }
  }

  /**
   * Get analytics
   */
  async getAnalytics(): Promise<any> {
    try {
      const stats = await query(`
        SELECT 
          COUNT(*) as total_entries,
          COUNT(CASE WHEN verification_status = 'verified' THEN 1 END) as verified_count,
          COUNT(CASE WHEN verification_status = 'learned' THEN 1 END) as learned_count,
          AVG(confidence) as avg_confidence,
          SUM(usage_count) as total_usage,
          MAX(updated_at) as last_update
        FROM knowledge_store
      `);

      const topUsed = await query(`
        SELECT key, usage_count, confidence, verification_status
        FROM knowledge_store
        ORDER BY usage_count DESC
        LIMIT 10
      `);

      const recentlyAdded = await query(`
        SELECT key, created_at, verification_status
        FROM knowledge_store
        ORDER BY created_at DESC
        LIMIT 10
      `);

      return {
        stats: stats.rows[0],
        topUsed: topUsed.rows,
        recentlyAdded: recentlyAdded.rows
      };
    } catch (error) {
      logger.error('Failed to get analytics', { error });
      throw error;
    }
  }

  /**
   * Helper: Set nested value in object
   */
  private setNestedValue(obj: any, path: string, value: any): void {
    const keys = path.split('.');
    let current = obj;

    for (let i = 0; i < keys.length - 1; i++) {
      if (!current[keys[i]]) {
        current[keys[i]] = {};
      }
      current = current[keys[i]];
    }

    current[keys[keys.length - 1]] = value;
  }

  /**
   * Helper: Track usage
   */
  private async trackUsage(key: string): Promise<void> {
    try {
      await query(`
        UPDATE knowledge_store 
        SET usage_count = usage_count + 1, last_accessed = NOW()
        WHERE key = $1
      `, [key]);
    } catch (error) {
      // Don't throw, just log - this is not critical
      logger.debug('Failed to track usage', { key, error });
    }
  }

  /**
   * Clean up expired entries
   */
  async cleanupExpired(): Promise<number> {
    try {
      const result = await query(`
        DELETE FROM knowledge_store 
        WHERE expires_at IS NOT NULL AND expires_at < NOW()
        RETURNING key
      `);

      if (result.rowCount && result.rowCount > 0) {
        logger.info('Cleaned up expired knowledge', { 
          count: result.rowCount 
        });
      }

      return result.rowCount || 0;
    } catch (error) {
      logger.error('Failed to cleanup expired knowledge', { error });
      throw error;
    }
  }
}

// Export singleton instance
export const knowledgeStore = new KnowledgeStore();