# HubSpot CRM Integration - Detailed Implementation Guide

## Overview
Integrate HubSpot CRM to automatically populate customer names in ClubOS messages based on phone numbers stored in HubSpot contact profiles.

## Phase 1: Basic Phone Number Lookup (2-3 days)

### 1.1 Environment Setup

```bash
# Add to .env files
HUBSPOT_API_KEY=pat-na1-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
HUBSPOT_PORTAL_ID=12345678
HUBSPOT_API_URL=https://api.hubapi.com
```

### 1.2 Create HubSpot Service

**File: `/ClubOSV1-backend/src/services/hubspotService.ts`**

```typescript
import axios, { AxiosInstance } from 'axios';
import { logger } from '../utils/logger';
import { db } from '../utils/database';

interface HubSpotContact {
  id: string;
  properties: {
    firstname?: string;
    lastname?: string;
    phone?: string;
    mobilephone?: string;
    company?: string;
    email?: string;
    hs_object_id: string;
  };
  createdAt: string;
  updatedAt: string;
}

export class HubSpotService {
  private client: AxiosInstance;
  private apiKey: string;
  private isConfigured: boolean;

  constructor() {
    this.apiKey = process.env.HUBSPOT_API_KEY || '';
    this.isConfigured = !!this.apiKey;

    if (this.isConfigured) {
      this.client = axios.create({
        baseURL: 'https://api.hubapi.com',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      });
      logger.info('HubSpot service initialized');
    } else {
      logger.warn('HubSpot API key not configured');
      this.client = axios.create();
    }
  }

  /**
   * Search for a contact by phone number
   */
  async searchContactByPhone(phoneNumber: string): Promise<HubSpotContact | null> {
    if (!this.isConfigured) {
      return null;
    }

    try {
      // Normalize phone number - remove all non-digits
      const normalizedPhone = phoneNumber.replace(/\D/g, '');
      
      // Search in both phone and mobilephone fields
      const searchQuery = {
        filterGroups: [
          {
            filters: [
              {
                propertyName: 'phone',
                operator: 'CONTAINS_TOKEN',
                value: `*${normalizedPhone.slice(-10)}*` // Last 10 digits
              }
            ]
          },
          {
            filters: [
              {
                propertyName: 'mobilephone',
                operator: 'CONTAINS_TOKEN',
                value: `*${normalizedPhone.slice(-10)}*`
              }
            ]
          }
        ],
        properties: ['firstname', 'lastname', 'phone', 'mobilephone', 'company', 'email'],
        limit: 1
      };

      const response = await this.client.post('/crm/v3/objects/contacts/search', searchQuery);
      
      if (response.data.results && response.data.results.length > 0) {
        const contact = response.data.results[0];
        logger.info('Found HubSpot contact', { 
          phoneNumber, 
          contactId: contact.id,
          name: `${contact.properties.firstname || ''} ${contact.properties.lastname || ''}`.trim()
        });
        return contact;
      }

      return null;
    } catch (error: any) {
      logger.error('HubSpot search failed', {
        phoneNumber,
        error: error.response?.data || error.message
      });
      return null;
    }
  }

  /**
   * Get contact name from HubSpot contact
   */
  getContactName(contact: HubSpotContact): string {
    const { firstname, lastname, company } = contact.properties;
    
    // Try full name first
    const fullName = `${firstname || ''} ${lastname || ''}`.trim();
    if (fullName) return fullName;
    
    // Fall back to company name
    if (company) return company;
    
    // Fall back to email prefix
    if (contact.properties.email) {
      return contact.properties.email.split('@')[0];
    }
    
    return 'Unknown';
  }

  /**
   * Cache contact data to reduce API calls
   */
  async cacheContact(phoneNumber: string, contact: HubSpotContact | null): Promise<void> {
    try {
      if (contact) {
        await db.query(`
          INSERT INTO hubspot_contacts_cache 
          (phone_number, hubspot_contact_id, contact_name, company, email, properties, cached_at, expires_at)
          VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW() + INTERVAL '24 hours')
          ON CONFLICT (phone_number) 
          DO UPDATE SET 
            hubspot_contact_id = $2,
            contact_name = $3,
            company = $4,
            email = $5,
            properties = $6,
            cached_at = NOW(),
            expires_at = NOW() + INTERVAL '24 hours'
        `, [
          phoneNumber,
          contact.id,
          this.getContactName(contact),
          contact.properties.company || null,
          contact.properties.email || null,
          JSON.stringify(contact.properties)
        ]);
      } else {
        // Cache negative result to avoid repeated lookups
        await db.query(`
          INSERT INTO hubspot_contacts_cache 
          (phone_number, cached_at, expires_at)
          VALUES ($1, NOW(), NOW() + INTERVAL '1 hour')
          ON CONFLICT (phone_number) 
          DO UPDATE SET 
            cached_at = NOW(),
            expires_at = NOW() + INTERVAL '1 hour'
        `, [phoneNumber]);
      }
    } catch (error) {
      logger.error('Failed to cache HubSpot contact', { phoneNumber, error });
    }
  }

  /**
   * Get cached contact or fetch from HubSpot
   */
  async getContactByPhone(phoneNumber: string): Promise<{ name: string; hubspotId?: string } | null> {
    if (!this.isConfigured) {
      return null;
    }

    try {
      // Check cache first
      const cached = await db.query(`
        SELECT * FROM hubspot_contacts_cache 
        WHERE phone_number = $1 AND expires_at > NOW()
      `, [phoneNumber]);

      if (cached.rows.length > 0) {
        const cache = cached.rows[0];
        if (cache.contact_name) {
          return {
            name: cache.contact_name,
            hubspotId: cache.hubspot_contact_id
          };
        }
        return null; // Cached negative result
      }

      // Not in cache, search HubSpot
      const contact = await this.searchContactByPhone(phoneNumber);
      
      // Cache the result
      await this.cacheContact(phoneNumber, contact);
      
      if (contact) {
        return {
          name: this.getContactName(contact),
          hubspotId: contact.id
        };
      }

      return null;
    } catch (error) {
      logger.error('Failed to get contact by phone', { phoneNumber, error });
      return null;
    }
  }
}

// Export singleton instance
export const hubspotService = new HubSpotService();
```

