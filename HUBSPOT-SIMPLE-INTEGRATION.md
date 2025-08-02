# HubSpot CRM Integration - Simple V1 Implementation

## Goal
Add customer names from HubSpot to the Messages page - both for incoming messages and when starting new conversations.

## Simple Architecture
```
Phone Number → HubSpot API → Get Name → Display in Messages
```

## Implementation Plan

### Step 1: Basic HubSpot Service (30 mins)
```typescript
// src/services/hubspotService.ts
import axios from 'axios';
import { logger } from '../utils/logger';

class HubSpotService {
  private apiKey = process.env.HUBSPOT_API_KEY;
  private baseUrl = 'https://api.hubapi.com/crm/v3';
  private cache = new Map<string, { data: any; timestamp: number }>();
  private CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  private isConnected = false;

  constructor() {
    // Verify connection on startup
    this.verifyConnection();
  }

  // Phone number normalization for reliable matching
  private normalizePhone(phone: string): string {
    // Remove all non-digits
    const digits = phone.replace(/\D/g, '');
    // For North American numbers, use last 10 digits
    if (digits.length >= 10) {
      return digits.slice(-10);
    }
    return digits;
  }

  async verifyConnection() {
    if (!this.apiKey) {
      logger.warn('HubSpot API key not configured');
      return;
    }

    try {
      await axios.get(`${this.baseUrl}/objects/contacts?limit=1`, {
        headers: { 'Authorization': `Bearer ${this.apiKey}` }
      });
      this.isConnected = true;
      logger.info('✓ HubSpot connected successfully');
    } catch (error) {
      this.isConnected = false;
      logger.error('❌ HubSpot connection failed - check API key', error);
    }
  }

  async searchByPhone(phoneNumber: string) {
    // Skip if not connected
    if (!this.isConnected) return null;

    try {
      // Check cache first
      const normalized = this.normalizePhone(phoneNumber);
      const cacheKey = `phone:${normalized}`;
      const cached = this.cache.get(cacheKey);
      
      if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
        return cached.data;
      }

      // Search multiple phone fields in HubSpot
      const response = await axios.post(
        `${this.baseUrl}/objects/contacts/search`,
        {
          filterGroups: [{
            filters: [
              {
                propertyName: 'phone',
                operator: 'CONTAINS',
                value: normalized
              },
              {
                propertyName: 'mobilephone',
                operator: 'CONTAINS',
                value: normalized
              },
              {
                propertyName: 'work_phone',
                operator: 'CONTAINS',
                value: normalized
              }
            ]
          }],
          properties: ['firstname', 'lastname', 'company', 'email', 'phone', 'mobilephone']
        },
        {
          headers: { 'Authorization': `Bearer ${this.apiKey}` },
          timeout: 5000 // 5 second timeout
        }
      );
      
      if (response.data.results.length > 0) {
        const contact = response.data.results[0];
        const result = {
          name: `${contact.properties.firstname || ''} ${contact.properties.lastname || ''}`.trim(),
          company: contact.properties.company,
          email: contact.properties.email,
          hubspotId: contact.id
        };
        
        // Cache the result
        this.cache.set(cacheKey, { data: result, timestamp: Date.now() });
        return result;
      }
      
      // Cache null result too (to avoid repeated lookups)
      this.cache.set(cacheKey, { data: null, timestamp: Date.now() });
      return null;
    } catch (error: any) {
      // Don't break messages functionality
      if (error.response?.status === 429) {
        logger.warn('HubSpot rate limit reached');
      } else if (error.code === 'ECONNABORTED') {
        logger.warn('HubSpot request timeout');
      } else {
        logger.error('HubSpot lookup error:', error.message);
      }
      return null;
    }
  }

  async searchContacts(query: string) {
    if (!this.isConnected || !query || query.length < 2) {
      return [];
    }

    try {
      // Check if searching by phone number
      const isPhoneSearch = /^\d{3,}/.test(query.replace(/\D/g, ''));
      
      if (isPhoneSearch) {
        // Search by phone if query looks like a number
        const result = await this.searchByPhone(query);
        return result ? [{
          id: result.hubspotId,
          name: result.name || 'Unknown',
          phone: query,
          company: result.company,
          email: result.email
        }] : [];
      }
      
      // Otherwise search by name
      const response = await axios.post(
        `${this.baseUrl}/objects/contacts/search`,
        {
          query: query,
          limit: 10,
          properties: ['firstname', 'lastname', 'phone', 'mobilephone', 'company', 'email']
        },
        {
          headers: { 'Authorization': `Bearer ${this.apiKey}` },
          timeout: 5000
        }
      );
      
      return response.data.results.map(contact => ({
        id: contact.id,
        name: `${contact.properties.firstname || ''} ${contact.properties.lastname || ''}`.trim() || 'Unknown',
        phone: contact.properties.phone || contact.properties.mobilephone || 'No phone',
        company: contact.properties.company,
        email: contact.properties.email
      }));
    } catch (error) {
      logger.error('HubSpot search failed:', error);
      return [];
    }
  }

  // Clear cache method for testing
  clearCache() {
    this.cache.clear();
  }
}

export const hubspotService = new HubSpotService();
```

