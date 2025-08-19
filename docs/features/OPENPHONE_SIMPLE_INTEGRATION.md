# OpenPhone Knowledge Extraction System

## Simplified Architecture

```
OpenPhone → Webhook → PostgreSQL → Claude Analysis → SOP Updates
```

## Database Schema

```sql
-- Store all OpenPhone conversations
CREATE TABLE openphone_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number VARCHAR(20),
  customer_name VARCHAR(255),
  employee_name VARCHAR(255),
  employee_phone VARCHAR(20),
  direction VARCHAR(10) CHECK (direction IN ('inbound', 'outbound')),
  messages JSONB NOT NULL, -- Array of {sender, text, timestamp}
  started_at TIMESTAMP,
  ended_at TIMESTAMP,
  duration_seconds INTEGER,
  tags TEXT[],
  resolved BOOLEAN DEFAULT FALSE,
  resolution_notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'
);

-- Extracted knowledge from conversations
CREATE TABLE extracted_knowledge (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_conversation_id UUID REFERENCES openphone_conversations(id),
  problem_description TEXT NOT NULL,
  solution_description TEXT NOT NULL,
  category VARCHAR(50),
  confidence FLOAT DEFAULT 0.5,
  verified BOOLEAN DEFAULT FALSE,
  applied_to_sop BOOLEAN DEFAULT FALSE,
  extracted_at TIMESTAMP DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'
);

-- Indexes for performance
CREATE INDEX idx_openphone_conversations_created_at ON openphone_conversations(created_at DESC);
CREATE INDEX idx_openphone_conversations_resolved ON openphone_conversations(resolved);
CREATE INDEX idx_extracted_knowledge_category ON extracted_knowledge(category);
CREATE INDEX idx_extracted_knowledge_applied ON extracted_knowledge(applied_to_sop);
```

## OpenPhone Webhook Integration

```typescript
// openphone.ts - Webhook receiver
import { Router } from 'express';
import { db } from '../utils/database';
import { logger } from '../utils/logger';

const router = Router();

// Webhook endpoint for OpenPhone
router.post('/webhook', async (req, res) => {
  try {
    const { 
      type, 
      data 
    } = req.body;

    if (type === 'message.created' || type === 'conversation.completed') {
      await storeConversation(data);
    }

    res.json({ received: true });
  } catch (error) {
    logger.error('OpenPhone webhook error:', error);
    res.status(500).json({ error: 'Processing failed' });
  }
});

async function storeConversation(data: any) {
  const conversation = {
    phone_number: data.phoneNumber,
    customer_name: data.customerName || 'Unknown',
    employee_name: data.participant?.name,
    employee_phone: data.participant?.phoneNumber,
    direction: data.direction,
    messages: data.messages || [],
    started_at: data.createdAt,
    ended_at: data.completedAt,
    duration_seconds: data.duration,
    tags: data.tags || [],
    metadata: {
      openPhoneId: data.id,
      raw: data
    }
  };

  await db.query(`
    INSERT INTO openphone_conversations 
    (phone_number, customer_name, employee_name, employee_phone, 
     direction, messages, started_at, ended_at, duration_seconds, 
     tags, metadata)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    ON CONFLICT ((metadata->>'openPhoneId')) DO UPDATE
    SET messages = EXCLUDED.messages,
        ended_at = EXCLUDED.ended_at,
        duration_seconds = EXCLUDED.duration_seconds,
        tags = EXCLUDED.tags
  `, Object.values(conversation));
}

export default router;
```

## Claude Analysis Service

```typescript
// knowledgeExtractor.ts
import { OpenAI } from 'openai';
import { db } from '../utils/database';
import { logger } from '../utils/logger';

export class KnowledgeExtractor {
  private openai: OpenAI;
  
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }

  /**
   * Analyze unprocessed conversations and extract knowledge
   */
  async analyzeConversations(limit: number = 50): Promise<any> {
    // Get unprocessed conversations
    const result = await db.query(`
      SELECT c.* FROM openphone_conversations c
      LEFT JOIN extracted_knowledge k ON k.source_conversation_id = c.id
      WHERE k.id IS NULL
      AND c.messages IS NOT NULL
      AND jsonb_array_length(c.messages) > 2
      ORDER BY c.created_at DESC
      LIMIT $1
    `, [limit]);

    const conversations = result.rows;
    const extractedKnowledge = [];

    for (const conv of conversations) {
      try {
        const knowledge = await this.extractFromConversation(conv);
        if (knowledge.length > 0) {
          extractedKnowledge.push(...knowledge);
          
          // Store in database
          for (const item of knowledge) {
            await this.storeKnowledge(conv.id, item);
          }
        }
      } catch (error) {
        logger.error('Failed to extract from conversation:', error);
      }
    }

    return {
      processed: conversations.length,
      knowledgeExtracted: extractedKnowledge.length,
      items: extractedKnowledge
    };
  }

  /**
   * Extract knowledge from a single conversation
   */
  private async extractFromConversation(conversation: any): Promise<any[]> {
    const messages = conversation.messages;
    
    // Format conversation for analysis
    const formattedConvo = messages.map((m: any) => 
      `${m.sender}: ${m.text}`
    ).join('\n');

    const prompt = `Analyze this customer service phone conversation and extract any problems that were solved:

