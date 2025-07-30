import { OpenAI } from 'openai';
import { logger } from '../utils/logger';
import { db } from '../utils/database';
import fs from 'fs/promises';
import path from 'path';
import { EventEmitter } from 'events';

interface SOPDocument {
  id: string;
  assistant: string;
  title: string;
  content: string;
  embedding?: number[];
  metadata?: any;
}

interface KnowledgeCapture {
  id: string;
  source: 'slack' | 'chat' | 'ticket' | 'manual';
  query: string;
  response: string;
  assistant: string;
  confidence: number;
  verified: boolean;
  created_at: Date;
  verified_by?: string;
  metadata?: any;
}

interface SOPUpdate {
  documentId: string;
  originalContent: string;
  suggestedContent: string;
  reason: string;
  confidence: number;
  sources: string[]; // IDs of knowledge captures that led to this update
}

export class LearningSOPModule extends EventEmitter {
  private openai: OpenAI;
  private documentsCache: Map<string, SOPDocument[]> = new Map();
  private knowledgeQueue: KnowledgeCapture[] = [];
  private updateQueue: SOPUpdate[] = [];
  private initialized: boolean = false;
  private readonly EMBEDDING_MODEL = 'text-embedding-3-small';
  private readonly CHAT_MODEL = 'gpt-4o';
  private readonly LEARNING_MODEL = 'gpt-4o'; // For analyzing patterns and suggesting updates
  private readonly SIMILARITY_THRESHOLD = 0.7;
  private readonly KNOWLEDGE_CONFIDENCE_THRESHOLD = 0.8;
  private readonly UPDATE_BATCH_SIZE = 10;
  
