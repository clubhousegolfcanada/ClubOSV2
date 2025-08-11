# Ultra-Flexible Knowledge Storage System

## Document-Store Style Design (Like Winston/MongoDB)

### Single Table, Infinite Flexibility

```sql
CREATE TABLE knowledge_store (
  -- Minimal required fields
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(255) UNIQUE NOT NULL,  -- Unique identifier/path
  value JSONB NOT NULL,               -- EVERYTHING goes here
  metadata JSONB DEFAULT '{}',        -- System metadata
  
  -- Indexing & search
  search_vector tsvector GENERATED ALWAYS AS (
    to_tsvector('english', 
      coalesce(value->>'title', '') || ' ' ||
      coalesce(value->>'content', '') || ' ' ||
      coalesce(value->>'text', '') || ' ' ||
      coalesce(value::text, '')
    )
  ) STORED,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for fast searching
CREATE INDEX idx_knowledge_search ON knowledge_store USING GIN(search_vector);
CREATE INDEX idx_knowledge_value ON knowledge_store USING GIN(value);
CREATE INDEX idx_knowledge_metadata ON knowledge_store USING GIN(metadata);
CREATE INDEX idx_knowledge_key ON knowledge_store(key);
```

## Store ANYTHING

### Example 1: Simple Key-Value
```javascript
// Store
await store.set('gift-card-url', 'https://clubhouse247golf.com/giftcard');

// Retrieve
const url = await store.get('gift-card-url');
// Returns: "https://clubhouse247golf.com/giftcard"
```

### Example 2: Complex Procedure
```javascript
await store.set('procedures.trackman.reset', {
  title: 'Reset Frozen Trackman',
  type: 'procedure',
  priority: 'high',
  steps: [
    { action: 'Press Windows key', duration: '1s' },
    { action: 'Type cmd', duration: '2s' },
    { action: 'Run trackman-reset.bat', duration: '30s' }
  ],
  requirements: {
    role: 'operator',
    tools: ['keyboard', 'admin access']
  },
  troubleshooting: {
    'still_frozen': 'Try power cycling the unit',
    'no_cmd_access': 'Contact IT for admin rights'
  },
  metadata: {
    author: 'Mike',
    verified: true,
    usage_count: 45,
    success_rate: 0.92
  }
});
```

### Example 3: Nested Company Info
```javascript
await store.set('company', {
  brand: {
    colors: {
      primary: { name: 'Clubhouse Green', hex: '#0B3D3A', rgb: [11, 61, 58] },
      secondary: { name: 'Clubhouse Grey', hex: '#503285', rgb: [80, 50, 133] }
    },
    fonts: {
      heading: 'Montserrat',
      body: 'Open Sans'
    },
    logos: {
      main: 'https://cdn.example.com/logo.svg',
      icon: 'https://cdn.example.com/icon.png'
    }
  },
  locations: {
    bedford: {
      address: '123 Main St',
      phone: '902-555-0001',
      hours: { mon: '9-11', tue: '9-11' },
      bays: 4,
      equipment: {
        simulators: ['Trackman Bay 1', 'Trackman Bay 2'],
        other: ['Pool table', 'Dart board']
      }
    },
    dartmouth: {
      address: '456 Water St',
      phone: '902-555-0002',
      hours: { mon: '9-11', tue: '9-11' },
      bays: 3
    }
  },
  contacts: {
    emergency: {
      primary: { name: 'Mike', phone: '902-555-9999' },
      secondary: { name: 'John', phone: '902-555-8888' }
    }
  }
});
```

### Example 4: Dynamic FAQ Storage
```javascript
// Store FAQs with any structure
await store.set('faq.hours', {
  question: 'What are your hours?',
  answer: 'Monday-Friday 9am-11pm, Saturday-Sunday 8am-11pm',
  variations: [
    'When are you open?',
    'What time do you close?',
    'Are you open now?'
  ],
  context: ['customer', 'public'],
  followup_questions: [
    { q: 'Can I book after hours?', a: 'Special events only' }
  ]
});
```

## Winston-Style API

