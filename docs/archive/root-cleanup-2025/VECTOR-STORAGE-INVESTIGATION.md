# Vector Storage Investigation for ClubOS LLM Router

## Executive Summary
This investigation explores how vector storage can enhance the ClubOS LLM router (terminal in index page) for improved semantic search and routing capabilities. The system currently uses PostgreSQL and Redis, with 4 main assistant categories that would benefit from vector-based retrieval.

## Current Architecture Analysis

### 1. LLM Router Implementation
- **Location**: Frontend `RequestForm.tsx` → Backend `llmService.ts`
- **Current Flow**:
  - User input → GPT-4 router → Route determination → Assistant selection
  - Routes to one of 4 specialized assistants based on confidence scoring
  - Falls back to Slack when confidence is low

### 2. Four Main Assistant Categories
1. **Emergency** - Critical incidents, safety issues
2. **Booking & Access** - Reservations, gift cards, facility access
3. **TechSupport** - Equipment issues, TrackMan, simulator problems
4. **BrandTone** - Marketing, brand voice, general inquiries

### 3. Existing Knowledge Storage
```sql
-- Three main knowledge tables in PostgreSQL:
1. assistant_knowledge (id, assistant_name, knowledge_text)
2. knowledge_store (id, category, content, tags[], metadata)
3. extracted_knowledge (id, conversation_id, question, answer, confidence_score)
```

### 4. Redis Usage
- **Current State**: Redis configured for caching (`cacheService.ts`)
- **Connection**: Uses `REDIS_URL` or `REDIS_TLS_URL` env vars
- **Fallback**: In-memory cache when Redis unavailable
- **Usage**: Session caching, rate limiting, temporary data

## Vector Storage Opportunities

### 1. Knowledge Base Vectorization
**What to Vectorize**:
- All entries in `assistant_knowledge` table (~100-500 docs per assistant)
- `knowledge_store` content (categories, tags, metadata)
- Historical Q&A pairs from `extracted_knowledge`
- OpenPhone conversation history for context

**Benefits**:
- Semantic search across all knowledge bases
- Find similar past questions/issues
- Context-aware routing based on similarity
- Improved confidence scoring

### 2. Conversation Context Vectors
**What to Vectorize**:
- Recent conversation history
- Customer interaction patterns
- Successful resolution paths
- Common problem clusters

**Benefits**:
- Better understanding of customer intent
- Predictive routing based on conversation patterns
- Identify trending issues automatically

## Recommended Vector Storage Solutions

### Option 1: pgvector (PostgreSQL Extension) ⭐ RECOMMENDED
**Pros**:
- Native PostgreSQL integration
- No additional infrastructure
- Works with existing database
- Simple deployment on Railway
- Cost-effective

**Implementation**:
```sql
-- Enable pgvector extension
CREATE EXTENSION vector;

-- Add vector columns to existing tables
ALTER TABLE assistant_knowledge 
ADD COLUMN embedding vector(1536); -- OpenAI embeddings

ALTER TABLE knowledge_store 
ADD COLUMN embedding vector(1536);

-- Create indexes for similarity search
CREATE INDEX ON assistant_knowledge 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);
```

**Integration Points**:
1. Add embedding generation on knowledge insert/update
2. Create similarity search endpoints
3. Enhance router with vector similarity scoring
4. Cache frequently accessed vectors in Redis

### Option 2: Redis Vector Search
**Pros**:
- Already have Redis infrastructure
- Extremely fast retrieval
- Real-time updates
- Good for hot data

**Cons**:
- Requires Redis Stack (not basic Redis)
- Additional memory costs
- Data persistence concerns

**Implementation**:
```javascript
// Using Redis Vector Similarity Search
import { createClient, SchemaFieldTypes, VectorAlgorithms } from 'redis';

const schema = {
  '$.assistant_name': { type: SchemaFieldTypes.TEXT },
  '$.knowledge_text': { type: SchemaFieldTypes.TEXT },
  '$.embedding': {
    type: SchemaFieldTypes.VECTOR,
    algorithm: VectorAlgorithms.HNSW,
    type: 'FLOAT32',
    dimension: 1536
  }
};
```

## Implementation Strategy

### Phase 1: Foundation (Week 1)
1. **Install pgvector extension** in PostgreSQL
2. **Create embedding service** using OpenAI API
3. **Add vector columns** to knowledge tables
4. **Generate embeddings** for existing knowledge

### Phase 2: Integration (Week 2)
1. **Create vector search endpoints**:
   - `/api/knowledge/search-similar`
   - `/api/routing/vector-match`
2. **Enhance LLM router** with vector similarity:
   ```javascript
   // Enhanced routing logic
   async routeWithVectors(input: string) {
     // 1. Generate embedding for input
     const inputVector = await generateEmbedding(input);
     
     // 2. Search similar knowledge across all assistants
     const similarities = await searchSimilarKnowledge(inputVector);
     
     // 3. Weight vector similarity with current confidence
     const enhancedRoute = combineScores(
       llmConfidence, 
       vectorSimilarity
     );
     
     return enhancedRoute;
   }
   ```

### Phase 3: Optimization (Week 3)
1. **Implement hybrid search** (keyword + vector)
2. **Add Redis caching** for hot vectors
3. **Create feedback loop** to improve embeddings
4. **Build analytics dashboard** for vector performance

## Key Integration Points

### 1. RequestForm.tsx (Frontend)
```javascript
// Add vector-enhanced routing option
const [useVectorRouting, setUseVectorRouting] = useState(true);

// Include similar context in request
const enhancedRequest = {
  ...formData,
  similarContext: await fetchSimilarContext(formData.requestDescription),
  useVectorRouting
};
```

