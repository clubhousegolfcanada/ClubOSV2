import { logger } from '../utils/logger';
import { db } from '../utils/database';
import { anonymizePhoneNumber, encrypt, decrypt } from '../utils/encryption';
import { format } from 'date-fns';

interface DataRetentionPolicy {
  tableName: string;
  retentionDays: number;
  deleteStrategy: 'hard' | 'soft' | 'anonymize';
}

export class DataPrivacyService {
  private retentionPolicies: DataRetentionPolicy[] = [
    // Conversation data - keep for 2 years
    { tableName: 'openphone_conversations', retentionDays: 730, deleteStrategy: 'anonymize' },
    
    // Call transcripts - keep for 1 year
    { tableName: 'call_transcripts', retentionDays: 365, deleteStrategy: 'anonymize' },
    
    // AI suggestions - keep for 90 days
    { tableName: 'message_suggestions', retentionDays: 90, deleteStrategy: 'hard' },
    
    // Auth logs - keep for 1 year
    { tableName: 'auth_logs', retentionDays: 365, deleteStrategy: 'hard' },
    
    // Extracted knowledge - keep indefinitely but anonymize source after 1 year
    { tableName: 'extracted_knowledge', retentionDays: 365, deleteStrategy: 'soft' }
  ];

  /**
   * Export all data for a phone number (GDPR right to data portability)
   */
  async exportUserData(phoneNumber: string, requestedBy: string): Promise<any> {
    try {
      logger.info('Exporting user data', {
        phoneNumber: anonymizePhoneNumber(phoneNumber),
        requestedBy
      });
      
      const data: any = {
        exportDate: new Date().toISOString(),
        phoneNumber: phoneNumber,
        conversations: [],
        callTranscripts: [],
        extractedKnowledge: []
      };
      
      // Export conversations
      const conversations = await db.query(
        `SELECT * FROM openphone_conversations WHERE phone_number = $1`,
        [phoneNumber]
      );
      
      data.conversations = conversations.rows.map(conv => ({
        ...conv,
        messages: conv.messages || [],
        exportedAt: new Date().toISOString()
      }));
      
      // Export call transcripts
      const transcripts = await db.query(
        `SELECT * FROM call_transcripts WHERE phone_number = $1`,
        [phoneNumber]
      );
      
      data.callTranscripts = transcripts.rows.map(transcript => ({
        ...transcript,
        dialogue: transcript.dialogue || [],
        exportedAt: new Date().toISOString()
      }));
      
      // Log the export for auditing
      await db.createAuthLog({
        user_id: requestedBy,
        action: 'export_user_data',
        ip_address: 'system',
        user_agent: 'DataPrivacyService',
        success: true,
        error_message: `Exported data for ${anonymizePhoneNumber(phoneNumber)}`
      });
      
      return data;
    } catch (error) {
      logger.error('Failed to export user data:', error);
      throw error;
    }
  }
  
  /**
   * Delete or anonymize all data for a phone number (GDPR right to erasure)
   */
  async deleteUserData(phoneNumber: string, requestedBy: string, hardDelete: boolean = false): Promise<any> {
    try {
      logger.info('Deleting user data', {
        phoneNumber: anonymizePhoneNumber(phoneNumber),
        requestedBy,
        hardDelete
      });
      
      const results = {
        conversationsDeleted: 0,
        transcriptsDeleted: 0,
        suggestionsDeleted: 0
      };
      
      if (hardDelete) {
        // Hard delete - completely remove data
        const convResult = await db.query(
          `DELETE FROM openphone_conversations WHERE phone_number = $1`,
          [phoneNumber]
        );
        results.conversationsDeleted = convResult.rowCount || 0;
        
        const transcriptResult = await db.query(
          `DELETE FROM call_transcripts WHERE phone_number = $1`,
          [phoneNumber]
        );
        results.transcriptsDeleted = transcriptResult.rowCount || 0;
      } else {
        // Soft delete - anonymize data
        const convResult = await db.query(`
          UPDATE openphone_conversations 
          SET 
            phone_number = 'DELETED',
            customer_name = 'DELETED',
            messages = '[]'::jsonb,
            metadata = jsonb_build_object(
              'deleted_at', NOW(),
              'deleted_by', $2,
              'original_phone_hash', encode(sha256($1::bytea), 'hex')
            )
          WHERE phone_number = $1
        `, [phoneNumber, requestedBy]);
        results.conversationsDeleted = convResult.rowCount || 0;
        
        const transcriptResult = await db.query(`
          UPDATE call_transcripts 
          SET 
            phone_number = 'DELETED',
            dialogue = '[]'::jsonb
          WHERE phone_number = $1
        `, [phoneNumber]);
        results.transcriptsDeleted = transcriptResult.rowCount || 0;
      }
      
      // Always hard delete AI suggestions (they contain suggested responses)
      const suggestionResult = await db.query(
        `DELETE FROM message_suggestions 
         WHERE phone_number_hash = encode(sha256($1::bytea), 'hex')`,
        [phoneNumber]
      );
      results.suggestionsDeleted = suggestionResult.rowCount || 0;
      
      // Log the deletion
      await db.createAuthLog({
        user_id: requestedBy,
        action: hardDelete ? 'hard_delete_user_data' : 'anonymize_user_data',
        ip_address: 'system',
        user_agent: 'DataPrivacyService',
        success: true,
        error_message: `Deleted data for ${anonymizePhoneNumber(phoneNumber)}`
      });
      
      return results;
    } catch (error) {
      logger.error('Failed to delete user data:', error);
      throw error;
    }
  }
  