### 1.3 Database Migration

**File: `/ClubOSV1-backend/src/database/migrations/026_hubspot_integration.sql`**

```sql
-- Create HubSpot contacts cache table
CREATE TABLE IF NOT EXISTS hubspot_contacts_cache (
  phone_number VARCHAR(20) PRIMARY KEY,
  hubspot_contact_id VARCHAR(255),
  contact_name VARCHAR(255),
  company VARCHAR(255),
  email VARCHAR(255),
  properties JSONB,
  cached_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP DEFAULT NOW() + INTERVAL '24 hours'
);

-- Add indexes for performance
CREATE INDEX idx_hubspot_cache_expires ON hubspot_contacts_cache(expires_at);
CREATE INDEX idx_hubspot_cache_contact_id ON hubspot_contacts_cache(hubspot_contact_id);

-- Add HubSpot tracking to conversations
ALTER TABLE openphone_conversations 
ADD COLUMN IF NOT EXISTS hubspot_contact_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS hubspot_last_sync TIMESTAMP,
ADD COLUMN IF NOT EXISTS hubspot_sync_status VARCHAR(50);

-- Create index for HubSpot lookups
CREATE INDEX idx_openphone_hubspot_id ON openphone_conversations(hubspot_contact_id);
```

### 1.4 Update OpenPhone Webhook Handler

**Update: `/ClubOSV1-backend/src/routes/openphone.ts`**

Add HubSpot lookup when receiving messages:

```typescript
import { hubspotService } from '../services/hubspotService';

// In the webhook handler, after extracting phone number:
if (phoneNumber && customerName === 'Unknown' || !customerName) {
  // Try to get name from HubSpot
  const hubspotContact = await hubspotService.getContactByPhone(phoneNumber);
  if (hubspotContact) {
    customerName = hubspotContact.name;
    logger.info('Resolved customer name from HubSpot', { 
      phoneNumber, 
      customerName,
      hubspotId: hubspotContact.hubspotId 
    });
  }
}
```

### 1.5 Add API Endpoint for Manual Lookup

**File: `/ClubOSV1-backend/src/routes/contacts.ts`**

