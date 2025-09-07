# V3-PLS (Pattern Learning System) Architecture

## Executive Summary
V3-PLS is ClubOS's unified AI-powered message automation system that learns from operator responses and uses GPT-4o for semantic understanding. It replaces the old hardcoded automation system with intelligent pattern recognition.

## Business Logic

### Why Semantic Search is Default
- **Customer Experience**: Customers express the same issue in many ways
  - "trackman frozen" = "trackman not working" = "trackman stuck" = "screen is black"
- **Operator Efficiency**: One pattern handles all variations automatically
- **Learning System**: GPT-4o understands intent, not just keywords
- **Accuracy**: Reduces false positives from keyword matching

### How It Works
1. **Customer sends message** → "the trackman is frozen"
2. **V3-PLS processes**:
   - Generates embedding using GPT-4o
   - Searches for semantically similar patterns
   - Falls back to keyword matching if needed
3. **Best match found** → "Technical Support" pattern
4. **Response generated** → Uses GPT-4o to adapt response to context
5. **Pattern learns** → Success/failure updates confidence scores

## System Configuration

### Database Tables
- `decision_patterns` - Stores learned patterns and responses
- `pattern_learning_config` - System configuration
- `pattern_execution_history` - Tracks all pattern uses
- `message_embeddings` - Caches embeddings for performance

### Key Settings (pattern_learning_config)
```sql
semantic_search_default = true      -- All new patterns use GPT-4o
semantic_threshold = 0.75           -- 75% similarity required
prefer_semantic_over_keyword = true -- AI understanding > exact match
auto_generate_embeddings = true     -- Create embeddings automatically
learn_variations = true             -- Learn from successful uses
```

## Migration from Old System

### What Was Wrong
- **Two competing systems**:
  1. Old: Hardcoded regex patterns in `aiAutomationService.ts`
  2. New: V3-PLS with learned patterns
- **Conflicts**: Both systems processed messages, sending duplicate/wrong responses
- **No semantic understanding**: Required exact keyword matches

### What We Fixed
1. ✅ Disabled all old AI automation features
2. ✅ Enabled semantic search for all patterns
3. ✅ Set semantic search as default for new patterns
4. ✅ Removed hardcoded fallback responses
5. ✅ Unified to single V3-PLS system

## Pattern Examples

### Gift Cards
- **Learned from**: "Do you sell gift cards?"
- **Also matches**: 
  - "gift card purchase"
  - "where can I buy a gift certificate"
  - "present for my friend"
  - "birthday gift options"

### Trackman Issues
- **Learned from**: "The trackman is not working"
- **Also matches**:
  - "trackman frozen"
  - "screen is black"
  - "simulator stuck"
  - "not tracking my shots"

## Benefits

### For Customers
- Natural language understanding
- Faster responses
- More accurate help
- Consistent service quality

### For Operators
- Less repetitive work
- System learns from their responses
- Handles variations automatically
- Focus on complex issues

### For Business
- Reduced response time
- Higher customer satisfaction
- Scalable support
- Data-driven improvements

## Safety Controls
- Blacklisted topics prevent inappropriate auto-responses
- Escalation keywords trigger operator alerts
- New patterns require approval threshold
- Operator corrections have 2x weight

## Future Enhancements
1. Multi-language support
2. Voice message understanding
3. Image-based issue detection
4. Predictive pattern suggestions
5. Cross-location pattern sharing

## Technical Notes
- Uses OpenAI text-embedding-3-small model
- Embeddings cached for performance
- Cosine similarity for matching
- GPT-4o for response generation
- Real-time learning from operator feedback

## Monitoring
- Pattern success rates tracked
- Confidence scores evolve based on usage
- Failed patterns logged for review
- Operator overrides prioritized in learning