### Step 2: Add to OpenPhone Webhook (15 mins)
```typescript
// In openphone.ts webhook handler
import { hubspotService } from '../services/hubspotService';

// When message arrives - wrap in try/catch to never break messaging
router.post('/webhook', async (req, res) => {
  try {
    // ... existing webhook processing ...
    
    // Add HubSpot lookup without breaking flow
    if (data.from && data.direction === 'inbound') {
      try {
        const hubspotContact = await hubspotService.searchByPhone(data.from);
        if (hubspotContact && hubspotContact.name) {
          conversation.customer_name = hubspotContact.name;
          // Optional: Store company info too
          if (hubspotContact.company) {
            conversation.metadata = {
              ...conversation.metadata,
              company: hubspotContact.company
            };
          }
        }
      } catch (hubspotError) {
        // Log but don't fail the webhook
        logger.warn('HubSpot lookup failed during webhook:', hubspotError);
      }
    }
    
    // ... continue with normal processing ...
  } catch (error) {
    // ... existing error handling ...
  }
});
```

### Step 3: Simple Cache Table (10 mins)
```sql
-- Migration 022_simple_hubspot_cache.sql
CREATE TABLE hubspot_cache (
  phone_number VARCHAR(20) PRIMARY KEY,
  customer_name VARCHAR(255),
  company VARCHAR(255),
  email VARCHAR(255),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Auto-expire old entries
CREATE INDEX idx_hubspot_cache_updated ON hubspot_cache(updated_at);
```

### Step 4: Contact Search API (20 mins)
```typescript
// New endpoint: GET /api/contacts/search?q=john
router.get('/contacts/search', authenticate, async (req, res) => {
  const { q } = req.query;
  
  if (!q || q.length < 2) {
    return res.json({ contacts: [] });
  }
  
  const contacts = await hubspotService.searchContacts(q as string);
  res.json({ contacts });
});
```