${formattedConvo}

For each problem-solution pair found, extract:
1. Clear problem description
2. Complete solution provided
3. Category (booking, tech, emergency, access, general)
4. Confidence (0-1) that this is valuable knowledge

Return JSON array:
[{
  "problem": "Customer couldn't unlock door with card",
  "solution": "Hold card flat against reader for 3 seconds. If fails, use backup keypad code #7823#",
  "category": "access",
  "confidence": 0.9
}]

Only include clear problem-solution pairs. Return empty array if none found.`;

    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: 'You extract operational knowledge from customer service calls.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' }
      });

      const response = JSON.parse(completion.choices[0].message.content || '{"items":[]}');
      return response.items || [];
      
    } catch (error) {
      logger.error('GPT-4 extraction failed:', error);
      return [];
    }
  }

  /**
   * Store extracted knowledge
   */
  private async storeKnowledge(conversationId: string, knowledge: any): Promise<void> {
    await db.query(`
      INSERT INTO extracted_knowledge 
      (source_conversation_id, problem_description, solution_description, 
       category, confidence, metadata)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [
      conversationId,
      knowledge.problem,
      knowledge.solution,
      knowledge.category,
      knowledge.confidence,
      { extractedAt: new Date().toISOString() }
    ]);
  }

  /**
   * Get knowledge ready for SOP updates
   */
  async getReadyKnowledge(category?: string): Promise<any[]> {
    let query = `
      SELECT 
        k.*,
        c.employee_name,
        c.created_at as conversation_date
      FROM extracted_knowledge k
      JOIN openphone_conversations c ON k.source_conversation_id = c.id
      WHERE k.applied_to_sop = FALSE
      AND k.confidence >= 0.7
    `;
    
    const params: any[] = [];
    
    if (category) {
      query += ' AND k.category = $1';
      params.push(category);
    }
    
    query += ' ORDER BY k.confidence DESC, k.extracted_at DESC';
    
    const result = await db.query(query, params);
    return result.rows;
  }

  /**
   * Apply knowledge to SOPs
   */
  async applyKnowledgeToSOPs(knowledgeIds: string[]): Promise<void> {
    // Group by category
    const result = await db.query(`
      SELECT * FROM extracted_knowledge 
      WHERE id = ANY($1::uuid[])
      AND applied_to_sop = FALSE
    `, [knowledgeIds]);

    const byCategory = result.rows.reduce((acc, item) => {
      if (!acc[item.category]) acc[item.category] = [];
      acc[item.category].push(item);
      return acc;
    }, {} as Record<string, any[]>);

    // Update SOPs for each category
    for (const [category, items] of Object.entries(byCategory)) {
      await this.updateCategorySOPs(category, items);
    }

    // Mark as applied
    await db.query(`
      UPDATE extracted_knowledge 
      SET applied_to_sop = TRUE 
      WHERE id = ANY($1::uuid[])
    `, [knowledgeIds]);
  }

  /**
   * Update SOPs for a specific category
   */
  private async updateCategorySOPs(category: string, knowledge: any[]): Promise<void> {
    // This would integrate with your existing SOP module
    logger.info(`Updating ${category} SOPs with ${knowledge.length} new items`);
    
    // Format knowledge for SOP update
    const updates = knowledge.map(k => ({
      problem: k.problem_description,
      solution: k.solution_description,
      source: 'OpenPhone',
      confidence: k.confidence
    }));

    // Here you would call your SOP update logic
    // For now, just log
    logger.info('SOP updates ready:', updates);
  }
}

export const knowledgeExtractor = new KnowledgeExtractor();
```

## UI Components

```typescript
// KnowledgeExtractionPanel.tsx
import React, { useState, useEffect } from 'react';
import { Button, Card, Badge, Table } from '../components/ui';
import { useAuth } from '../hooks/useAuth';
import axios from 'axios';

