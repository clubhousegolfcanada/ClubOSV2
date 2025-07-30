# ClubOS V1: SOP Module Implementation - Claude CLI Task List

## Overview
Systematic process to replace OpenAI Assistants with local SOP module WITHOUT breaking current production system.

## Phase 1: Foundation (No Breaking Changes)
**Goal**: Set up parallel infrastructure without touching current Assistant flow

### 1.1 Database Setup
```bash
# Create new tables for OpenPhone integration
cd ClubOSV1-backend
```

**TODO 1**: Create migration file
```sql
-- File: src/database/migrations/011_openphone_sop_system.sql
CREATE TABLE IF NOT EXISTS openphone_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number VARCHAR(20),
  customer_name VARCHAR(255),
  employee_name VARCHAR(255),
  messages JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  processed BOOLEAN DEFAULT FALSE,
  metadata JSONB DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS extracted_knowledge (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID,
  source_type VARCHAR(20),
  category VARCHAR(50),
  problem TEXT NOT NULL,
  solution TEXT NOT NULL,
  confidence FLOAT,
  applied_to_sop BOOLEAN DEFAULT FALSE,
  sop_file VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_openphone_conversations_processed ON openphone_conversations(processed);
CREATE INDEX idx_extracted_knowledge_category ON extracted_knowledge(category);
CREATE INDEX idx_extracted_knowledge_applied ON extracted_knowledge(applied_to_sop);
```

### 1.2 Create SOP Directory Structure
```bash
# Create SOP file structure
mkdir -p sops/{booking,emergency,tech,brand}
```

**TODO 2**: Copy existing assistant instructions to SOPs
```bash
# Copy from assistant-instructions/ to sops/
cp assistant-instructions/booking-assistant.md sops/booking/system_instructions.md
cp assistant-instructions/emergency-assistant.md sops/emergency/system_instructions.md
cp assistant-instructions/tech-support-assistant.md sops/tech/system_instructions.md
cp assistant-instructions/brand-assistant.md sops/brand/system_instructions.md

# Copy knowledge base files
cp "ClubOS Agents/Booking & AccessBot/"*.md sops/booking/
cp "ClubOS Agents/EmergencyBot/"*.md sops/emergency/
cp "ClubOS Agents/TechSupportBot/"*.md sops/tech/
cp "ClubOS Agents/BrandTone & MarketingBot/"*.md sops/brand/
```

### 1.3 Implement OpenPhone Webhook
**TODO 3**: Create OpenPhone webhook receiver
```typescript
// File: src/routes/openphone.ts
import { Router } from 'express';
import { db } from '../utils/database';
import { logger } from '../utils/logger';

const router = Router();

router.post('/webhook', async (req, res) => {
  try {
    const { type, data } = req.body;
    
    // Store conversation
    await db.query(`
      INSERT INTO openphone_conversations 
      (phone_number, customer_name, employee_name, messages, metadata)
      VALUES ($1, $2, $3, $4, $5)
    `, [
      data.phoneNumber,
      data.customerName,
      data.employeeName,
      JSON.stringify(data.messages),
      { openPhoneId: data.id, type }
    ]);
    
    res.json({ received: true });
  } catch (error) {
    logger.error('OpenPhone webhook error:', error);
    res.status(500).json({ error: 'Failed' });
  }
});

export default router;
```

**TODO 4**: Register OpenPhone routes in index.ts
```typescript
// In src/index.ts, add:
import openphoneRoutes from './routes/openphone';
app.use('/api/openphone', openphoneRoutes);
```

## Phase 2: Knowledge Extraction Service
**Goal**: Build extraction without affecting production

### 2.1 Create Knowledge Extractor
**TODO 5**: Implement knowledge extraction service
```typescript
// File: src/services/knowledgeExtractor.ts
// Copy from OPENPHONE_SIMPLE_INTEGRATION.md
```

### 2.2 Admin UI Component
**TODO 6**: Create extraction UI
```typescript
// File: ClubOSV1-frontend/src/components/admin/KnowledgeExtractionPanel.tsx
// Copy component from OPENPHONE_SIMPLE_INTEGRATION.md
```

**TODO 7**: Add route to admin dashboard
```typescript
// In ClubOSV1-frontend/src/pages/admin/index.tsx
import { KnowledgeExtractionPanel } from '../../components/admin/KnowledgeExtractionPanel';

// Add tab:
{activeTab === 'knowledge' && <KnowledgeExtractionPanel />}
```

## Phase 3: Intelligent SOP Module Setup
**Goal**: Prepare SOP module in parallel without using it

### 3.1 Deploy Intelligent SOP Module
**TODO 8**: Ensure intelligentSOPModule.ts is in place
```bash
# File should already exist at:
# src/services/intelligentSOPModule.ts
```

**TODO 9**: Initialize embeddings
```typescript
// Add initialization check to startup
// In src/index.ts after DB init:
import { intelligentSOPModule } from './services/intelligentSOPModule';

// Initialize SOP embeddings
logger.info('Initializing SOP embeddings...');
const sopStatus = intelligentSOPModule.getStatus();
logger.info('SOP module status:', sopStatus);
```

### 3.2 Add Feature Flags
**TODO 10**: Add environment variables
```bash
# Add to .env and .env.example:
USE_INTELLIGENT_SOP=false
SOP_SHADOW_MODE=true
SOP_CONFIDENCE_THRESHOLD=0.75
OPENPHONE_WEBHOOK_SECRET=your_secret_here
```

## Phase 4: Shadow Mode Testing
**Goal**: Run both systems in parallel, log differences