  /**
   * Apply retention policies automatically
   */
  async applyRetentionPolicies(): Promise<any> {
    const results: any = {};
    
    for (const policy of this.retentionPolicies) {
      try {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - policy.retentionDays);
        
        logger.info(`Applying retention policy for ${policy.tableName}`, {
          retentionDays: policy.retentionDays,
          cutoffDate: cutoffDate.toISOString(),
          strategy: policy.deleteStrategy
        });
        
        let affected = 0;
        
        switch (policy.deleteStrategy) {
          case 'hard':
            const deleteResult = await db.query(
              `DELETE FROM ${policy.tableName} WHERE created_at < $1`,
              [cutoffDate]
            );
            affected = deleteResult.rowCount || 0;
            break;
            
          case 'soft':
            const softDeleteResult = await db.query(
              `UPDATE ${policy.tableName} 
               SET deleted_at = NOW() 
               WHERE created_at < $1 AND deleted_at IS NULL`,
              [cutoffDate]
            );
            affected = softDeleteResult.rowCount || 0;
            break;
            
          case 'anonymize':
            // Table-specific anonymization logic
            if (policy.tableName === 'openphone_conversations') {
              const anonResult = await db.query(`
                UPDATE openphone_conversations 
                SET 
                  phone_number = 'ANONYMIZED',
                  customer_name = 'ANONYMIZED',
                  messages = '[]'::jsonb
                WHERE created_at < $1 
                  AND phone_number != 'ANONYMIZED'
                  AND phone_number != 'DELETED'
              `, [cutoffDate]);
              affected = anonResult.rowCount || 0;
            }
            // Add more table-specific logic as needed
            break;
        }
        
        results[policy.tableName] = {
          processed: affected,
          strategy: policy.deleteStrategy,
          cutoffDate: cutoffDate.toISOString()
        };
        
      } catch (error) {
        logger.error(`Failed to apply retention policy for ${policy.tableName}:`, error);
        results[policy.tableName] = { error: error.message };
      }
    }
    
    logger.info('Retention policies applied', results);
    return results;
  }
  
  /**
   * Get data retention report
   */
  async getRetentionReport(): Promise<any> {
    const report: any = {
      policies: this.retentionPolicies,
      currentData: {},
      oldestRecords: {}
    };
    
    for (const policy of this.retentionPolicies) {
      try {
        // Get count and oldest record
        const result = await db.query(`
          SELECT 
            COUNT(*) as total_records,
            MIN(created_at) as oldest_record,
            MAX(created_at) as newest_record
          FROM ${policy.tableName}
        `);
        
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - policy.retentionDays);
        
        // Get count of records that should be deleted
        const expiredResult = await db.query(
          `SELECT COUNT(*) as expired_count FROM ${policy.tableName} WHERE created_at < $1`,
          [cutoffDate]
        );
        
        report.currentData[policy.tableName] = {
          totalRecords: parseInt(result.rows[0].total_records),
          oldestRecord: result.rows[0].oldest_record,
          newestRecord: result.rows[0].newest_record,
          expiredRecords: parseInt(expiredResult.rows[0].expired_count),
          retentionDays: policy.retentionDays,
          deleteStrategy: policy.deleteStrategy
        };
      } catch (error) {
        report.currentData[policy.tableName] = { error: error.message };
      }
    }
    
    return report;
  }
  
  /**
   * Create audit log for data access
   */
  async logDataAccess(userId: string, dataType: string, recordId: string, action: string): Promise<void> {
    try {
      // Ensure data access log table exists
      await db.query(`
        CREATE TABLE IF NOT EXISTS data_access_logs (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES users(id),
          data_type VARCHAR(50) NOT NULL,
          record_id VARCHAR(255) NOT NULL,
          action VARCHAR(50) NOT NULL,
          ip_address VARCHAR(45),
          user_agent TEXT,
          created_at TIMESTAMP DEFAULT NOW()
        )
      `);
      
      await db.query(`
        INSERT INTO data_access_logs (user_id, data_type, record_id, action)
        VALUES ($1, $2, $3, $4)
      `, [userId, dataType, recordId, action]);
    } catch (error) {
      logger.error('Failed to log data access:', error);
    }
  }
}

// Export singleton instance
export const dataPrivacyService = new DataPrivacyService();