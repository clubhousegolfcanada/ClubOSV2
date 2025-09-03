# Pattern Learning System (V3-PLS) Guide

## 🧠 Overview

The Pattern Learning System (V3-PLS) is an advanced AI-powered message automation system that uses GPT-4o for adaptive, context-aware customer service responses. Unlike traditional chatbots that rely on rigid templates, this system reasons through each interaction and adapts responses based on conversation history and context.

## ✨ Key Features

### GPT-4o Reasoning Engine
- **Adaptive Responses**: Every response is uniquely crafted for the specific situation
- **Context Awareness**: Analyzes conversation history to provide relevant responses
- **Multi-Step Planning**: Can plan complex resolutions across multiple interactions
- **Transparent Reasoning**: Provides explanations for every decision

### Pattern Learning
- **60+ Pre-trained Patterns**: Ready-to-use patterns for common scenarios
- **Semantic Search**: Uses OpenAI embeddings to find similar patterns
- **Confidence Evolution**: Patterns improve over time based on success/failure
- **Learning from Humans**: Creates new patterns from operator interactions

## 🚀 Current Status

- **System**: ✅ ENABLED
- **Mode**: 🔴 LIVE (Not Shadow Mode)
- **Patterns**: 60 active patterns
- **Average Confidence**: 77.7%
- **Thresholds**:
  - Auto-execute: 85% confidence (lowered from 95%)
  - Suggest: 60% confidence (lowered from 70%)
  - Queue: 40% confidence

## 📊 How It Works

### Message Flow

1. **Customer sends message** → OpenPhone webhook receives it
2. **Pattern matching** → System searches for similar patterns using:
   - Semantic search (OpenAI embeddings)
   - Keyword matching (fallback)
3. **GPT-4o reasoning** → Analyzes context and adapts response
4. **Decision making**:
   - **85%+ confidence** → Auto-execute (if pattern marked auto-executable)
   - **60-85% confidence** → Suggest to operator
   - **40-60% confidence** → Queue for review
   - **<40% confidence** → Escalate to human

### Pattern Types

- `booking` - Reservation and scheduling requests
- `tech_issue` - Technical problems (Trackman, screens, etc.)
- `access` - Door/entry issues
- `faq` - Frequently asked questions
- `gift_cards` - Gift card inquiries
- `hours` - Operating hours questions

## 🛠️ Administration

### Testing a Pattern

1. Go to Operations → Patterns in the UI
2. Click Configuration tab
3. Enter a test message in the text area
4. Click "Test with GPT-4o Reasoning"
5. Review the reasoning and response

### Adjusting Confidence Thresholds

```sql
-- Lower auto-execute threshold (currently 85%)
UPDATE pattern_learning_config 
SET config_value = '0.80' 
WHERE config_key = 'min_confidence_to_act';

-- Lower suggestion threshold (currently 60%)
UPDATE pattern_learning_config 
SET config_value = '0.50' 
WHERE config_key = 'min_confidence_to_suggest';
```

### Enabling/Disabling Features

```sql
-- Enable/disable the entire system
UPDATE pattern_learning_config 
SET config_value = 'true' -- or 'false'
WHERE config_key = 'enabled';

-- Enable/disable shadow mode (logging only)
UPDATE pattern_learning_config 
SET config_value = 'true' -- or 'false'
WHERE config_key = 'shadow_mode';
```

### Marking Patterns as Auto-Executable

```sql
-- Make high-confidence patterns auto-executable
UPDATE decision_patterns 
SET auto_executable = TRUE 
WHERE confidence_score >= 0.85 
  AND execution_count >= 5
  AND pattern_type IN ('faq', 'hours');
```

## 🎯 Best Practices

### Pattern Creation
1. Patterns learn from operator responses automatically
2. After 3+ similar responses, a pattern is created
3. Patterns start at 50-70% confidence
4. Confidence increases with successful executions

### Monitoring
- Check execution history regularly in UI
- Review GPT-4o reasoning for accuracy
- Monitor confidence evolution
- Approve/reject suggested patterns

### Safety
- System has multiple safety checks:
  - No patterns are currently auto-executable
  - High confidence thresholds
  - Human approval required
  - All actions logged

## 📈 Performance Metrics

- **Total Patterns**: 60
- **Average Confidence**: 77.7%
- **Patterns with Embeddings**: 55 (semantic search enabled)
- **High Confidence Patterns**: 15+ (ready for automation)

## 🔧 Technical Details

### Database Tables
- `decision_patterns` - Stores all patterns
- `pattern_execution_history` - Logs all executions
- `pattern_learning_config` - System configuration
- `conversation_messages` - Stores conversation history
- `pattern_suggestions_queue` - Pending suggestions

### API Endpoints
- `GET /api/patterns` - List all patterns
- `GET /api/patterns/stats` - System statistics
- `GET /api/patterns/config` - Configuration
- `POST /api/patterns/test` - Test a message
- `PUT /api/patterns/config` - Update configuration

### Key Services
- `patternLearningService.ts` - Core pattern matching and GPT-4o reasoning
- `openphone.ts` - Webhook integration
- `patterns.ts` - API routes

## 🚨 Troubleshooting

### Patterns Not Matching
- Check if system is enabled
- Verify pattern is active
- Lower confidence thresholds
- Check embeddings are generated

### No Auto-Execution
- Verify shadow mode is OFF
- Check pattern is marked auto_executable
- Ensure confidence >= 85%
- Verify OpenPhone integration

### GPT-4o Not Working
- Ensure OPENAI_API_KEY is set
- Check API rate limits
- Verify network connectivity
- Review error logs

## 📞 Support

For issues or questions:
- Check logs in Railway dashboard
- Review execution history in UI
- Contact development team

---

**Last Updated**: 2025-09-03
**Version**: 1.0.0 with GPT-4o Enhancement