### 2. knowledge-router.ts (Backend)
```javascript
// Enhance routing with vector search
async parseAndRoute(input: string) {
  // Current GPT-4 parsing
  const parsed = await parseKnowledgeInput(input);
  
  // NEW: Vector similarity search
  const vectorMatches = await vectorSearch(input, {
    threshold: 0.85,
    limit: 5
  });
  
  // Combine both approaches
  return mergeRoutingStrategies(parsed, vectorMatches);
}
```

### 3. assistantService.ts
```javascript
// Add vector context to assistant calls
async getAssistantResponse(route, message, context) {
  // NEW: Fetch relevant vectors
  const relevantKnowledge = await getRelevantVectors(
    route, 
    message, 
    { limit: 10 }
  );
  
  // Include in assistant context
  const enhancedContext = {
    ...context,
    relevantKnowledge: relevantKnowledge.map(k => k.text),
    similarityScores: relevantKnowledge.map(k => k.score)
  };
  
  return await callAssistant(route, message, enhancedContext);
}
```

## Performance Considerations

### Vector Indexing Strategy
- **HNSW** for high accuracy (pgvector/Redis)
- **IVFFlat** for balanced speed/accuracy
- **Batch processing** for initial embeddings
- **Incremental updates** for new knowledge

### Caching Strategy
```javascript
// Multi-tier caching
1. Hot vectors in Redis (TTL: 1 hour)
2. Recent searches in memory (TTL: 5 minutes)
3. Persistent vectors in PostgreSQL
```

### Cost Optimization
- **Embedding Generation**: ~$0.0001 per 1K tokens
- **Storage**: ~6KB per vector (1536 dimensions)
- **Estimated Monthly**: $10-50 depending on volume

## Migration Path

### Step 1: Database Preparation
```sql
-- Migration: 057_add_vector_support.sql
CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE assistant_knowledge 
ADD COLUMN IF NOT EXISTS embedding vector(1536),
ADD COLUMN IF NOT EXISTS embedding_model VARCHAR(50) DEFAULT 'text-embedding-3-small',
ADD COLUMN IF NOT EXISTS embedding_updated_at TIMESTAMP;

CREATE INDEX idx_assistant_knowledge_embedding 
ON assistant_knowledge USING ivfflat (embedding vector_cosine_ops);
```

### Step 2: Gradual Rollout
1. **Shadow Mode**: Run vector search alongside current system
2. **A/B Testing**: Compare routing accuracy
3. **Confidence Threshold**: Start high (0.9), gradually lower
4. **Monitoring**: Track performance metrics

## Recommended Next Steps

1. **Immediate Actions**:
   - Install pgvector on Railway PostgreSQL
   - Create embedding generation service
   - Start vectorizing assistant_knowledge table

2. **Short-term (2 weeks)**:
   - Implement vector search endpoints
   - Add vector scoring to router
   - Create performance dashboards

3. **Long-term (1 month)**:
   - Full hybrid search implementation
   - Redis vector caching layer
   - ML feedback loop for embedding improvement

## Conclusion

Vector storage implementation will significantly enhance the ClubOS LLM router by:
- **Improving routing accuracy** by 25-40% (estimated)
- **Reducing false positives** in assistant selection
- **Enabling semantic search** across all knowledge bases
- **Providing context-aware responses** based on similar past interactions

The recommended approach using pgvector with PostgreSQL minimizes infrastructure changes while providing powerful vector capabilities. The existing Redis cache can be leveraged for performance optimization without requiring Redis Stack.

## Appendix: Sample Implementation

### Embedding Generation Service
```javascript
// services/embeddingService.ts
import OpenAI from 'openai';

class EmbeddingService {
  async generateEmbedding(text: string): Promise<number[]> {
    const response = await this.openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
    });
    return response.data[0].embedding;
  }
  
  async batchGenerate(texts: string[]): Promise<number[][]> {
    // Batch process up to 100 texts
    const batches = chunk(texts, 100);
    const embeddings = [];
    
    for (const batch of batches) {
      const response = await this.openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: batch,
      });
      embeddings.push(...response.data.map(d => d.embedding));
    }
    
    return embeddings;
  }
}
```

### Vector Search Query
```sql
-- Find similar knowledge using cosine similarity
SELECT 
  assistant_name,
  knowledge_text,
  1 - (embedding <=> $1::vector) as similarity
FROM assistant_knowledge
WHERE 1 - (embedding <=> $1::vector) > 0.8
ORDER BY similarity DESC
LIMIT 10;
```

### Router Enhancement
```javascript
// Enhanced routing with vectors
async function enhancedRoute(input: string) {
  // Generate embedding
  const embedding = await embeddingService.generateEmbedding(input);
  
  // Search across all assistants
  const results = await db.query(`
    SELECT 
      assistant_name,
      AVG(1 - (embedding <=> $1::vector)) as avg_similarity,
      COUNT(*) as match_count
    FROM assistant_knowledge
    WHERE 1 - (embedding <=> $1::vector) > 0.75
    GROUP BY assistant_name
    ORDER BY avg_similarity DESC
    LIMIT 1
  `, [embedding]);
  
  if (results.rows[0]?.avg_similarity > 0.85) {
    return {
      route: results.rows[0].assistant_name,
      confidence: results.rows[0].avg_similarity,
      method: 'vector'
    };
  }
  
  // Fall back to GPT-4 routing
  return await gptRoute(input);
}
```