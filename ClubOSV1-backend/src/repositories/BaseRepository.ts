import { pool, query } from '../utils/db';
import { logger } from '../utils/logger';

/**
 * Base repository class that provides common database operations
 * All repository classes should extend this class
 */
export abstract class BaseRepository {
  protected tableName: string;

  constructor(tableName: string) {
    this.tableName = tableName;
  }

  /**
   * Find a single record by ID
   */
  async findById(id: string | number): Promise<any> {
    try {
      const queryText = `SELECT * FROM ${this.tableName} WHERE id = $1`;
      const result = await query(queryText, [id]);
      return result.rows[0];
    } catch (error) {
      logger.error(`Error in findById for ${this.tableName}:`, error);
      throw error;
    }
  }

  /**
   * Find all records with optional pagination
   */
  async findAll(limit = 100, offset = 0): Promise<any[]> {
    try {
      const queryText = `
        SELECT * FROM ${this.tableName} 
        ORDER BY created_at DESC 
        LIMIT $1 OFFSET $2
      `;
      const result = await query(queryText, [limit, offset]);
      return result.rows;
    } catch (error) {
      logger.error(`Error in findAll for ${this.tableName}:`, error);
      throw error;
    }
  }

  /**
   * Find records by condition
   */
  async findWhere(conditions: Record<string, any>): Promise<any[]> {
    try {
      const keys = Object.keys(conditions);
      const values = Object.values(conditions);
      
      if (keys.length === 0) {
        return this.findAll();
      }
      
      const whereClause = keys.map((key, i) => `${key} = $${i + 1}`).join(' AND ');
      const queryText = `SELECT * FROM ${this.tableName} WHERE ${whereClause} ORDER BY created_at DESC`;
      
      const result = await query(queryText, values);
      return result.rows;
    } catch (error) {
      logger.error(`Error in findWhere for ${this.tableName}:`, error);
      throw error;
    }
  }

  /**
   * Find a single record by condition
   */
  async findOneWhere(conditions: Record<string, any>): Promise<any> {
    const results = await this.findWhere(conditions);
    return results[0] || null;
  }

  /**
   * Create a new record
   */
  async create(data: Record<string, any>): Promise<any> {
    try {
      const keys = Object.keys(data);
      const values = Object.values(data);
      const columns = keys.join(', ');
      const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
      
      const queryText = `
        INSERT INTO ${this.tableName} (${columns})
        VALUES (${placeholders})
        RETURNING *
      `;
      
      const result = await query(queryText, values);
      return result.rows[0];
    } catch (error) {
      logger.error(`Error in create for ${this.tableName}:`, error);
      throw error;
    }
  }

  /**
   * Update a record by ID
   */
  async update(id: string | number, data: Record<string, any>): Promise<any> {
    try {
      const keys = Object.keys(data);
      const values = Object.values(data);
      
      if (keys.length === 0) {
        return this.findById(id);
      }
      
      const setClause = keys.map((key, i) => `${key} = $${i + 1}`).join(', ');
      
      const queryText = `
        UPDATE ${this.tableName}
        SET ${setClause}, updated_at = NOW()
        WHERE id = $${keys.length + 1}
        RETURNING *
      `;
      
      const result = await query(queryText, [...values, id]);
      return result.rows[0];
    } catch (error) {
      logger.error(`Error in update for ${this.tableName}:`, error);
      throw error;
    }
  }

  /**
   * Update records by condition
   */
  async updateWhere(conditions: Record<string, any>, data: Record<string, any>): Promise<any[]> {
    try {
      const conditionKeys = Object.keys(conditions);
      const conditionValues = Object.values(conditions);
      const dataKeys = Object.keys(data);
      const dataValues = Object.values(data);
      
      if (conditionKeys.length === 0 || dataKeys.length === 0) {
        return [];
      }
      
      const setClause = dataKeys.map((key, i) => `${key} = $${i + 1}`).join(', ');
      const whereClause = conditionKeys.map((key, i) => `${key} = $${i + 1 + dataKeys.length}`).join(' AND ');
      
      const queryText = `
        UPDATE ${this.tableName}
        SET ${setClause}, updated_at = NOW()
        WHERE ${whereClause}
        RETURNING *
      `;
      
      const result = await query(queryText, [...dataValues, ...conditionValues]);
      return result.rows;
    } catch (error) {
      logger.error(`Error in updateWhere for ${this.tableName}:`, error);
      throw error;
    }
  }