### 4.1 Modify Assistant Service for Shadow Mode
**TODO 11**: Update assistantService.ts
```typescript
// In src/services/assistantService.ts
// Add at the beginning of getAssistantResponse():

const shadowMode = process.env.SOP_SHADOW_MODE === 'true';

if (shadowMode) {
  // Try SOP module but don't use response
  try {
    const sopStart = Date.now();
    const sopResponse = await intelligentSOPModule.processWithContext(
      userMessage,
      route,
      context
    );
    const sopTime = Date.now() - sopStart;
    
    // Log for comparison
    logger.info('SHADOW MODE - SOP Response', {
      route,
      confidence: sopResponse.confidence,
      responseTime: sopTime,
      responsePreview: sopResponse.response?.substring(0, 100)
    });
    
    // Store comparison for analysis
    await db.query(`
      INSERT INTO sop_shadow_comparisons 
      (query, route, assistant_response, sop_response, sop_confidence, sop_time_ms)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [
      userMessage,
      route,
      '', // Will be filled after Assistant response
      sopResponse.response,
      sopResponse.confidence,
      sopTime
    ]);
  } catch (error) {
    logger.error('Shadow mode SOP error:', error);
  }
}

// Continue with existing Assistant API code...
```

## Phase 5: Gradual Rollout
**Goal**: Switch traffic progressively

### 5.1 Implement Percentage-Based Routing
**TODO 12**: Add rollout logic
```typescript
// In assistantService.ts, after shadow mode:

const useIntelligentSOP = process.env.USE_INTELLIGENT_SOP === 'true';
const rolloutPercentage = parseFloat(process.env.SOP_ROLLOUT_PERCENTAGE || '0');

if (useIntelligentSOP && Math.random() * 100 < rolloutPercentage) {
  const sopResponse = await intelligentSOPModule.processWithContext(
    userMessage,
    route,
    context
  );
  
  if (sopResponse.confidence >= parseFloat(process.env.SOP_CONFIDENCE_THRESHOLD || '0.75')) {
    // USE SOP RESPONSE
    return {
      response: sopResponse.response,
      assistantId: `sop-${route}`,
      threadId: `sop-${Date.now()}`,
      confidence: sopResponse.confidence,
      structured: sopResponse.structured
    };
  }
}

// Fall back to Assistant API
```

### 5.2 Monitoring Dashboard
**TODO 13**: Create comparison metrics
```sql
-- Add to migrations:
CREATE TABLE IF NOT EXISTS sop_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE DEFAULT CURRENT_DATE,
  total_requests INTEGER DEFAULT 0,
  sop_used INTEGER DEFAULT 0,
  assistant_used INTEGER DEFAULT 0,
  sop_avg_confidence FLOAT,
  sop_avg_response_time_ms FLOAT,
  assistant_avg_response_time_ms FLOAT
);
```

## Phase 6: Complete Migration
**Goal**: Fully replace Assistants

### 6.1 Final Switch
**TODO 14**: Update environment for full rollout
```bash
# When ready, update production:
USE_INTELLIGENT_SOP=true
SOP_ROLLOUT_PERCENTAGE=100
SOP_SHADOW_MODE=false
```

### 6.2 Remove Assistant Dependencies
**TODO 15**: Clean up old code (ONLY after confirming stability)
```typescript
// Comment out but don't delete initially:
// - Assistant API calls
// - Assistant environment variables
// Keep for 30 days as backup
```

## Testing Checklist

### Before Each Phase:
- [ ] Run existing test suite
- [ ] Verify Assistant API still works
- [ ] Check all routes respond correctly

### Shadow Mode Testing:
- [ ] Verify both responses logged
- [ ] Compare response quality
- [ ] Check response times
- [ ] Monitor confidence scores

### Rollout Testing:
- [ ] Test at 10% traffic
- [ ] Monitor error rates
- [ ] Check user feedback
- [ ] Verify SOP updates work

## Rollback Plan

If issues occur at any phase:
```bash
# Immediate rollback:
USE_INTELLIGENT_SOP=false
SOP_ROLLOUT_PERCENTAGE=0

# No code changes needed - just env vars
```

## Weekly Progress Checkpoints

### Week 1: Foundation
- [ ] Database migrations run
- [ ] OpenPhone webhook receiving data
- [ ] SOP files organized
- [ ] Shadow mode logging working

### Week 2: Knowledge Building  
- [ ] Extract initial knowledge from OpenPhone
- [ ] Review and apply to SOPs
- [ ] Test SOP module responses
- [ ] Compare with Assistant responses

### Week 3: Gradual Rollout
- [ ] Enable 10% traffic to SOPs
- [ ] Monitor metrics dashboard
- [ ] Adjust confidence thresholds
- [ ] Apply more knowledge from OpenPhone

### Week 4: Full Migration
- [ ] Increase to 50% traffic
- [ ] Verify cost savings
- [ ] Plan 100% switchover
- [ ] Document any issues

## Success Criteria

Before declaring complete:
1. SOP responses match or exceed Assistant quality
2. Response time < 1 second
3. Confidence scores > 0.75 for 80% of queries  
4. Zero increase in Slack escalations
5. $750/month cost reduction confirmed

## Important Notes

1. **NEVER break production** - Every change has a flag
2. **Test in shadow mode first** - Log everything
3. **Gradual rollout** - Start with 10%
4. **Keep Assistant API as backup** - Don't delete anything
5. **Monitor closely** - Check metrics daily during rollout

This plan ensures zero downtime and safe migration from OpenAI Assistants to the local SOP system.
