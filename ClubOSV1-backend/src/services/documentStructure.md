# Improved Document Structure

## Option 1: Parent-Child Relationship
```sql
-- Parent document table
CREATE TABLE documents (
  id UUID PRIMARY KEY,
  title TEXT,
  source_file TEXT,
  upload_date TIMESTAMP,
  total_sections INT
);

-- Child sections (current sop_embeddings)
ALTER TABLE sop_embeddings ADD COLUMN parent_document_id UUID;
```

This way:
- Sections are searchable individually
- But you can retrieve the full document context
- "Show me all sections from this document"

## Option 2: Document + Cross-References
```json
{
  "id": "doc-123",
  "title": "7-iron Competitor Analysis",
  "primary_category": "brand",
  "content": "Full document text...",
  "sections": [
    {
      "title": "Technical Specifications",
      "category": "tech",
      "start": 0,
      "end": 500
    },
    {
      "title": "Business Model", 
      "category": "brand",
      "start": 501,
      "end": 1000
    }
  ],
  "cross_references": ["tech", "brand"],
  "entities": ["7-iron", "Nick Wang", "projector specs"]
}
```

## Option 3: Multi-Category Tagging (Recommended)
Instead of forcing one category, allow multiple:

```sql
-- Current: assistant = 'brand'
-- Better: categories = ['brand', 'tech']

ALTER TABLE sop_embeddings 
ADD COLUMN categories TEXT[] DEFAULT ARRAY['general'];

-- Search becomes:
SELECT * FROM sop_embeddings
WHERE 'brand' = ANY(categories)
OR 'tech' = ANY(categories);
```

## Recommendation for Your Case

Keep splitting documents BUT:
1. Add a `parent_document_id` to link related sections
2. Add `related_sections` array to show connections
3. Store `document_context` in metadata

Example:
```json
{
  "title": "7-iron Facility Technical Issues",
  "category": "tech",
  "content": "Their projectors frequently fail...",
  "metadata": {
    "parent_document": "Competitor Analysis 2024",
    "related_sections": ["7-iron Business Model", "7-iron Owner Info"],
    "document_context": "Part of larger competitor analysis",
    "all_categories": ["tech", "brand"]
  }
}
```

This gives you the best of both worlds:
- Fast, category-specific searches
- Ability to see full document context
- Cross-category relationships preserved