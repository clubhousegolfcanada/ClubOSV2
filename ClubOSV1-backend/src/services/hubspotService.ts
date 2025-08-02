import axios, { AxiosInstance } from 'axios';
import { logger } from '../utils/logger';

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
  private cache = new Map<string, CacheEntry>();
  private CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
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

      // Check cache first
      const cacheKey = `phone:${normalized}`;
      const cached = this.cache.get(cacheKey);
      
      if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
        logger.debug('Returning cached result for:', normalized);
        return cached.data;
      }

      // Search multiple phone fields in HubSpot
      const response = await this.axiosInstance.post('/objects/contacts/search', {
        filterGroups: [{
          filters: [
            {
              propertyName: 'phone',
              operator: 'CONTAINS_TOKEN',
              value: normalized
            },
            {
              propertyName: 'mobilephone',
              operator: 'CONTAINS_TOKEN',
              value: normalized
            },
            {
              propertyName: 'work_phone',
              operator: 'CONTAINS_TOKEN',
              value: normalized
            }
          ]
        }],
        properties: ['firstname', 'lastname', 'company', 'email', 'phone', 'mobilephone', 'work_phone'],
        limit: 1
      });
      
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
        
        // Cache the result
        this.cache.set(cacheKey, { data: result, timestamp: Date.now() });
        logger.debug('Found HubSpot contact:', result.name);
        return result;
      }
      
      // Cache null result too (to avoid repeated lookups for unknown numbers)
      this.cache.set(cacheKey, { data: null, timestamp: Date.now() });
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
    this.cache.clear();
    logger.info('HubSpot cache cleared');
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
  getCacheStats(): { size: number; entries: string[] } {
    return {
      size: this.cache.size,
      entries: Array.from(this.cache.keys())
    };
  }
}

// Export singleton instance
export const hubspotService = new HubSpotService();

// Export types
export type { HubSpotContact };