import axios, { AxiosInstance } from 'axios';
import { logger } from '../utils/logger';
import { db } from '../utils/database';

interface HubSpotContact {
  id: string;
  name: string;
  phone: string;
  company?: string;
  email?: string;
  hubspotId?: string;
}

interface CacheEntry {
  data: any;
  timestamp: number;
}

class HubSpotService {
  private apiKey: string | undefined;
  private baseUrl = 'https://api.hubapi.com/crm/v3';
  private memoryCache = new Map<string, CacheEntry>(); // Keep for quick lookups
  private MEMORY_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  private DB_CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours
  private isConnected = false;
  private axiosInstance: AxiosInstance;

  constructor() {
    this.apiKey = process.env.HUBSPOT_API_KEY;
    
    // Create axios instance with default config
    this.axiosInstance = axios.create({
      baseURL: this.baseUrl,
      timeout: 5000,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    // Verify connection on startup
    this.verifyConnection();
  }

  /**
   * Phone number normalization for reliable matching
   * Handles formats like: (902) 555-1234, 9025551234, +19025551234, 902-555-1234
   */
  private normalizePhone(phone: string): string {
    // Remove all non-digits
    const digits = phone.replace(/\D/g, '');
    
    // For North American numbers, use last 10 digits
    if (digits.length >= 10) {
      return digits.slice(-10);
    }
    
    return digits;
  }

  /**
   * Verify HubSpot connection on startup
   */
  async verifyConnection(): Promise<void> {
    if (!this.apiKey) {
      logger.warn('HubSpot API key not configured');
      return;
    }

    try {
      const response = await this.axiosInstance.get('/objects/contacts', {
        params: { limit: 1 }
      });
      
      this.isConnected = true;
      logger.info('✓ HubSpot connected successfully');
    } catch (error: any) {
      this.isConnected = false;
      
      if (error.response?.status === 401) {
        logger.error('❌ HubSpot connection failed - Invalid API key');
      } else if (error.response?.status === 403) {
        logger.error('❌ HubSpot connection failed - Missing required scopes (needs crm.objects.contacts.read)');
      } else {
        logger.error('❌ HubSpot connection failed', error.message);
      }
    }
  }

  /**
   * Search for a contact by phone number
   */
  async searchByPhone(phoneNumber: string): Promise<HubSpotContact | null> {
    // Skip if not connected
    if (!this.isConnected) {
      logger.debug('HubSpot not connected, skipping lookup');
      return null;
    }

    try {
      // Normalize the phone number
      const normalized = this.normalizePhone(phoneNumber);
      if (!normalized || normalized.length < 7) {
        logger.debug('Phone number too short for lookup:', phoneNumber);
        return null;
      }

      // Check memory cache first
      const cacheKey = `phone:${normalized}`;
      const memoryCached = this.memoryCache.get(cacheKey);
      
      if (memoryCached && Date.now() - memoryCached.timestamp < this.MEMORY_CACHE_DURATION) {
        logger.debug('Returning memory cached result for:', normalized);
        return memoryCached.data;
      }
      
      // Check database cache
      try {
        const dbCached = await db.query(
          `SELECT * FROM hubspot_cache WHERE phone_number = $1`,
          [phoneNumber]
        );
        
        if (dbCached.rows.length > 0) {
          const cacheEntry = dbCached.rows[0];
          const cacheAge = Date.now() - new Date(cacheEntry.updated_at).getTime();
          
          if (cacheAge < this.DB_CACHE_DURATION) {
            const result = cacheEntry.customer_name ? {
              id: cacheEntry.hubspot_contact_id || '',
              hubspotId: cacheEntry.hubspot_contact_id || '',
              name: cacheEntry.customer_name,
              phone: phoneNumber,
              company: cacheEntry.company,
              email: cacheEntry.email
            } : null;
            
            // Update memory cache
            this.memoryCache.set(cacheKey, { data: result, timestamp: Date.now() });
            logger.debug('Returning database cached result for:', normalized);
            return result;
          }
        }
      } catch (error) {
        logger.error('Error checking database cache:', error);
      }

      // Try multiple search strategies for better matching
      let response = null;
      
      // Phone number variations to try
      const phoneVariations = [
        '1' + normalized,      // 19025551234
        '+1' + normalized,     // +19025551234
        normalized,            // 9025551234
        normalized.slice(0, 3) + '-' + normalized.slice(3, 6) + '-' + normalized.slice(6), // 902-555-1234
      ];
      
      // Try each variation until we find a match
      for (const phoneVariation of phoneVariations) {
        try {
          const searchResponse = await this.axiosInstance.post('/objects/contacts/search', {
            filterGroups: [
              {
                filters: [{
                  propertyName: 'phone',
                  operator: 'EQ',
                  value: phoneVariation
                }]
              },
              {
                filters: [{
                  propertyName: 'mobilephone',
                  operator: 'EQ',
                  value: phoneVariation
                }]
              }
            ],
            properties: ['firstname', 'lastname', 'company', 'email', 'phone', 'mobilephone', 'work_phone'],
            limit: 1
          });
          
          if (searchResponse.data.results && searchResponse.data.results.length > 0) {
            response = searchResponse;
            logger.debug(`Found contact with phone variation: ${phoneVariation}`);
            break;
          }
        } catch (error) {
          // Continue to next variation
          logger.debug(`No match for variation: ${phoneVariation}`);
        }
      }
      
      // If no response, create empty response structure
      if (!response) {
        response = { data: { results: [] } };
      }
      
      if (response.data.results && response.data.results.length > 0) {
        const contact = response.data.results[0];
        const properties = contact.properties || {};
        
        const result: HubSpotContact = {
          id: contact.id,
          hubspotId: contact.id,
          name: `${properties.firstname || ''} ${properties.lastname || ''}`.trim() || 'Unknown',
          phone: properties.phone || properties.mobilephone || properties.work_phone || phoneNumber,
          company: properties.company,
          email: properties.email
        };
        
        // Cache the result in memory
        this.memoryCache.set(cacheKey, { data: result, timestamp: Date.now() });
        
        // Cache in database
        try {
          await db.query(`
            INSERT INTO hubspot_cache (phone_number, customer_name, company, email, hubspot_contact_id, updated_at)
            VALUES ($1, $2, $3, $4, $5, NOW())
            ON CONFLICT (phone_number) 
            DO UPDATE SET 
              customer_name = EXCLUDED.customer_name,
              company = EXCLUDED.company,
              email = EXCLUDED.email,
              hubspot_contact_id = EXCLUDED.hubspot_contact_id,
              updated_at = NOW()
          `, [phoneNumber, result.name !== 'Unknown' ? result.name : null, result.company, result.email, result.hubspotId]);
        } catch (error) {
          logger.error('Error caching to database:', error);
        }
        
        logger.debug('Found HubSpot contact:', result.name);
        return result;
      }
      
      // Cache null result too (to avoid repeated lookups for unknown numbers)
      this.memoryCache.set(cacheKey, { data: null, timestamp: Date.now() });
      
      // Cache "not found" in database
      try {
        await db.query(`
          INSERT INTO hubspot_cache (phone_number, customer_name, updated_at)
          VALUES ($1, NULL, NOW())
          ON CONFLICT (phone_number) 
          DO UPDATE SET 
            customer_name = NULL,
            updated_at = NOW()
        `, [phoneNumber]);
      } catch (error) {
        logger.error('Error caching not-found to database:', error);
      }
      
      logger.debug('No HubSpot contact found for:', normalized);
      return null;
      
    } catch (error: any) {
      // Don't break messages functionality - handle errors gracefully
      if (error.response?.status === 429) {
        logger.warn('HubSpot rate limit reached - consider increasing cache duration');
      } else if (error.code === 'ECONNABORTED') {
        logger.warn('HubSpot request timeout - consider increasing timeout');
      } else if (error.response?.status === 400) {
        logger.error('HubSpot bad request - check phone number format:', error.response.data);
      } else {
        logger.error('HubSpot lookup error:', error.message);
      }
      
      return null;
    }
  }

  /**
   * Search contacts by name or phone number
   */
  async searchContacts(query: string): Promise<HubSpotContact[]> {
    if (!this.isConnected || !query || query.length < 2) {
      return [];
    }

    try {
      // Check if searching by phone number
      const digitsOnly = query.replace(/\D/g, '');
      const isPhoneSearch = digitsOnly.length >= 3;
      
      if (isPhoneSearch) {
        // Search by phone if query looks like a number
        const result = await this.searchByPhone(query);
        return result ? [result] : [];
      }
      
      // Otherwise search by name using HubSpot's search API
      const response = await this.axiosInstance.post('/objects/contacts/search', {
        query: query,
        limit: 10,
        properties: ['firstname', 'lastname', 'phone', 'mobilephone', 'company', 'email']
      });
      
      const contacts: HubSpotContact[] = response.data.results.map((contact: any) => {
        const properties = contact.properties || {};
        return {
          id: contact.id,
          hubspotId: contact.id,
          name: `${properties.firstname || ''} ${properties.lastname || ''}`.trim() || 'Unknown',
          phone: properties.phone || properties.mobilephone || 'No phone',
          company: properties.company,
          email: properties.email
        };
      });
      
      logger.debug(`Found ${contacts.length} contacts for query: ${query}`);
      return contacts;
      
    } catch (error: any) {
      logger.error('HubSpot search failed:', error.message);
      return [];
    }
  }

  /**
   * Clear cache - useful for testing
   */
  clearCache(): void {
    this.memoryCache.clear();
    logger.info('HubSpot memory cache cleared');
  }
  
  /**
   * Clear database cache - useful for testing
   */
  async clearDatabaseCache(): Promise<void> {
    try {
      await db.query('DELETE FROM hubspot_cache');
      logger.info('HubSpot database cache cleared');
    } catch (error) {
      logger.error('Error clearing database cache:', error);
    }
  }

  /**
   * Get connection status
   */
  isHubSpotConnected(): boolean {
    return this.isConnected;
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<{ memorySize: number; dbSize: number; entries: string[] }> {
    try {
      const dbStats = await db.query('SELECT COUNT(*) as count FROM hubspot_cache');
      return {
        memorySize: this.memoryCache.size,
        dbSize: parseInt(dbStats.rows[0].count),
        entries: Array.from(this.memoryCache.keys())
      };
    } catch (error) {
      return {
        memorySize: this.memoryCache.size,
        dbSize: 0,
        entries: Array.from(this.memoryCache.keys())
      };
    }
  }
}

// Export singleton instance
export const hubspotService = new HubSpotService();

// Export types
export type { HubSpotContact };