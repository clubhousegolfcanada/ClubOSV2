# ClubOS V1: Intelligent SOP Module Architecture

## The Problem with Keywords
You're right - keyword matching is:
- **Brittle**: "can't open door" vs "door won't unlock" vs "access denied"
- **Context-blind**: Can't understand intent or urgency
- **Not scalable**: Every synonym needs manual mapping

## Intelligent Solution: Hybrid Embeddings + GPT-4o

### Architecture Overview
```
Query → Embeddings → Semantic Search → Context Injection → GPT-4o → Structured Response
         ↓                ↓                    ↓                ↓
    Vector DB      Find SOPs/Docs     Build Prompt      Format JSON
```

### Why This Works
1. **Semantic Understanding**: Embeddings capture meaning, not keywords
2. **Context Awareness**: GPT-4o still processes the final response
3. **Cost Effective**: Only embed once, reuse forever
4. **Maintainable**: Claude can edit .md files directly

## Implementation Plan

### Phase 1: Embedding Infrastructure

```typescript
// sopModule.ts - Intelligent version
import { OpenAI } from 'openai';
import { logger } from '../utils/logger';
import { db } from '../utils/database';
import fs from 'fs/promises';
import path from 'path';

interface SOPDocument {
  id: string;
  assistant: string;
  title: string;
  content: string;
  embedding?: number[];
  metadata?: any;
}

export class IntelligentSOPModule {
  private openai: OpenAI;
  private embeddingsCache: Map<string, number[]> = new Map();
  private documentsCache: Map<string, SOPDocument[]> = new Map();
  
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    this.initializeDocuments();
  }

  private async initializeDocuments() {
    // Load all assistant instructions and SOPs
    const assistantDirs = {
      'emergency': [
        '/assistant-instructions/emergency-assistant.md',
        '/ClubOS Agents/EmergencyBot/Emergency_Procedures_Binder.md',
        '/ClubOS Agents/EmergencyBot/Escalation_Contacts.md'
      ],
      'tech': [
        '/assistant-instructions/tech-support-assistant.md',
        '/ClubOS Agents/TechSupportBot/Simulator_Troubleshooting.md',
        '/ClubOS Agents/TechSupportBot/Hardware_Reset_SOPs.md',
        '/ClubOS Agents/TechSupportBot/Technical_FAQs.md'
      ],
      'booking': [
        '/assistant-instructions/booking-assistant.md',
        '/ClubOS Agents/Booking & AccessBot/Booking_SOPs.md',
        '/ClubOS Agents/Booking & AccessBot/Access_Control_Troubleshooting.md',
        '/ClubOS Agents/Booking & AccessBot/Refund_Credit_Policies.md'
      ],
      'brand': [
        '/assistant-instructions/brand-assistant.md',
        '/ClubOS Agents/BrandTone & MarketingBot/Brand_Guidelines.md',
        '/ClubOS Agents/BrandTone & MarketingBot/Customer_Tone_Standards.md'
      ]
    };

    // Generate embeddings for all documents
    for (const [assistant, files] of Object.entries(assistantDirs)) {
      const docs = await this.loadAndEmbedDocuments(assistant, files);
      this.documentsCache.set(assistant, docs);
    }
  }

  private async loadAndEmbedDocuments(
    assistant: string, 
    filePaths: string[]
  ): Promise<SOPDocument[]> {
    const documents: SOPDocument[] = [];
    
    for (const filePath of filePaths) {
      try {
        const fullPath = path.join(__dirname, '../..', filePath);
        const content = await fs.readFile(fullPath, 'utf-8');
        
        // Split into chunks if needed (for long documents)
        const chunks = this.chunkDocument(content);
        
        for (const chunk of chunks) {
          const embedding = await this.getEmbedding(chunk.text);
          
          documents.push({
            id: `${filePath}-${chunk.index}`,
            assistant,
            title: chunk.title || path.basename(filePath),
            content: chunk.text,
            embedding,
            metadata: {
              source: filePath,
              chunkIndex: chunk.index,
              isSystemInstruction: filePath.includes('assistant-instructions')
            }
          });
        }
      } catch (error) {
        logger.error(`Failed to load document ${filePath}:`, error);
      }
    }
    
    return documents;
  }

  private chunkDocument(content: string): Array<{text: string, title?: string, index: number}> {
    // Smart chunking: respect markdown headers and maintain context
    const lines = content.split('\n');
    const chunks: Array<{text: string, title?: string, index: number}> = [];
    let currentChunk: string[] = [];
    let currentTitle = '';
    let chunkIndex = 0;
    
    for (const line of lines) {
      // New section header
      if (line.startsWith('# ') || line.startsWith('## ')) {
        if (currentChunk.length > 0) {
          chunks.push({
            text: currentChunk.join('\n'),
            title: currentTitle,
            index: chunkIndex++
          });
          currentChunk = [];
        }
        currentTitle = line.replace(/^#+\s*/, '');
      }
      
      currentChunk.push(line);
      
      // Chunk size limit (roughly 1000 tokens)
      if (currentChunk.join('\n').length > 3000) {
        chunks.push({
          text: currentChunk.join('\n'),
          title: currentTitle,
          index: chunkIndex++
        });
        currentChunk = [currentTitle]; // Keep section context
      }
    }
    
    // Final chunk
    if (currentChunk.length > 0) {
      chunks.push({
        text: currentChunk.join('\n'),
        title: currentTitle,
        index: chunkIndex
      });
    }
    
    return chunks.length > 0 ? chunks : [{text: content, index: 0}];
  }

  private async getEmbedding(text: string): Promise<number[]> {
    try {
      const response = await this.openai.embeddings.create({
        model: "text-embedding-3-small",
        input: text,
      });
      
      return response.data[0].embedding;
    } catch (error) {
      logger.error('Failed to generate embedding:', error);
      return [];
    }
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  async findRelevantContext(
    query: string, 
    assistant: string, 
    topK: number = 5
  ): Promise<SOPDocument[]> {
    // Get query embedding
    const queryEmbedding = await this.getEmbedding(query);
    
    // Get documents for this assistant
    const documents = this.documentsCache.get(this.normalizeAssistant(assistant)) || [];
    
    // Calculate similarities
    const similarities = documents.map(doc => ({
      doc,
      similarity: doc.embedding ? this.cosineSimilarity(queryEmbedding, doc.embedding) : 0
    }));
    
    // Sort by similarity and return top K
    return similarities
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK)
      .filter(s => s.similarity > 0.7) // Relevance threshold
      .map(s => s.doc);
  }

  async processWithContext(
    query: string,
    assistant: string,
    context?: any
  ): Promise<{
    response: string;
    confidence: number;
    source: string;
    structured?: any;
  }> {
    try {
      // Find relevant documents
      const relevantDocs = await this.findRelevantContext(query, assistant);
      
      if (relevantDocs.length === 0) {
        return {
          response: '',
          confidence: 0,
          source: 'no_match'
        };
      }
      
      // Build context prompt
      const systemPrompt = this.buildSystemPrompt(assistant, relevantDocs);
      
      // Call GPT-4o with context
      const completion = await this.openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: query }
        ],
        temperature: 0.3,
        response_format: { type: "json_object" }
      });
      
      const response = completion.choices[0].message.content;
      
      // Parse JSON response
      let structured;
      try {
        structured = JSON.parse(response || '{}');
      } catch {
        structured = { response: response || '' };
      }
      
      return {
        response: structured.response || response || '',
        confidence: relevantDocs[0] ? 0.8 + (relevantDocs.length * 0.02) : 0.5,
        source: 'sop_gpt4o',
        structured
      };
      
    } catch (error) {
      logger.error('Failed to process with context:', error);
      return {
        response: '',
        confidence: 0,
        source: 'error'
      };
    }
  }

  private buildSystemPrompt(assistant: string, documents: SOPDocument[]): string {
    // Get system instructions
    const systemInstructions = documents.find(d => d.metadata?.isSystemInstruction);
    
    // Get relevant SOPs
    const sops = documents.filter(d => !d.metadata?.isSystemInstruction);
    
    let prompt = '';
    
    // Add system instructions first
    if (systemInstructions) {
      prompt += systemInstructions.content + '\n\n';
    }
    
    // Add relevant context
    if (sops.length > 0) {
      prompt += 'RELEVANT KNOWLEDGE BASE:\n\n';
      for (const sop of sops) {
        prompt += `### ${sop.title}\n${sop.content}\n\n`;
      }
    }
    
    // Add JSON formatting reminder
    prompt += '\nRemember: You MUST respond ONLY with valid JSON as specified in the instructions.';
    
    return prompt;
  }

  private normalizeAssistant(assistant: string): string {
    const mapping: Record<string, string> = {
      'Booking & Access': 'booking',
      'Emergency': 'emergency', 
      'TechSupport': 'tech',
      'BrandTone': 'brand'
    };
    return mapping[assistant] || assistant.toLowerCase();
  }

  // Admin methods for updating SOPs
  async updateDocument(filePath: string, content: string): Promise<void> {
    // Update file
    const fullPath = path.join(__dirname, '../..', filePath);
    await fs.writeFile(fullPath, content);
    
    // Re-embed and update cache
    await this.initializeDocuments();
    
    logger.info('Document updated and re-embedded:', filePath);
  }

  // Store embeddings in database for persistence
  async persistEmbeddings(): Promise<void> {
    if (!db.initialized) return;
    
    for (const [assistant, docs] of this.documentsCache) {
      for (const doc of docs) {
        if (doc.embedding) {
          await db.query(`
            INSERT INTO sop_embeddings (id, assistant, title, content, embedding, metadata)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (id) DO UPDATE SET
              content = $4,
              embedding = $5,
              metadata = $6,
              updated_at = NOW()
          `, [
            doc.id,
            assistant,
            doc.title,
            doc.content,
            JSON.stringify(doc.embedding),
            doc.metadata
          ]);
        }
      }
    }
  }
}
```

### Phase 2: Database Schema for Embeddings

```sql
-- Add to migration
CREATE TABLE IF NOT EXISTS sop_embeddings (
  id VARCHAR(255) PRIMARY KEY,
  assistant VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  embedding JSONB NOT NULL, -- Store as JSONB for now, pgvector later
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_sop_embeddings_assistant ON sop_embeddings(assistant);
CREATE INDEX idx_sop_embeddings_metadata ON sop_embeddings USING GIN(metadata);
```

### Phase 3: Integration Pattern

```typescript
// In assistantService.ts
import { intelligentSOPModule } from './intelligentSOPModule';

async getAssistantResponse(
  route: string,
  userMessage: string,
  context?: Record<string, any>
): Promise<AssistantResponse> {
  
  // Try intelligent SOP module first
  const sopResponse = await intelligentSOPModule.processWithContext(
    userMessage, 
    route, 
    context
  );
  
  if (sopResponse.confidence > 0.75 && sopResponse.structured) {
    logger.info('Using intelligent SOP response', { 
      route, 
      confidence: sopResponse.confidence,
      source: sopResponse.source 
    });
    
    return {
      response: sopResponse.response,
      assistantId: `sop-${route}`,
      threadId: `sop-${Date.now()}`,
      confidence: sopResponse.confidence,
      // Properly typed structured response
      structured: sopResponse.structured.structured,
      category: sopResponse.structured.category,
      priority: sopResponse.structured.priority,
      actions: sopResponse.structured.actions,
      metadata: sopResponse.structured.metadata,
      escalation: sopResponse.structured.escalation
    };
  }
  
  // Fall back to OpenAI Assistant
  // ... existing code
}
```

## Key Advantages

1. **Semantic Search**: "door won't open" matches "access denied" content
2. **Context Injection**: GPT-4o gets relevant SOPs + system instructions
3. **JSON Compliance**: Maintains your exact response format
4. **Cost Efficient**: 
   - Embeddings: ~$0.00002 per 1K tokens (one-time)
   - GPT-4o: ~$0.005 per request (vs $0.03 for Assistant API)
5. **Editable**: Claude can update .md files, system auto-reembeds

## Migration Strategy

### Week 1: Shadow Mode
```typescript
// Log both responses, use Assistant API
const sopResponse = await intelligentSOP.process(query);
const assistantResponse = await openAIAssistant.process(query);
logger.info('Response comparison', { sop: sopResponse, assistant: assistantResponse });
return assistantResponse; // Still use Assistant
```

### Week 2: A/B Testing
```typescript
if (Math.random() < 0.1) { // 10% traffic
  return sopResponse;
}
return assistantResponse;
```

### Week 3: Gradual Rollout
- Monitor quality metrics
- Adjust confidence thresholds
- Increase traffic percentage

### Week 4: Full Migration
- SOP module as primary
- Assistant API as fallback only

## Future Enhancements

1. **pgvector**: Native vector search in PostgreSQL
2. **Fine-tuning**: Custom model on your SOP data
3. **Active Learning**: Flag low-confidence responses for review
4. **Multi-modal**: Add images/videos to SOPs
5. **Version Control**: Git-based SOP management

## Cost Comparison

### Current (Assistant API)
- ~$0.03 per message
- 1000 messages/day = $30/day = $900/month

### Intelligent SOP Module
- Embeddings: ~$10 one-time
- GPT-4o: ~$0.005 per message
- 1000 messages/day = $5/day = $150/month
- **Savings: $750/month (83% reduction)**

This approach gives you the intelligence you need while maintaining full control over your content and significant cost savings.