```typescript
class KnowledgeStore {
  // Set any value with dot notation
  async set(key: string, value: any, metadata?: any): Promise<void> {
    const sql = `
      INSERT INTO knowledge_store (key, value, metadata)
      VALUES ($1, $2, $3)
      ON CONFLICT (key) 
      DO UPDATE SET 
        value = $2,
        metadata = $3,
        updated_at = NOW()
    `;
    await query(sql, [key, JSON.stringify(value), JSON.stringify(metadata || {})]);
  }

  // Get by key (supports dot notation)
  async get(key: string): Promise<any> {
    // Exact match
    let sql = `SELECT value FROM knowledge_store WHERE key = $1`;
    let result = await query(sql, [key]);
    
    if (result.rows.length > 0) {
      return result.rows[0].value;
    }
    
    // Pattern match for nested keys
    sql = `SELECT key, value FROM knowledge_store WHERE key LIKE $1`;
    result = await query(sql, [key + '.%']);
    
    if (result.rows.length > 0) {
      // Build nested object
      const nested = {};
      for (const row of result.rows) {
        const subKey = row.key.replace(key + '.', '');
        this.setNested(nested, subKey, row.value);
      }
      return nested;
    }
    
    return null;
  }

  // Search anything
  async search(query: string, options?: any): Promise<any[]> {
    const sql = `
      SELECT key, value, 
        ts_rank(search_vector, plainto_tsquery('english', $1)) as rank
      FROM knowledge_store
      WHERE search_vector @@ plainto_tsquery('english', $1)
        OR value::text ILIKE $2
      ORDER BY rank DESC
      LIMIT $3
    `;
    
    const result = await query(sql, [
      query,
      `%${query}%`,
      options?.limit || 10
    ]);
    
    return result.rows.map(r => ({
      key: r.key,
      value: r.value,
      relevance: r.rank
    }));
  }

  // Query with MongoDB-style queries
  async find(query: any): Promise<any[]> {
    let sql = `SELECT key, value FROM knowledge_store WHERE `;
    const conditions = [];
    const params = [];
    let paramCount = 1;
    
    // Build WHERE clause from query object
    for (const [field, condition] of Object.entries(query)) {
      if (typeof condition === 'object' && condition !== null) {
        // Handle operators like $gt, $contains, etc
        for (const [op, val] of Object.entries(condition as any)) {
          switch(op) {
            case '$contains':
              conditions.push(`value->'${field}' ? $${paramCount}`);
              params.push(val);
              paramCount++;
              break;
            case '$gt':
              conditions.push(`(value->'${field}')::numeric > $${paramCount}`);
              params.push(val);
              paramCount++;
              break;
            // Add more operators as needed
          }
        }
      } else {
        // Exact match
        conditions.push(`value->>'${field}' = $${paramCount}`);
        params.push(condition);
        paramCount++;
      }
    }
    
    sql += conditions.join(' AND ');
    const result = await query(sql, params);
    return result.rows.map(r => ({ key: r.key, ...r.value }));
  }

  // Delete by key or pattern
  async delete(pattern: string): Promise<number> {
    const sql = `
      DELETE FROM knowledge_store 
      WHERE key = $1 OR key LIKE $2
      RETURNING key
    `;
    const result = await query(sql, [pattern, pattern + '.%']);
    return result.rowCount;
  }

  // List all keys (with optional prefix)
  async keys(prefix?: string): Promise<string[]> {
    const sql = prefix
      ? `SELECT key FROM knowledge_store WHERE key LIKE $1 ORDER BY key`
      : `SELECT key FROM knowledge_store ORDER BY key`;
    
    const result = await query(sql, prefix ? [prefix + '%'] : []);
    return result.rows.map(r => r.key);
  }

  // Get all as object (like Redis HGETALL)
  async getAll(): Promise<Record<string, any>> {
    const sql = `SELECT key, value FROM knowledge_store`;
    const result = await query(sql);
    
    const obj = {};
    for (const row of result.rows) {
      obj[row.key] = row.value;
    }
    return obj;
  }

  // Helper to set nested values
  private setNested(obj: any, path: string, value: any) {
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
}
```

## Usage Examples

### Store Anything
```javascript
const store = new KnowledgeStore();

// Simple values
await store.set('giftcard.url', 'https://clubhouse247golf.com/giftcard');
await store.set('hours.monday', '9am-11pm');
await store.set('emergency.contact', '902-555-9999');

// Complex objects
await store.set('procedures.trackman', {
  reset: { steps: [...], time: '2min' },
  troubleshoot: { steps: [...], time: '10min' },
  maintenance: { schedule: 'weekly', steps: [...] }
});

// Arrays
await store.set('team.members', [
  { name: 'Mike', role: 'Owner', phone: '902-555-0001' },
  { name: 'John', role: 'Manager', phone: '902-555-0002' }
]);

// Nested paths
await store.set('locations.bedford.bay1.status', 'operational');
await store.set('locations.bedford.bay1.lastMaintenance', new Date());
```

### Retrieve Anything
```javascript
// Get specific value
const url = await store.get('giftcard.url');

// Get nested object
const bedford = await store.get('locations.bedford');
// Returns entire bedford object with all nested data

// Search anything
const results = await store.search('trackman frozen');
// Searches across ALL stored content

// Query with conditions
const procedures = await store.find({ 
  type: 'procedure',
  priority: 'high' 
});
```

## Benefits

1. **Infinitely Flexible**: Store any structure without schema changes
2. **Fast Search**: Full-text search across everything
3. **Nested Support**: Dot notation for deep structures
4. **No Migrations**: Add new fields anytime
5. **JSON Native**: Perfect for JavaScript/TypeScript
6. **Pattern Matching**: Get related keys easily
7. **Winston-like**: Familiar API for developers

## Simple UI for This

```
Knowledge Store

[➕ Add Entry]  [📁 Import JSON]  [🔍 Search...]

Quick Add:
Key: [procedures.giftcard.purchase]
Value: 
[Can be text, JSON, number, anything:
{
  "url": "https://clubhouse247golf.com/giftcard",
  "instructions": "Click buy now button",
  "price_options": [25, 50, 100, 200]
}
]
[Save]

Recent Entries:
• giftcard.url → "https://clubhouse247golf.com/giftcard"
• procedures.trackman.reset → {object with 5 fields}
• company.brand.colors → {primary: {...}, secondary: {...}}
• faq.hours → {question: "...", answer: "...", variations: [...]}
```

This gives you MongoDB-like flexibility with PostgreSQL reliability!