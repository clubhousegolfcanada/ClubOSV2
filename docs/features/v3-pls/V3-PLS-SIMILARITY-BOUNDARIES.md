# V3-PLS Similarity Boundaries Explained

## How the System Decides What's "Similar Enough"

### The Three-Layer Approach

#### Layer 1: Semantic Embedding (GPT-4o Understanding)
- **Threshold**: 0.75 (75% similarity required)
- **How it works**: Converts text to mathematical vectors that capture meaning
- **Example**: 
  - "trackman frozen" → Vector A
  - "trackman stuck" → Vector B 
  - Similarity: ~0.92 (92% - MATCHES)
  - "TV is off" → Vector C
  - Similarity: ~0.45 (45% - NO MATCH)

#### Layer 2: Context Validation (GPT-4o Reasoning)
Even if semantically similar, GPT-4o validates if the response makes sense:
```
Customer: "the trackman is frozen"
Pattern: "Technical Support - Trackman Reset"
Response: "I can help reset the trackman..."
GPT-4o: ✅ Appropriate - trackman issue matches trackman solution

Customer: "the TV is off" 
Pattern: "Technical Support - Trackman Reset"
Response: "I can help reset the trackman..."
GPT-4o: ❌ Inappropriate - TV issue doesn't match trackman solution
```

#### Layer 3: Pattern Type Categorization
Patterns are grouped by type to prevent cross-contamination:
- `tech_issue` - Equipment problems (trackman, simulator, sensors)
- `display_issue` - Screen/TV problems  
- `access` - Door/entry issues
- `booking` - Reservation problems
- `gift_cards` - Purchase inquiries

## Real-World Examples

### Scenario 1: "Trackman is frozen" variations
These WOULD match the trackman pattern (>75% similarity):
- "trackman frozen" → 95% match
- "trackman stuck" → 93% match
- "screen is frozen" → 82% match (if context suggests trackman screen)
- "simulator not working" → 78% match
- "can't track my shots" → 76% match

### Scenario 2: "TV is off" 
This would NOT match trackman pattern (<75% similarity):
- "TV is off" → 45% match
- "side monitor black" → 52% match
- "television not working" → 48% match

Instead, it would match a different pattern if one exists for TV issues.

### Scenario 3: Edge Cases
What about "the screen is black"?
1. **Semantic Check**: ~68% match to trackman (borderline)
2. **Context Check**: GPT-4o looks at conversation history
   - If previous message mentioned "trackman", likely matches
   - If previous message mentioned "TV", won't match
3. **Keyword Fallback**: If semantic fails, checks keywords
   - Has "screen" keyword? Check pattern type
   - Is it tech_issue type? Consider matching

## Adjustable Boundaries

### Current Settings (in pattern_learning_config):
```sql
semantic_threshold = 0.75      -- Minimum similarity score (0.0-1.0)
similarity_threshold = 0.85    -- For considering patterns "very similar"
auto_execute_threshold = 0.85  -- Confidence needed for auto-response
```

### Business Implications:
- **Lower threshold (0.60)**: More matches, risk of wrong responses
- **Current (0.75)**: Balanced - catches variations, avoids confusion
- **Higher threshold (0.90)**: Very strict, might miss valid variations

## How to Handle Different Equipment

### Best Practice: Create Specific Patterns
Instead of one generic "equipment problem" pattern, create:
1. **Trackman Issues Pattern**
   - Trigger: "trackman not working"
   - Keywords: [trackman, frozen, stuck, shots, tracking]
   - Response: "I can help reset the trackman..."

2. **TV/Display Issues Pattern**  
   - Trigger: "TV not working"
   - Keywords: [TV, television, monitor, display, screen]
   - Response: "I can help with the TV issue..."

3. **Side TV Issues Pattern**
   - Trigger: "side TV is off"
   - Keywords: [side, TV, auxiliary, second, monitor]
   - Response: "I'll check the side TV settings..."

### Pattern Learning Over Time:
1. **Initial**: Operator responds to "TV is off"
2. **System learns**: Creates new pattern for TV issues
3. **Variations come in**: "television black", "monitor dead"
4. **System matches**: 78% similarity to TV pattern (matches!)
5. **Confidence builds**: Each successful use increases confidence
6. **Pattern evolves**: System learns more variations

## The Safety Net

### What prevents wrong matches?
1. **75% threshold**: Must be reasonably similar
2. **GPT-4o validation**: AI checks if response makes sense
3. **Pattern types**: Categories prevent cross-matching
4. **Operator review**: New patterns start inactive
5. **Confidence scoring**: Low confidence = suggest to operator
6. **Conversation context**: Recent messages provide clarity

### Example of Safety in Action:
```
Customer: "I'm trying to watch the game"
Previous message: "The trackman is working fine"
Current: "But the TV is off"

System:
1. Semantic: "TV is off" = 45% match to trackman (NO)
2. Context: Previous messages about watching, not golf
3. Result: Won't match trackman pattern
4. Action: Escalate to operator or match TV pattern if exists
```

## Summary
The system uses **meaning-based understanding** (semantic similarity) combined with **context validation** to determine boundaries. It's not just keyword matching - it understands that "frozen", "stuck", and "not responding" mean similar things, but also knows that "TV" and "trackman" are different equipment requiring different solutions.

The 75% similarity threshold is the "line" you asked about - it's adjustable based on business needs, but currently set to be reasonably flexible while avoiding confusion between different types of issues.