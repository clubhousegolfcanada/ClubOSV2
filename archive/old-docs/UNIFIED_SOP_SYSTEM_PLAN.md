# ClubOS V1: Unified SOP System - OpenPhone to Assistant Replacement

## Overview
Replace OpenAI Assistants ($900/month) with a simple flow:
1. **Capture**: OpenPhone → PostgreSQL (all conversations)
2. **Extract**: Button click → Claude analyzes → Extracts knowledge
3. **Organize**: Knowledge → Category-specific .md files
4. **Deploy**: Intelligent SOP Module uses .md files instead of Assistants

## Complete Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     DATA COLLECTION                         │
├─────────────────────────────────────────────────────────────┤
│  OpenPhone Webhook → PostgreSQL (openphone_conversations)   │
│  Slack Threads     → PostgreSQL (slack_resolutions)         │
│  Ticket System     → PostgreSQL (tickets)                   │
└─────────────────┬──────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────────────────────────┐
│                  KNOWLEDGE EXTRACTION                       │
├─────────────────────────────────────────────────────────────┤
│  Admin clicks "Extract Knowledge" → Claude analyzes         │
│  Groups by category (booking, emergency, tech, brand)       │
│  Shows in review table with confidence scores               │
└─────────────────┬──────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────────────────────────┐
│                    SOP MANAGEMENT                           │
├─────────────────────────────────────────────────────────────┤
│  Admin selects items → Updates .md files:                   │
│  • /sops/booking/access_issues.md                          │
│  • /sops/emergency/fire_procedures.md                      │
│  • /sops/tech/trackman_troubleshooting.md                  │
│  • /sops/brand/membership_inquiries.md                     │
└─────────────────┬──────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────────────────────────┐
│              INTELLIGENT SOP MODULE                         │
├─────────────────────────────────────────────────────────────┤
│  1. Query comes in → Embeddings → Semantic search          │
│  2. Find relevant .md files → Context injection            │
│  3. GPT-4o generates response using SOPs                   │
│  4. No more Assistant API calls!                           │
└─────────────────────────────────────────────────────────────┘
```

## File Structure

```
/ClubOSV1/
├── sops/                    # All knowledge lives here
│   ├── booking/
│   │   ├── system_instructions.md
│   │   ├── access_issues.md
│   │   ├── booking_modifications.md
│   │   └── refund_policies.md
│   ├── emergency/
│   │   ├── system_instructions.md
│   │   ├── fire_procedures.md
│   │   ├── medical_emergencies.md
│   │   └── evacuation_protocols.md
│   ├── tech/
│   │   ├── system_instructions.md
│   │   ├── trackman_troubleshooting.md
│   │   ├── simulator_issues.md
│   │   └── network_problems.md
│   └── brand/
│       ├── system_instructions.md
│       ├── membership_benefits.md
│       └── promotional_templates.md
```

## Database Schema (Simplified)

```sql
-- Just two main tables for knowledge management

-- All OpenPhone conversations
CREATE TABLE openphone_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number VARCHAR(20),
  messages JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  processed BOOLEAN DEFAULT FALSE
);

-- Extracted knowledge ready for SOPs
CREATE TABLE extracted_knowledge (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID,
  source_type VARCHAR(20), -- 'openphone', 'slack', 'ticket'
  category VARCHAR(50),    -- 'booking', 'emergency', 'tech', 'brand'
  problem TEXT NOT NULL,
  solution TEXT NOT NULL,
  confidence FLOAT,
  applied_to_sop BOOLEAN DEFAULT FALSE,
  sop_file VARCHAR(255),   -- Which .md file it was added to
  created_at TIMESTAMP DEFAULT NOW()
);
```

## Integration Flow

### Step 1: OpenPhone Webhook (Already in OPENPHONE_SIMPLE_INTEGRATION.md)
```typescript
// Receives all conversations and stores them
POST /api/openphone/webhook
```

### Step 2: Knowledge Extraction UI
```typescript
// Admin dashboard shows:
[Extract Knowledge from 456 Conversations]