```typescript
import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { roleGuard } from '../middleware/roleGuard';
import { hubspotService } from '../services/hubspotService';
import { db } from '../utils/database';
import { logger } from '../utils/logger';

const router = Router();

// Lookup contact by phone
router.get('/lookup',
  authenticate,
  roleGuard(['admin', 'operator', 'support']),
  async (req, res) => {
    try {
      const { phone } = req.query;
      
      if (!phone) {
        return res.status(400).json({
          success: false,
          error: 'Phone number required'
        });
      }

      const contact = await hubspotService.getContactByPhone(phone as string);
      
      res.json({
        success: true,
        data: contact || { name: 'Unknown', source: 'not_found' }
      });
    } catch (error) {
      logger.error('Contact lookup failed', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to lookup contact'
      });
    }
  }
);

// Sync all unknown contacts
router.post('/sync',
  authenticate,
  roleGuard(['admin']),
  async (req, res) => {
    try {
      // Get all conversations with Unknown names
      const unknownContacts = await db.query(`
        SELECT DISTINCT phone_number 
        FROM openphone_conversations 
        WHERE customer_name = 'Unknown' 
        OR customer_name IS NULL
        OR customer_name = phone_number
        LIMIT 100
      `);

      let synced = 0;
      let failed = 0;

      for (const row of unknownContacts.rows) {
        try {
          const contact = await hubspotService.getContactByPhone(row.phone_number);
          if (contact) {
            // Update the conversation
            await db.query(`
              UPDATE openphone_conversations
              SET 
                customer_name = $1,
                hubspot_contact_id = $2,
                hubspot_last_sync = NOW(),
                hubspot_sync_status = 'synced'
              WHERE phone_number = $3
            `, [contact.name, contact.hubspotId, row.phone_number]);
            
            synced++;
          }
        } catch (error) {
          logger.error('Failed to sync contact', { 
            phoneNumber: row.phone_number, 
            error 
          });
          failed++;
        }
      }

      res.json({
        success: true,
        data: {
          synced,
          failed,
          total: unknownContacts.rows.length
        }
      });
    } catch (error) {
      logger.error('Contact sync failed', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to sync contacts'
      });
    }
  }
);

export default router;
```

### 1.6 Register Routes

**Update: `/ClubOSV1-backend/src/index.ts`**

```typescript
import contactsRoutes from './routes/contacts';

// Add after other route registrations
app.use('/api/contacts', contactsRoutes);
```

## Phase 2: Frontend Integration (1-2 days)

### 2.1 Add Sync Button to Messages Page

```typescript
// In messages.tsx, add sync button for admins
{user?.role === 'admin' && (
  <button
    onClick={async () => {
      try {
        const token = localStorage.getItem('clubos_token');
        const response = await axios.post(
          `${API_URL}/contacts/sync`,
          {},
          { headers: { Authorization: `Bearer ${token}` } }
        );
        
        if (response.data.success) {
          toast.success(`Synced ${response.data.data.synced} contacts from HubSpot`);
          loadConversations();
        }
      } catch (error) {
        toast.error('Failed to sync contacts');
      }
    }}
    className="px-3 py-2 bg-[var(--bg-secondary)] text-[var(--text-secondary)] rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors text-sm"
  >
    Sync HubSpot Names
  </button>
)}
```

## Testing Steps

1. **Set up HubSpot API key** in environment variables
2. **Run database migration** to create cache table
3. **Test manual lookup**: 
   ```bash
   curl http://localhost:3001/api/contacts/lookup?phone=+1234567890
   ```
4. **Test webhook integration**: Send a test message
5. **Test bulk sync**: Use the sync button as admin
6. **Monitor logs** for HubSpot API calls

## Security Considerations

- API key stored securely in environment variables
- Rate limiting: HubSpot allows 100 requests/second
- Cache results to minimize API calls
- Audit log all CRM access
- Only sync phone numbers, not full contact data

## Future Enhancements

1. **Two-way sync**: Update HubSpot when new conversations start
2. **Rich profiles**: Show company, deals, tickets in UI
3. **Activity logging**: Log all SMS conversations to HubSpot timeline
4. **Automation**: Create tasks/tickets based on message content
5. **Analytics**: Track customer engagement metrics