export function KnowledgeExtractionPanel() {
  const { user } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [knowledge, setKnowledge] = useState<any[]>([]);
  const [processing, setProcessing] = useState(false);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);

  useEffect(() => {
    loadStats();
    loadPendingKnowledge();
  }, []);

  const loadStats = async () => {
    const res = await axios.get('/api/openphone/stats');
    setStats(res.data);
  };

  const loadPendingKnowledge = async () => {
    const res = await axios.get('/api/openphone/knowledge/pending');
    setKnowledge(res.data.items);
  };

  const runExtraction = async () => {
    setProcessing(true);
    try {
      const res = await axios.post('/api/openphone/extract');
      alert(`Processed ${res.data.processed} conversations, extracted ${res.data.knowledgeExtracted} items`);
      await loadStats();
      await loadPendingKnowledge();
    } catch (error) {
      alert('Extraction failed');
    }
    setProcessing(false);
  };

  const applyToSOPs = async () => {
    if (selectedItems.length === 0) {
      alert('Select items to apply');
      return;
    }

    try {
      await axios.post('/api/openphone/knowledge/apply', {
        knowledgeIds: selectedItems
      });
      alert(`Applied ${selectedItems.length} items to SOPs`);
      setSelectedItems([]);
      await loadPendingKnowledge();
    } catch (error) {
      alert('Failed to apply knowledge');
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <h2 className="text-xl font-bold mb-4">OpenPhone Knowledge Extraction</h2>
        
        {stats && (
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="text-center">
              <div className="text-2xl font-bold">{stats.totalConversations}</div>
              <div className="text-sm text-gray-600">Total Conversations</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{stats.unprocessed}</div>
              <div className="text-sm text-gray-600">Unprocessed</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{stats.knowledgeItems}</div>
              <div className="text-sm text-gray-600">Knowledge Items</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{stats.pendingApplication}</div>
              <div className="text-sm text-gray-600">Pending Application</div>
            </div>
          </div>
        )}

        <div className="flex gap-4">
          <Button 
            onClick={runExtraction}
            disabled={processing}
            className="bg-blue-600"
          >
            {processing ? 'Extracting...' : 'Run Claude Analysis'}
          </Button>
          
          <Button 
            onClick={applyToSOPs}
            disabled={selectedItems.length === 0}
            className="bg-green-600"
          >
            Apply {selectedItems.length} Items to SOPs
          </Button>
        </div>
      </Card>

      <Card>
        <h3 className="text-lg font-bold mb-4">Pending Knowledge Items</h3>
        
        <Table>
          <thead>
            <tr>
              <th>Select</th>
              <th>Category</th>
              <th>Problem</th>
              <th>Solution</th>
              <th>Confidence</th>
              <th>Source</th>
            </tr>
          </thead>
          <tbody>
            {knowledge.map(item => (
              <tr key={item.id}>
                <td>
                  <input
                    type="checkbox"
                    checked={selectedItems.includes(item.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedItems([...selectedItems, item.id]);
                      } else {
                        setSelectedItems(selectedItems.filter(id => id !== item.id));
                      }
                    }}
                  />
                </td>
                <td>
                  <Badge variant={item.category}>{item.category}</Badge>
                </td>
                <td className="max-w-xs truncate">{item.problem_description}</td>
                <td className="max-w-xs truncate">{item.solution_description}</td>
                <td>{(item.confidence * 100).toFixed(0)}%</td>
                <td className="text-sm text-gray-600">{item.employee_name}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
```

## API Routes

```typescript
// openphone-routes.ts
import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { adminOnly } from '../middleware/roleGuard';
import { knowledgeExtractor } from '../services/knowledgeExtractor';
import { db } from '../utils/database';

const router = Router();

// Get statistics
router.get('/stats', authenticate, async (req, res) => {
  const stats = await db.query(`
    SELECT 
      COUNT(*) as total_conversations,
      COUNT(*) FILTER (WHERE id NOT IN (
        SELECT DISTINCT source_conversation_id FROM extracted_knowledge
      )) as unprocessed,
      (SELECT COUNT(*) FROM extracted_knowledge) as knowledge_items,
      (SELECT COUNT(*) FROM extracted_knowledge WHERE applied_to_sop = FALSE) as pending_application
    FROM openphone_conversations
  `);
  
  res.json(stats.rows[0]);
});

// Run extraction
router.post('/extract', authenticate, adminOnly, async (req, res) => {
  const result = await knowledgeExtractor.analyzeConversations(50);
  res.json(result);
});

// Get pending knowledge
router.get('/knowledge/pending', authenticate, async (req, res) => {
  const items = await knowledgeExtractor.getReadyKnowledge();
  res.json({ items });
});

// Apply knowledge to SOPs
router.post('/knowledge/apply', authenticate, adminOnly, async (req, res) => {
  const { knowledgeIds } = req.body;
  await knowledgeExtractor.applyKnowledgeToSOPs(knowledgeIds);
  res.json({ success: true });
});

export default router;
```

## Benefits of This Approach

1. **Simple Integration**: Just webhook → database
2. **Batch Processing**: Analyze when convenient
3. **Human Review**: See exactly what will be added
4. **No Real-time Complexity**: Process at your own pace
5. **Full Visibility**: Every conversation stored and searchable

## Usage Flow

1. **OpenPhone sends all conversations to webhook**
2. **Data stored in PostgreSQL automatically**
3. **Admin clicks "Run Claude Analysis"**
4. **Claude extracts problems/solutions**
5. **Admin reviews and selects items**
6. **Click "Apply to SOPs"**
7. **SOPs updated with new knowledge**

Much simpler than the real-time learning system!