// Click button → Claude analyzes → Shows results:
┌─────────────────────────────────────────────────────────┐
│ ☑️ Booking  | Door won't open     | Use code #7823#   │
│ ☑️ Tech     | TrackMan frozen     | Press F8 to reset │
│ ☐ Brand    | Hours question      | Open 6am-11pm     │
│ [Apply Selected to SOPs]                                │
└─────────────────────────────────────────────────────────┘
```

### Step 3: SOP File Updates
```typescript
// When admin clicks "Apply Selected"
async function applyToSOPs(selectedItems: string[]) {
  const knowledge = await getSelectedKnowledge(selectedItems);
  
  // Group by category
  const grouped = groupBy(knowledge, 'category');
  
  for (const [category, items] of Object.entries(grouped)) {
    // Read existing .md file
    const sopPath = `/sops/${category}/${determineSopFile(items)}`;
    const currentContent = await fs.readFile(sopPath, 'utf-8');
    
    // Add new knowledge
    const updatedContent = addKnowledgeToSOP(currentContent, items);
    
    // Save updated file
    await fs.writeFile(sopPath, updatedContent);
    
    // Re-embed for intelligent search
    await intelligentSOPModule.refreshDocument(sopPath);
  }
  
  // Mark as applied
  await markKnowledgeApplied(selectedItems);
}
```

### Step 4: Intelligent SOP Module Uses .md Files
```typescript
// In assistantService.ts
async getAssistantResponse(route: string, query: string) {
  // Use intelligent SOP module instead of OpenAI Assistant
  const sopResponse = await intelligentSOPModule.processWithContext(
    query,
    route,
    context
  );
  
  if (sopResponse.confidence > 0.75) {
    return sopResponse; // Uses .md files, not Assistant API
  }
  
  // Fallback to GPT-4 direct (not Assistant)
  return directGPT4Response(query);
}
```

## Example .md File Structure

```markdown
# Access Control Troubleshooting
Keywords: door, unlock, card, access, entry, locked out

## Card Reader Issues

### Problem: Card won't unlock door
**Solution**: 
1. Hold card flat against reader for 3 seconds
2. Ensure card is facing correct direction (logo up)
3. If still not working, use backup keypad code: #7823#
4. For lost cards, create temporary access via admin portal

*Source: OpenPhone conversation 2024-03-15*

### Problem: Card reader showing red light
**Solution**:
1. Red light indicates low battery in reader
2. Use keypad backup immediately
3. Report to maintenance for battery replacement
4. Expected fix time: 2-4 hours

*Source: Ticket #1234 resolution*
```

## Benefits of This Approach

1. **Simple**: OpenPhone → Database → Review → Apply
2. **Transparent**: See exactly what knowledge is being added
3. **Cost Effective**: No Assistant API calls ($900/month saved)
4. **Maintainable**: All knowledge in .md files (Git trackable)
5. **Flexible**: Claude can edit .md files directly
6. **Intelligent**: Semantic search finds relevant content

## Migration Timeline

### Week 1: Setup
- Deploy OpenPhone webhook
- Create database tables
- Build extraction UI

### Week 2: Knowledge Collection
- Collect OpenPhone data
- Run initial extraction
- Review quality

### Week 3: SOP Population
- Apply knowledge to .md files
- Test intelligent SOP module
- Compare to Assistant responses

### Week 4: Cutover
- Disable OpenAI Assistants
- Monitor performance
- Celebrate $900/month savings!

## Cost Comparison

### Before (OpenAI Assistants)
- Assistant API: ~$0.03 per message
- 1000 messages/day = $30/day = $900/month

### After (Intelligent SOPs)
- Embeddings: $10 one-time
- GPT-4o: ~$0.005 per message  
- 1000 messages/day = $5/day = $150/month
- **Savings: $750/month (83%)**

## Summary

This unified approach:
1. Collects all knowledge from OpenPhone/Slack/Tickets
2. Lets you review and apply updates with a button click
3. Stores everything in .md files (not a complex database)
4. Uses the same files for the intelligent SOP module
5. Completely replaces OpenAI Assistants

Simple, transparent, and cost-effective!
