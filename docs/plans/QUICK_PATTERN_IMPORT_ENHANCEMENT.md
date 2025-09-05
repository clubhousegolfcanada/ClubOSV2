# Quick Pattern Import Enhancement
## Reuse Existing CSV Interface with Toggle

## The Simpler Solution

Instead of building a new "Pattern Terminal", just add a toggle to the existing CSV import interface to switch between:
1. **OpenPhone CSV** (current)
2. **Q&A Pairs** (new)

## Implementation (30 minutes)

### 1. Frontend Changes

#### Modify `OperationsPatternsEnhanced.tsx` (lines ~790-810)

```tsx
// Add state for import type
const [importType, setImportType] = useState<'csv' | 'qa'>('csv');

// Replace the import section with:
<div className="space-y-4">
  {/* Toggle Buttons */}
  <div className="flex space-x-2 mb-4">
    <button
      onClick={() => setImportType('csv')}
      className={`px-4 py-2 rounded ${
        importType === 'csv' 
          ? 'bg-primary text-white' 
          : 'bg-gray-200 text-gray-700'
      }`}
    >
      📞 OpenPhone CSV
    </button>
    <button
      onClick={() => setImportType('qa')}
      className={`px-4 py-2 rounded ${
        importType === 'qa' 
          ? 'bg-primary text-white' 
          : 'bg-gray-200 text-gray-700'
      }`}
    >
      💬 Q&A Pairs
    </button>
  </div>

  <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
    <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
    <p className="text-gray-600 mb-2">
      {importType === 'csv' 
        ? 'Paste your OpenPhone CSV data here'
        : 'Paste Q&A pairs or natural language patterns'}
    </p>
    
    <textarea
      id="import-data"
      placeholder={
        importType === 'csv'
          ? "id,conversationId,body,sentAt,to,from,direction,createdAt"
          : `Examples:
          
Q: What are your hours?
A: We're open Monday-Friday 9am-9pm, weekends 8am-10pm

When someone asks about gift cards, tell them to visit website.com/giftcards

If TrackMan isn't working, try restarting bay {{bay_number}} first`
      }
      className="w-full h-64 p-4 border border-gray-300 rounded-lg font-mono text-sm"
    />
    
    <p className="text-xs text-gray-500 mt-2">
      {importType === 'csv'
        ? 'Export your OpenPhone conversations as CSV and paste here'
        : 'Each Q&A pair or pattern on separate lines'}
    </p>
  </div>
  
  <button 
    onClick={() => handleImport(importType)}
    className="w-full py-2 bg-primary text-white rounded hover:bg-primary-dark"
  >
    Import {importType === 'csv' ? 'CSV' : 'Patterns'}
  </button>
</div>
```

### 2. Backend Changes

#### Modify the import endpoint in `routes/patterns.ts`

```typescript
router.post('/import', async (req, res) => {
  const { data, type } = req.body; // type: 'csv' | 'qa'
  
  if (type === 'csv') {
    // Existing CSV import logic
    return csvImportService.processCSV(data);
  } else {
    // New Q&A import logic
    return processQAPairs(data);
  }
});

