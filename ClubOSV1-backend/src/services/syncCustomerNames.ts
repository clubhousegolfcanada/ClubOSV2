/**
 * Customer Name Sync Service
 * 
 * Periodically syncs customer names from HubSpot for conversations
 * that are showing as "Unknown" or phone numbers
 */

import { db } from '../utils/database';
import { logger } from '../utils/logger';
import { hubspotService } from './hubspotService';

export class CustomerNameSyncService {
  private isRunning = false;
  private syncInterval: NodeJS.Timeout | null = null;

  /**
   * Start the sync service
   */
  start() {
    // Run immediately on startup
    this.syncCustomerNames();
    
    // Then run every 5 minutes
    this.syncInterval = setInterval(() => {
      this.syncCustomerNames();
    }, 5 * 60 * 1000);
    
    logger.info('Customer name sync service started');
  }

  /**
   * Stop the sync service
   */
  stop() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    logger.info('Customer name sync service stopped');
  }

  /**
   * Sync customer names from HubSpot
   */
  async syncCustomerNames() {
    if (this.isRunning) {
      logger.debug('Customer name sync already running, skipping');
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();
    let updatedCount = 0;
    let checkedCount = 0;

    try {
      // Find conversations that need name updates
      // - customer_name is Unknown
      // - customer_name looks like a phone number
      // - customer_name is NULL
      const result = await db.query(`
        SELECT DISTINCT ON (phone_number) 
          id, phone_number, customer_name
        FROM openphone_conversations
        WHERE customer_name IS NULL 
          OR customer_name = 'Unknown' 
          OR customer_name ~ '^[0-9()+-]+$'
          OR customer_name = ''
        ORDER BY phone_number, updated_at DESC
        LIMIT 50
      `);

      logger.info(`Found ${result.rows.length} conversations needing name updates`);

      for (const conv of result.rows) {
        checkedCount++;
        
        try {
          // Look up contact in HubSpot
          const hubspotContact = await hubspotService.searchByPhone(conv.phone_number);
          
          if (hubspotContact && hubspotContact.name && hubspotContact.name !== 'Unknown') {
            // Update all conversations for this phone number
            const updateResult = await db.query(`
              UPDATE openphone_conversations
              SET customer_name = $1, updated_at = CURRENT_TIMESTAMP
              WHERE phone_number = $2
                AND (customer_name IS NULL 
                  OR customer_name = 'Unknown' 
                  OR customer_name ~ '^[0-9()+-]+$'
                  OR customer_name = '')
            `, [hubspotContact.name, conv.phone_number]);
            
            if (updateResult.rowCount > 0) {
              updatedCount += updateResult.rowCount;
              logger.info(`Updated customer name for ${conv.phone_number}:`, {
                oldName: conv.customer_name,
                newName: hubspotContact.name,
                conversationsUpdated: updateResult.rowCount
              });
            }
          }
        } catch (error) {
          logger.error(`Error syncing name for ${conv.phone_number}:`, error);
        }
        
        // Add small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      const duration = Date.now() - startTime;
      logger.info('Customer name sync completed', {
        checked: checkedCount,
        updated: updatedCount,
        duration: `${duration}ms`
      });

    } catch (error) {
      logger.error('Customer name sync failed:', error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Manually trigger a sync for a specific phone number
   */
  async syncPhoneNumber(phoneNumber: string): Promise<boolean> {
    try {
      const hubspotContact = await hubspotService.searchByPhone(phoneNumber);
      
      if (hubspotContact && hubspotContact.name && hubspotContact.name !== 'Unknown') {
        const updateResult = await db.query(`
          UPDATE openphone_conversations
          SET customer_name = $1, updated_at = CURRENT_TIMESTAMP
          WHERE phone_number = $2
        `, [hubspotContact.name, phoneNumber]);
        
        logger.info(`Manually synced customer name for ${phoneNumber}:`, {
          name: hubspotContact.name,
          conversationsUpdated: updateResult.rowCount
        });
        
        return updateResult.rowCount > 0;
      }
      
      return false;
    } catch (error) {
      logger.error(`Error manually syncing name for ${phoneNumber}:`, error);
      return false;
    }
  }
}

// Export singleton instance
export const customerNameSyncService = new CustomerNameSyncService();