  constructor() {
    super();
    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      });
      this.initializeDocuments();
      this.startLearningLoop();
    }
  }

  // === KNOWLEDGE CAPTURE METHODS ===

  /**
   * Capture knowledge from Slack interactions
   */
  async captureFromSlack(data: {
    userQuery: string;
    agentResponse: string;
    resolvedSuccessfully: boolean;
    threadTs: string;
    responderId: string;
    metadata?: any;
  }): Promise<void> {
    try {
      // Determine which assistant this should belong to
      const assistant = await this.classifyQuery(data.userQuery);
      
      const capture: KnowledgeCapture = {
        id: `slack-${data.threadTs}`,
        source: 'slack',
        query: data.userQuery,
        response: data.agentResponse,
        assistant,
        confidence: data.resolvedSuccessfully ? 0.9 : 0.5,
        verified: false,
        created_at: new Date(),
        metadata: {
          ...data.metadata,
          threadTs: data.threadTs,
          responderId: data.responderId
        }
      };

      // Store in database
      await this.storeKnowledgeCapture(capture);
      
      // Add to processing queue
      this.knowledgeQueue.push(capture);
      
      logger.info('Captured knowledge from Slack', {
        assistant,
        confidence: capture.confidence,
        queryPreview: data.userQuery.substring(0, 50)
      });

      // Emit event for monitoring
      this.emit('knowledge:captured', capture);
      
    } catch (error) {
      logger.error('Failed to capture Slack knowledge:', error);
    }
  }

  /**
   * Capture knowledge from chat interactions
   */
  async captureFromChat(data: {
    query: string;
    llmResponse: any;
    userFeedback?: 'positive' | 'negative';
    route: string;
    sessionId: string;
  }): Promise<void> {
    try {
      const capture: KnowledgeCapture = {
        id: `chat-${data.sessionId}-${Date.now()}`,
        source: 'chat',
        query: data.query,
        response: data.llmResponse.response || '',
        assistant: this.normalizeAssistant(data.route),
        confidence: this.calculateCaptureConfidence(data),
        verified: false,
        created_at: new Date(),
        metadata: {
          sessionId: data.sessionId,
          userFeedback: data.userFeedback,
          llmConfidence: data.llmResponse.confidence
        }
      };

      await this.storeKnowledgeCapture(capture);
      this.knowledgeQueue.push(capture);

      this.emit('knowledge:captured', capture);
      
    } catch (error) {
      logger.error('Failed to capture chat knowledge:', error);
    }
  }

  /**
   * Capture knowledge from resolved tickets
   */
  async captureFromTicket(data: {
    ticketId: string;
    title: string;
    description: string;
    resolution: string;
    category: string;
    resolvedBy: string;
  }): Promise<void> {
    try {
      const assistant = this.categoryToAssistant(data.category);
      
      const capture: KnowledgeCapture = {
        id: `ticket-${data.ticketId}`,
        source: 'ticket',
        query: `${data.title}: ${data.description}`,
        response: data.resolution,
        assistant,
        confidence: 0.85, // Tickets are usually well-verified
        verified: true,
        created_at: new Date(),
        verified_by: data.resolvedBy,
        metadata: {
          ticketId: data.ticketId,
          category: data.category
        }
      };

      await this.storeKnowledgeCapture(capture);
      this.knowledgeQueue.push(capture);

      this.emit('knowledge:captured', capture);
      
    } catch (error) {
      logger.error('Failed to capture ticket knowledge:', error);
    }
  }

  // === LEARNING & ANALYSIS METHODS ===

  /**
   * Main learning loop - runs periodically to process captured knowledge
   */
  private async startLearningLoop() {
    setInterval(async () => {
      if (this.knowledgeQueue.length >= this.UPDATE_BATCH_SIZE) {
        await this.processKnowledgeQueue();
      }
    }, 300000); // Every 5 minutes

    // Also process when queue gets large
    setInterval(async () => {
      if (this.knowledgeQueue.length >= 50) {
        await this.processKnowledgeQueue();
      }
    }, 60000); // Every minute
  }

  /**
   * Process queued knowledge captures to identify patterns and suggest updates
   */
  private async processKnowledgeQueue(): Promise<void> {
    if (this.knowledgeQueue.length === 0) return;

    logger.info(`Processing ${this.knowledgeQueue.length} knowledge captures`);

    try {
      // Group by assistant
      const groupedCaptures = this.groupKnowledgeByAssistant(this.knowledgeQueue);

      for (const [assistant, captures] of Object.entries(groupedCaptures)) {
        await this.analyzeAndSuggestUpdates(assistant, captures);
      }

      // Clear processed items
      this.knowledgeQueue = [];

      // Process any pending updates
      if (this.updateQueue.length > 0) {
        await this.processUpdateQueue();
      }

    } catch (error) {
      logger.error('Failed to process knowledge queue:', error);
    }
  }

  /**
   * Analyze captured knowledge and suggest SOP updates
   */
  private async analyzeAndSuggestUpdates(
    assistant: string, 
    captures: KnowledgeCapture[]
  ): Promise<void> {
    try {
      // Find patterns and gaps in current SOPs
      const analysis = await this.analyzeKnowledgeGaps(assistant, captures);

      // For each identified gap or improvement
      for (const gap of analysis.gaps) {
        // Find the best matching SOP document
        const targetDoc = await this.findBestMatchingDocument(gap.topic, assistant);

        if (targetDoc) {
          // Generate update suggestion
          const update = await this.generateSOPUpdate(targetDoc, gap, captures);

          if (update.confidence >= this.KNOWLEDGE_CONFIDENCE_THRESHOLD) {
            this.updateQueue.push(update);
            this.emit('update:suggested', update);
          }
        } else {
          // Suggest creating a new SOP
          await this.suggestNewSOP(assistant, gap, captures);
        }
      }

    } catch (error) {
      logger.error('Failed to analyze and suggest updates:', error);
    }
  }

  /**
   * Use GPT-4 to analyze knowledge gaps
   */
  private async analyzeKnowledgeGaps(
    assistant: string,
    captures: KnowledgeCapture[]
  ): Promise<{
    gaps: Array<{
      topic: string;
      frequency: number;
      examples: string[];
      suggestedContent: string;
    }>;
  }> {
    const prompt = `Analyze these customer interactions to identify knowledge gaps in our SOPs:

Assistant: ${assistant}
Number of interactions: ${captures.length}

Interactions:
${captures.slice(0, 20).map((c, i) => `${i + 1}. Query: ${c.query}
   Response: ${c.response}
   Confidence: ${c.confidence}`).join('

')}

Identify:
1. Common topics not well covered in current SOPs
2. Patterns in questions that need better documentation
3. Suggested content to add

Respond in JSON format:
{
  "gaps": [
    {
      "topic": "string",
      "frequency": number,
      "examples": ["query examples"],
      "suggestedContent": "string"
    }
  ]
}`;

    try {
      const completion = await this.openai.chat.completions.create({
        model: this.LEARNING_MODEL,
        messages: [
          { role: "system", content: "You are an AI analyzing customer service interactions to improve SOPs." },
          { role: "user", content: prompt }
        ],
        temperature: 0.3,
        response_format: { type: "json_object" }
      });

      const analysis = JSON.parse(completion.choices[0].message.content || '{}');
      return analysis;

    } catch (error) {
      logger.error('Failed to analyze knowledge gaps:', error);
      return { gaps: [] };
    }
  }

  /**
   * Generate an SOP update based on identified gaps
   */
  private async generateSOPUpdate(
    targetDoc: SOPDocument,
    gap: any,
    captures: KnowledgeCapture[]
  ): Promise<SOPUpdate> {
    const relevantCaptures = captures.filter(c => 
      c.query.toLowerCase().includes(gap.topic.toLowerCase())
    );

    const prompt = `Generate an updated version of this SOP section based on real customer interactions:

Current SOP:
${targetDoc.content}

Identified Gap:
Topic: ${gap.topic}
Suggested Addition: ${gap.suggestedContent}

Real Examples from Support:
${relevantCaptures.slice(0, 5).map(c => `Q: ${c.query}\nA: ${c.response}`).join('\n\n')}

Generate an updated version that:
1. Preserves the existing useful content
2. Adds new information to address the gap
3. Maintains the same tone and format
4. Includes specific examples where helpful

Respond with the complete updated text.`;

    try {
      const completion = await this.openai.chat.completions.create({
        model: this.LEARNING_MODEL,
        messages: [
          { role: "system", content: "You are updating SOPs based on real support interactions. Maintain professional tone and clear structure." },
          { role: "user", content: prompt }
        ],
        temperature: 0.3
      });

      const suggestedContent = completion.choices[0].message.content || '';

      return {
        documentId: targetDoc.id,
        originalContent: targetDoc.content,
        suggestedContent,
        reason: `Addressing knowledge gap: ${gap.topic} (${gap.frequency} occurrences)`,
        confidence: 0.85,
        sources: relevantCaptures.map(c => c.id)
      };

    } catch (error) {
      logger.error('Failed to generate SOP update:', error);
      throw error;
    }
  }

  /**
   * Suggest creating a new SOP for uncovered topics
   */
  private async suggestNewSOP(
    assistant: string,
    gap: any,
    captures: KnowledgeCapture[]
  ): Promise<void> {
    const newSOP = {
      assistant,
      title: gap.topic,
      content: gap.suggestedContent,
      metadata: {
        autoGenerated: true,
        sources: captures.map(c => c.id),
        createdFrom: 'knowledge_gaps',
        confidence: 0.7
      }
    };

    // Store as a draft for review
    await this.storeDraftSOP(newSOP);
    
    this.emit('sop:draft_created', newSOP);
    
    logger.info('Created draft SOP for new topic', {
      assistant,
      topic: gap.topic
    });
  }

  // === UPDATE PROCESSING METHODS ===

  /**
   * Process queued SOP updates
   */
  private async processUpdateQueue(): Promise<void> {
    const updates = [...this.updateQueue];
    this.updateQueue = [];

    for (const update of updates) {
      try {
        // For high confidence updates, apply automatically
        if (update.confidence >= 0.9 && process.env.AUTO_APPLY_UPDATES === 'true') {
          await this.applySOPUpdate(update);
        } else {
          // Store for human review
          await this.storeUpdateForReview(update);
        }
      } catch (error) {
        logger.error('Failed to process update:', error);
      }
    }
  }

  /**
   * Apply an SOP update to the filesystem and database
   */
  private async applySOPUpdate(update: SOPUpdate): Promise<void> {
    try {
      // Find the file path
      const doc = await this.findDocumentById(update.documentId);
      if (!doc || !doc.metadata?.source) {
        throw new Error('Document not found or missing source');
      }

      const filePath = doc.metadata.source;
      const fullPath = path.join(__dirname, '../../..', filePath);

      // Create backup
      const backupPath = fullPath + `.backup.${Date.now()}`;
      const currentContent = await fs.readFile(fullPath, 'utf-8');
      await fs.writeFile(backupPath, currentContent);

      // Apply update
      await fs.writeFile(fullPath, update.suggestedContent);

      // Re-embed the updated document
      await this.refreshDocument(filePath);

      // Log the update
      await this.logSOPUpdate({
        ...update,
        applied: true,
        appliedAt: new Date(),
        backupPath
      });

      this.emit('sop:updated', {
        documentId: update.documentId,
        filePath,
        reason: update.reason
      });

      logger.info('Applied SOP update', {
        documentId: update.documentId,
        reason: update.reason
      });

    } catch (error) {
      logger.error('Failed to apply SOP update:', error);
      throw error;
    }
  }

  // === SLACK INTEGRATION METHODS ===

  /**
   * Learn from Slack thread resolution
   */
  async learnFromSlackResolution(data: {
    threadTs: string;
    originalQuery: string;
    finalResolution: string;
    wasHelpful: boolean;
    resolver: string;
  }): Promise<void> {
    await this.captureFromSlack({
      userQuery: data.originalQuery,
      agentResponse: data.finalResolution,
      resolvedSuccessfully: data.wasHelpful,
      threadTs: data.threadTs,
      responderId: data.resolver,
      metadata: {
        resolutionQuality: data.wasHelpful ? 'good' : 'needs_improvement'
      }
    });
  }

  // === CLAUDE INTEGRATION METHODS ===

  /**
   * Get pending updates for Claude to review
   */
  async getPendingUpdatesForReview(): Promise<any[]> {
    if (!db.initialized) return [];

    try {
      const result = await db.query(`
        SELECT * FROM sop_update_queue 
        WHERE status = 'pending_review'
        ORDER BY confidence DESC, created_at ASC
        LIMIT 10
      `);

      return result.rows;
    } catch (error) {
      logger.error('Failed to get pending updates:', error);
      return [];
    }
  }

  /**
   * Claude approves/modifies an update
   */
  async reviewUpdate(updateId: string, decision: {
    approved: boolean;
    modifiedContent?: string;
    reviewNotes?: string;
  }): Promise<void> {
    if (!db.initialized) return;

    try {
      if (decision.approved) {
        // Get the update
        const result = await db.query(
          'SELECT * FROM sop_update_queue WHERE id = $1',
          [updateId]
        );

        if (result.rows.length > 0) {
          const update = result.rows[0];
          
          // Apply with modifications if provided
          if (decision.modifiedContent) {
            update.suggestedContent = decision.modifiedContent;
          }

          await this.applySOPUpdate(update);
        }
      }

      // Update status
      await db.query(`
        UPDATE sop_update_queue 
        SET status = $2, 
            reviewed_at = NOW(), 
            review_notes = $3
        WHERE id = $1
      `, [
        updateId,
        decision.approved ? 'approved' : 'rejected',
        decision.reviewNotes
      ]);

    } catch (error) {
      logger.error('Failed to review update:', error);
      throw error;
    }
  }

  // === HELPER METHODS ===

  private async classifyQuery(query: string): Promise<string> {
    // Use embeddings to find best matching assistant
    const embedding = await this.getEmbedding(query);
    let bestMatch = { assistant: 'tech', similarity: 0 };

    for (const [assistant, docs] of this.documentsCache) {
      for (const doc of docs) {
        if (doc.embedding) {
          const similarity = this.cosineSimilarity(embedding, doc.embedding);
          if (similarity > bestMatch.similarity) {
            bestMatch = { assistant, similarity };
          }
        }
      }
    }

    return bestMatch.assistant;
  }

  private calculateCaptureConfidence(data: any): number {
    let confidence = 0.5;

    // Positive factors
    if (data.userFeedback === 'positive') confidence += 0.3;
    if (data.llmResponse?.confidence > 0.8) confidence += 0.1;
    if (data.verified) confidence += 0.2;

    // Negative factors  
    if (data.userFeedback === 'negative') confidence -= 0.3;
    if (data.llmResponse?.confidence < 0.5) confidence -= 0.1;

    return Math.max(0, Math.min(1, confidence));
  }

  private categoryToAssistant(category: string): string {
    const mapping: Record<string, string> = {
      'tech': 'tech',
      'facilities': 'tech',
      'booking': 'booking',
      'access': 'booking',
      'emergency': 'emergency',
      'safety': 'emergency',
      'brand': 'brand',
      'marketing': 'brand'
    };
    return mapping[category.toLowerCase()] || 'tech';
  }

  private groupKnowledgeByAssistant(captures: KnowledgeCapture[]): Record<string, KnowledgeCapture[]> {
    return captures.reduce((acc, capture) => {
      if (!acc[capture.assistant]) acc[capture.assistant] = [];
      acc[capture.assistant].push(capture);
      return acc;
    }, {} as Record<string, KnowledgeCapture[]>);
  }

  private async findBestMatchingDocument(topic: string, assistant: string): Promise<SOPDocument | null> {
    const docs = this.documentsCache.get(assistant) || [];
    const topicEmbedding = await this.getEmbedding(topic);

    let bestMatch: { doc: SOPDocument; similarity: number } | null = null;

    for (const doc of docs) {
      if (doc.embedding) {
        const similarity = this.cosineSimilarity(topicEmbedding, doc.embedding);
        if (similarity > 0.6 && (!bestMatch || similarity > bestMatch.similarity)) {
          bestMatch = { doc, similarity };
        }
      }
    }

    return bestMatch?.doc || null;
  }

  // === DATABASE METHODS ===

  private async storeKnowledgeCapture(capture: KnowledgeCapture): Promise<void> {
    if (!db.initialized) return;

    try {
      await db.query(`
        INSERT INTO knowledge_captures 
        (id, source, query, response, assistant, confidence, verified, created_at, verified_by, metadata)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (id) DO UPDATE SET
          response = EXCLUDED.response,
          confidence = EXCLUDED.confidence,
          verified = EXCLUDED.verified,
          verified_by = EXCLUDED.verified_by,
          metadata = EXCLUDED.metadata
      `, [
        capture.id,
        capture.source,
        capture.query,
        capture.response,
        capture.assistant,
        capture.confidence,
        capture.verified,
        capture.created_at,
        capture.verified_by,
        JSON.stringify(capture.metadata || {})
      ]);
    } catch (error) {
      logger.error('Failed to store knowledge capture:', error);
    }
  }

  private async storeUpdateForReview(update: SOPUpdate): Promise<void> {
    if (!db.initialized) return;

    try {
      await db.query(`
        INSERT INTO sop_update_queue
        (document_id, original_content, suggested_content, reason, confidence, sources, status)
        VALUES ($1, $2, $3, $4, $5, $6, 'pending_review')
      `, [
        update.documentId,
        update.originalContent,
        update.suggestedContent,
        update.reason,
        update.confidence,
        JSON.stringify(update.sources)
      ]);

      this.emit('update:pending_review', update);
    } catch (error) {
      logger.error('Failed to store update for review:', error);
    }
  }

  private async storeDraftSOP(sop: any): Promise<void> {
    if (!db.initialized) return;

    try {
      await db.query(`
        INSERT INTO sop_drafts
        (assistant, title, content, metadata, status)
        VALUES ($1, $2, $3, $4, 'draft')
      `, [
        sop.assistant,
        sop.title,
        sop.content,
        JSON.stringify(sop.metadata)
      ]);
    } catch (error) {
      logger.error('Failed to store draft SOP:', error);
    }
  }

  private async logSOPUpdate(update: any): Promise<void> {
    if (!db.initialized) return;

    try {
      await db.query(`
        INSERT INTO sop_update_log
        (document_id, reason, sources, applied_at, backup_path)
        VALUES ($1, $2, $3, $4, $5)
      `, [
        update.documentId,
        update.reason,
        JSON.stringify(update.sources),
        update.appliedAt,
        update.backupPath
      ]);
    } catch (error) {
      logger.error('Failed to log SOP update:', error);
    }
  }

  // Inherit required methods from parent class
  private async initializeDocuments() {
    // Inherited from IntelligentSOPModule
  }

  private async getEmbedding(text: string): Promise<number[]> {
    // Inherited from IntelligentSOPModule
    return [];
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    // Inherited from IntelligentSOPModule
    return 0;
  }

  private async refreshDocument(filePath: string): Promise<void> {
    // Inherited from IntelligentSOPModule
  }

  private async findDocumentById(id: string): Promise<SOPDocument | null> {
    for (const [_, docs] of this.documentsCache) {
      const found = docs.find(d => d.id === id);
      if (found) return found;
    }
    return null;
  }

  private normalizeAssistant(route: string): string {
    const mapping: Record<string, string> = {
      'Booking & Access': 'booking',
      'Emergency': 'emergency',
      'TechSupport': 'tech',
      'BrandTone': 'brand'
    };
    return mapping[route] || route.toLowerCase();
  }
}

// Export singleton instance
export const learningSOPModule = new LearningSOPModule();