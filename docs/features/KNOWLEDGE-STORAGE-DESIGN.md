# Knowledge Management System Design

## Simplified Storage Structure

### Universal Knowledge Schema
```sql
CREATE TABLE knowledge_base (
  id UUID PRIMARY KEY,
  
  -- Core Fields
  category VARCHAR(50) NOT NULL,        -- Type of knowledge
  title VARCHAR(255) NOT NULL,          -- Quick identifier
  content TEXT NOT NULL,                -- The actual knowledge
  
  -- Metadata for Search & Filtering
  tags TEXT[],                          -- ['giftcard', 'purchase', 'customer']
  keywords TEXT[],                      -- Extracted key terms for search
  
  -- Context & Usage
  context VARCHAR(100),                 -- 'customer_facing', 'internal', 'technical'
  priority INTEGER DEFAULT 0,           -- Higher = more important
  
  -- Structured Data (flexible JSON)
  data JSONB,                          -- Store any structured info
  
  -- Tracking
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by UUID,
  usage_count INTEGER DEFAULT 0,
  last_accessed TIMESTAMP
);
```

## Knowledge Categories

### 1. **Procedures** (How-to guides)
```json
{
  "category": "procedure",
  "title": "Reset Frozen Trackman",
  "content": "1. Press Windows key\n2. Type 'cmd'\n3. Run 'trackman-reset.bat'",
  "tags": ["trackman", "reset", "frozen", "technical"],
  "context": "technical",
  "data": {
    "steps": ["Press Windows key", "Type cmd", "Run trackman-reset.bat"],
    "estimated_time": "2 minutes",
    "requires": "operator"
  }
}
```

### 2. **Information** (Facts & Data)
```json
{
  "category": "information",
  "title": "Gift Card Purchase URL",
  "content": "Gift cards can be purchased at https://clubhouse247golf.com/giftcard",
  "tags": ["giftcard", "purchase", "url"],
  "context": "customer_facing",
  "data": {
    "url": "https://clubhouse247golf.com/giftcard",
    "type": "purchase_link"
  }
}
```

### 3. **Specifications** (Technical details)
```json
{
  "category": "specification",
  "title": "Clubhouse Brand Colors",
  "content": "Primary: Clubhouse Green #0B3D3A, Secondary: Clubhouse Grey #503285",
  "tags": ["brand", "colors", "design"],
  "context": "internal",
  "data": {
    "colors": {
      "primary": {"name": "Clubhouse Green", "hex": "#0B3D3A"},
      "secondary": {"name": "Clubhouse Grey", "hex": "#503285"}
    }
  }
}
```

### 4. **Policies** (Rules & Guidelines)
```json
{
  "category": "policy",
  "title": "Customer Escalation Process",
  "content": "For urgent issues: 1. Contact Mike at 902-555-0123...",
  "tags": ["escalation", "emergency", "contact"],
  "context": "internal",
  "priority": 10
}
```

### 5. **FAQs** (Common Q&As)
```json
{
  "category": "faq",
  "title": "Business Hours",
  "content": "We're open Monday-Friday 9am-11pm, Saturday-Sunday 8am-11pm",
  "tags": ["hours", "schedule", "open"],
  "context": "customer_facing"
}
```

## Simplified UI Design

### Main Knowledge Page Layout

```
┌─────────────────────────────────────────────────────────┐
│  Knowledge Management                                    │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  [➕ Add Knowledge]  [📁 Upload File]  [🔍 Search...]   │
│                                                          │
│  Filter: [All ▼] [Procedures] [Info] [Specs] [FAQs]    │
│                                                          │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  📋 Reset Frozen Trackman              [Edit] [Delete]  │
│     Category: Procedure | Tags: trackman, reset         │
│     Last updated: 2 days ago | Used: 45 times          │
│                                                          │
│  ─────────────────────────────────────────────────────  │
│                                                          │
│  💳 Gift Card Purchase URL             [Edit] [Delete]  │
│     Category: Information | Tags: giftcard, purchase    │
│     Last updated: 1 week ago | Used: 127 times         │
│                                                          │
│  ─────────────────────────────────────────────────────  │
│                                                          │
│  🎨 Brand Colors                       [Edit] [Delete]  │
│     Category: Specification | Tags: brand, colors       │
│     Last updated: 1 month ago | Used: 8 times          │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### Add Knowledge Form (Simple)

```
┌─────────────────────────────────────────────────────────┐
│  Add New Knowledge                                       │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Title: [____________________________]                  │
│                                                          │
│  Category: [Select Category ▼]                          │
│    • Procedure (How-to guide)                           │
│    • Information (Facts & URLs)                         │
│    • Specification (Technical details)                  │
│    • Policy (Rules & guidelines)                        │
│    • FAQ (Common questions)                             │
│                                                          │
│  Content:                                                │
│  ┌────────────────────────────────────────────┐        │
│  │                                              │        │
│  │  Type or paste your knowledge here...        │        │
│  │                                              │        │
│  │                                              │        │
│  └────────────────────────────────────────────┘        │
│                                                          │
│  Tags: [giftcard] [purchase] [+ Add tag]                │
│                                                          │
│  Context: ○ Customer Facing  ● Internal  ○ Technical    │
│                                                          │
│  [Cancel]                            [Save Knowledge]    │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

## Smart Features

### 1. Auto-Categorization
When you paste content, the system suggests:
- URLs → Information
- Step-by-step → Procedure
- Technical specs → Specification
- Question format → FAQ

### 2. Auto-Tagging
Automatically extracts tags from content:
- "gift card" → ['giftcard', 'gift', 'card', 'purchase']
- "Trackman reset" → ['trackman', 'reset', 'troubleshooting']

### 3. Smart Search
Searches across:
- Title (highest weight)
- Content (medium weight)
- Tags (medium weight)
- Category (filter)

### 4. Usage Tracking
- Tracks how often each piece is used
- Shows "trending" knowledge
- Suggests archiving unused items

## File Upload Support

### Supported Formats & Processing

#### Markdown (.md)
```markdown
# Gift Card Information
Gift cards available at: https://clubhouse247golf.com/giftcard
```
→ Parses headers as titles, content as knowledge

#### JSON (.json)
```json
{
  "giftcard_url": "https://clubhouse247golf.com/giftcard",
  "trackman_reset": "Press Windows key, type cmd..."
}
```
→ Each key becomes a knowledge entry

#### Text (.txt)
```
Q: How to buy gift cards?
A: Visit https://clubhouse247golf.com/giftcard

Q: What are your hours?
A: Monday-Friday 9am-11pm
```
→ Parses Q&A format automatically

## Benefits of This Design

1. **Flexible**: JSONB data field stores any structure
2. **Searchable**: Multiple ways to find knowledge
3. **Simple**: Easy to add, edit, delete
4. **Scalable**: Can handle thousands of entries
5. **Smart**: Auto-categorizes and tags
6. **Trackable**: See what's used and what's not

## Implementation Priority

1. **Phase 1**: Basic CRUD operations
   - Add, Edit, Delete, List knowledge
   - Simple search

2. **Phase 2**: Smart Features
   - Auto-categorization
   - Auto-tagging
   - Usage tracking

3. **Phase 3**: File Upload
   - Parse .md, .json, .txt
   - Bulk import

4. **Phase 4**: Integration
   - Connect to dashboard AI
   - Connect to automations

This design handles everything from simple URLs to complex procedures while keeping the UI clean and simple.