  /**
   * Delete a record by ID
   */
  async delete(id: string | number): Promise<boolean> {
    try {
      const queryText = `DELETE FROM ${this.tableName} WHERE id = $1`;
      const result = await query(queryText, [id]);
      return (result.rowCount ?? 0) > 0;
    } catch (error) {
      logger.error(`Error in delete for ${this.tableName}:`, error);
      throw error;
    }
  }

  /**
   * Delete records by condition
   */
  async deleteWhere(conditions: Record<string, any>): Promise<number> {
    try {
      const keys = Object.keys(conditions);
      const values = Object.values(conditions);
      
      if (keys.length === 0) {
        throw new Error('Cannot delete without conditions');
      }
      
      const whereClause = keys.map((key, i) => `${key} = $${i + 1}`).join(' AND ');
      const queryText = `DELETE FROM ${this.tableName} WHERE ${whereClause}`;
      
      const result = await query(queryText, values);
      return result.rowCount ?? 0;
    } catch (error) {
      logger.error(`Error in deleteWhere for ${this.tableName}:`, error);
      throw error;
    }
  }

  /**
   * Execute raw SQL query
   */
  async raw(queryText: string, params: any[] = []): Promise<any[]> {
    try {
      const result = await query(queryText, params);
      return result.rows;
    } catch (error) {
      logger.error(`Error in raw query for ${this.tableName}:`, error);
      throw error;
    }
  }

  /**
   * Count records
   */
  async count(conditions?: Record<string, any>): Promise<number> {
    try {
      let queryText = `SELECT COUNT(*) FROM ${this.tableName}`;
      let params: any[] = [];
      
      if (conditions && Object.keys(conditions).length > 0) {
        const keys = Object.keys(conditions);
        const values = Object.values(conditions);
        const whereClause = keys.map((key, i) => `${key} = $${i + 1}`).join(' AND ');
        queryText += ` WHERE ${whereClause}`;
        params = values;
      }
      
      const result = await query(queryText, params);
      return parseInt(result.rows[0].count);
    } catch (error) {
      logger.error(`Error in count for ${this.tableName}:`, error);
      throw error;
    }
  }

  /**
   * Check if a record exists
   */
  async exists(conditions: Record<string, any>): Promise<boolean> {
    const count = await this.count(conditions);
    return count > 0;
  }

  /**
   * Begin a database transaction
   */
  async beginTransaction() {
    const client = await pool.connect();
    await client.query('BEGIN');
    return client;
  }

  /**
   * Commit a database transaction
   */
  async commitTransaction(client: any) {
    await client.query('COMMIT');
    client.release();
  }

  /**
   * Rollback a database transaction
   */
  async rollbackTransaction(client: any) {
    await client.query('ROLLBACK');
    client.release();
  }

  /**
   * Execute a query within a transaction
   */
  async queryInTransaction(client: any, queryText: string, params: any[] = []) {
    return client.query(queryText, params);
  }

  /**
   * Get columns of the table
   */
  async getColumns(): Promise<string[]> {
    try {
      const queryText = `
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = $1
        ORDER BY ordinal_position
      `;
      const result = await query(queryText, [this.tableName]);
      return result.rows.map(row => row.column_name);
    } catch (error) {
      logger.error(`Error getting columns for ${this.tableName}:`, error);
      throw error;
    }
  }

  /**
   * Bulk insert records
   */
  async bulkCreate(records: Record<string, any>[]): Promise<any[]> {
    if (records.length === 0) return [];
    
    try {
      const keys = Object.keys(records[0]);
      const columns = keys.join(', ');
      
      const values: any[] = [];
      const placeholders = records.map((record, recordIndex) => {
        const recordPlaceholders = keys.map((key, keyIndex) => {
          values.push(record[key]);
          return `$${recordIndex * keys.length + keyIndex + 1}`;
        }).join(', ');
        return `(${recordPlaceholders})`;
      }).join(', ');
      
      const queryText = `
        INSERT INTO ${this.tableName} (${columns})
        VALUES ${placeholders}
        RETURNING *
      `;
      
      const result = await query(queryText, values);
      return result.rows;
    } catch (error) {
      logger.error(`Error in bulkCreate for ${this.tableName}:`, error);
      throw error;
    }
  }
}