### Step 5: Update Messages Page (30 mins)
```typescript
// Add to messages.tsx
const [showNewConversation, setShowNewConversation] = useState(false);
const [contactSearch, setContactSearch] = useState('');
const [searchResults, setSearchResults] = useState([]);
const [searchLoading, setSearchLoading] = useState(false);

// Add debounced search function
const searchHubSpotContacts = useCallback(
  debounce(async (query: string) => {
    if (!query || query.length < 2) {
      setSearchResults([]);
      return;
    }
    
    setSearchLoading(true);
    try {
      const response = await axios.get(`/api/contacts/search?q=${encodeURIComponent(query)}`);
      setSearchResults(response.data.contacts || []);
    } catch (error) {
      console.error('Contact search failed:', error);
      toast.error('Unable to search contacts');
    } finally {
      setSearchLoading(false);
    }
  }, 300),
  []
);

// New conversation button (add to header area)
<button 
  onClick={() => setShowNewConversation(true)}
  className="bg-emerald-600 text-white px-4 py-2 rounded-lg flex items-center hover:bg-emerald-700"
>
  <Plus className="w-4 h-4 mr-2" /> New Conversation
</button>

// Simple search modal with better UX
{showNewConversation && (
  <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
    <div className="bg-white rounded-lg p-6 max-w-md w-full">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Start New Conversation</h3>
        <button 
          onClick={() => {
            setShowNewConversation(false);
            setContactSearch('');
            setSearchResults([]);
          }}
          className="text-gray-500 hover:text-gray-700"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
      
      <input
        type="text"
        placeholder="Search by name or phone number..."
        value={contactSearch}
        onChange={(e) => {
          setContactSearch(e.target.value);
          searchHubSpotContacts(e.target.value);
        }}
        className="w-full p-3 border rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        autoFocus
      />
      
      {searchLoading && (
        <div className="text-center py-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600 mx-auto"></div>
        </div>
      )}
      
      <div className="max-h-60 overflow-y-auto">
        {!searchLoading && searchResults.length === 0 && contactSearch.length > 2 && (
          <p className="text-gray-500 text-center py-4">No contacts found</p>
        )}
        
        {searchResults.map(contact => (
          <div
            key={contact.id}
            onClick={() => {
              if (contact.phone && contact.phone !== 'No phone') {
                setSelectedConversation({
                  id: contact.phone,
                  phone_number: contact.phone,
                  customer_name: contact.name,
                  messages: [],
                  unread_count: 0,
                  updated_at: new Date().toISOString()
                });
                setShowNewConversation(false);
                setContactSearch('');
                setSearchResults([]);
                toast.success(`Starting conversation with ${contact.name}`);
              } else {
                toast.error('No phone number available for this contact');
              }
            }}
            className="p-3 hover:bg-gray-50 cursor-pointer border-b last:border-0 transition-colors"
          >
            <div className="font-medium">{contact.name}</div>
            <div className="text-sm text-gray-600">{contact.phone}</div>
            {contact.company && (
              <div className="text-sm text-gray-500">{contact.company}</div>
            )}
            {contact.email && (
              <div className="text-sm text-gray-400">{contact.email}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  </div>
)}

// Add debounce helper if not already imported
function debounce(func: Function, wait: number) {
  let timeout: NodeJS.Timeout;
  return function executedFunction(...args: any[]) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}
```

## Environment Variables
```bash
# Add to Railway
HUBSPOT_API_KEY=your-private-app-key
```

## Total Implementation Time: ~2 hours

## What This Does:
1. ✅ Shows customer names automatically when they text you
2. ✅ Lets you search HubSpot contacts to start new conversations  
3. ✅ Simple caching to reduce API calls
4. ✅ Phone number normalization for reliable matching
5. ✅ Graceful error handling - never breaks messaging
6. ✅ Connection verification on startup
7. ✅ Searches multiple phone fields in HubSpot
8. ✅ Works with both name and phone number searches
9. ✅ 5-second timeout to prevent hanging
10. ✅ Debounced search for better performance

## Important Features Added:
- **Phone Normalization** - Handles (902) 555-1234, 9025551234, +19025551234
- **Error Recovery** - Messages work even if HubSpot is down
- **Rate Limit Protection** - Caches results for 5 minutes
- **Multi-field Search** - Checks phone, mobilephone, work_phone fields
- **Connection Check** - Warns on startup if API key is wrong
- **Null Safety** - Handles missing names/phones gracefully

## What This Doesn't Do (Save for V3):
- ❌ Complex audit trails
- ❌ GDPR compliance features  
- ❌ Encrypted cache
- ❌ Database persistence
- ❌ Feature flags
- ❌ Batch sync of all contacts

## Quick Start:
1. Get HubSpot Private App key (needs `crm.objects.contacts.read` scope)
2. Add `HUBSPOT_API_KEY=pk_xxx` to Railway environment
3. Deploy the code
4. Check logs for "✓ HubSpot connected successfully"
5. Test with a known contact phone number

Simple, effective, and production-ready!