async function processQAPairs(text: string) {
  // Use GPT-4o to parse the text
  const prompt = `
    Extract customer service patterns from this text.
    It may contain:
    1. Q&A pairs (Q: question A: answer format)
    2. Natural language rules ("When X, do Y")
    3. Simple statements ("Our hours are 9-5")
    
    For each pattern found, extract:
    - trigger: what the customer might ask
    - response: how to respond
    - type: category (hours/booking/tech/general)
    - confidence: 0.6-0.8 for manual entries
    
    Text to parse:
    ${text}
    
    Return as JSON array of patterns.
  `;
  
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' }
  });
  
  const patterns = JSON.parse(completion.choices[0].message.content).patterns;
  
  // Save each pattern
  const results = {
    created: 0,
    updated: 0,
    failed: 0
  };
  
  for (const pattern of patterns) {
    try {
      // Check for duplicates using existing similarity check
      const existing = await checkSimilarPatterns(pattern.trigger);
      
      if (existing.length === 0) {
        // Create new pattern with embedding
        const embedding = await generateEmbedding(pattern.trigger);
        await db.query(`
          INSERT INTO decision_patterns (
            pattern_type, trigger_text, response_template, 
            confidence_score, embedding, semantic_search_enabled
          ) VALUES ($1, $2, $3, $4, $5, true)
        `, [pattern.type, pattern.trigger, pattern.response, pattern.confidence, embedding]);
        results.created++;
      } else {
        // Update existing if better
        results.updated++;
      }
    } catch (error) {
      results.failed++;
    }
  }
  
  return results;
}
```

### 3. Even Simpler: Just Parse Different Formats

Actually, we can make it even simpler by just detecting the format automatically:

```typescript
router.post('/import', async (req, res) => {
  const { data } = req.body;
  
  // Auto-detect format
  const isCSV = data.includes(',') && data.includes('conversationId');
  const isQA = data.includes('Q:') || data.includes('A:');
  const isNatural = !isCSV && !isQA;
  
  let patterns = [];
  
  if (isCSV) {
    // Existing CSV logic
    patterns = await csvImportService.processCSV(data);
  } else {
    // Parse as Q&A or natural language
    const prompt = `
      This text contains customer service information.
      Extract ALL patterns you can find.
      
      Text: ${data}
      
      Return JSON array with: trigger, response, type, confidence
    `;
    
    const result = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' }
    });
    
    patterns = JSON.parse(result.choices[0].message.content).patterns;
  }
  
  // Process patterns (same for both)
  return processPatterns(patterns);
});
```

## Examples of What You Could Import

### Q&A Format
```
Q: What are your hours?
A: Monday-Friday 9am-9pm, weekends 8am-10pm

Q: How do I book a bay?
A: Visit clubhouse247golf.com or call 902-555-0123

Q: My TrackMan isn't working
A: Try restarting the bay first. If that doesn't work, we'll send someone over.
```

### Natural Language Format
```
When someone asks about hours, tell them we're open 9-5 Monday to Friday

If a customer needs a refund, check if it's within 24 hours first

Gift cards are available at website.com/giftcards

For TrackMan issues, restart the bay first then call tech support
```

### Mixed Format (GPT-4o handles it all)
```
Hours: 9am-9pm weekdays

Q: Do you have gift cards?
A: Yes, at website.com/giftcards

Tell people with booking issues to check their email first

Membership questions -> check their account status -> offer upgrade
```

## Benefits of This Approach

1. **No New UI** - Reuses existing interface
2. **Familiar** - Users already know this screen
3. **Flexible** - Accepts any text format
4. **Smart** - GPT-4o figures out the format
5. **Fast** - 30 minutes to implement

## Super Quick Implementation

Just modify the existing import handler:

```typescript
// In your existing CSV import endpoint
if (data.includes('Q:') || data.includes('A:') || !data.includes('conversationId')) {
  // It's Q&A or natural language
  const patterns = await gpt4o.extractPatterns(data);
  return processPatterns(patterns);
} else {
  // It's CSV
  return existingCSVLogic(data);
}
```

That's it! The same textarea, same button, just smarter parsing.

## Visual Mock-up

```
┌─────────────────────────────────────────┐
│ Import Tab                               │
├─────────────────────────────────────────┤
│ [📞 OpenPhone CSV] [💬 Q&A Pairs]        │
│                                          │
│ ┌──────────────────────────────────────┐│
│ │ Q: What are your hours?              ││
│ │ A: We're open 9am-9pm weekdays      ││
│ │                                      ││
│ │ Q: How do I book?                    ││
│ │ A: Visit our website or call us      ││
│ │                                      ││
│ │ When someone asks about refunds,     ││
│ │ check their booking time first       ││
│ └──────────────────────────────────────┘│
│                                          │
│         [Import Patterns]                │
└─────────────────────────────────────────┘
```

## Next Steps

1. **Test Current CSV Import** - Make sure it works
2. **Add Format Detection** - 10 lines of code
3. **Add GPT-4o Parser** - 20 lines of code
4. **Test with Real Data** - Try different formats
5. **Ship It** - No UI changes needed!

This is WAY simpler than building a new Pattern Terminal. Just make the existing import smarter!