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

interface SOPResponse {
  response: string;
  confidence: number;
  source: 'sop_gpt4o' | 'no_match' | 'error';
  structured?: any;
}

export class IntelligentSOPModule {
  private openai: OpenAI;
  private documentsCache: Map<string, SOPDocument[]> = new Map();
  private initialized: boolean = false;
  private readonly EMBEDDING_MODEL = 'text-embedding-3-small';
  private readonly CHAT_MODEL = 'gpt-4o';
  private readonly SIMILARITY_THRESHOLD = 0.7;
  private readonly TOP_K_DOCUMENTS = 5;
  
  constructor() {
    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      });
      this.initializeDocuments();
    } else {
      logger.warn('IntelligentSOPModule: OpenAI API key not configured');
    }
  }

  private async initializeDocuments() {
    try {
      // Define document structure matching your actual files
      const assistantDocs = {
        'emergency': [
          'assistant-instructions/emergency-assistant.md',
          'ClubOS Agents/EmergencyBot/Emergency_Procedures_Binder.md',
          'ClubOS Agents/EmergencyBot/Escalation_Contacts.md'
        ],
        'tech': [
          'assistant-instructions/tech-support-assistant.md',
          'ClubOS Agents/TechSupportBot/Simulator_Troubleshooting.md',
          'ClubOS Agents/TechSupportBot/Hardware_Reset_SOPs.md',
          'ClubOS Agents/TechSupportBot/Technical_FAQs.md'
        ],
        'booking': [
          'assistant-instructions/booking-assistant.md',
          'ClubOS Agents/Booking & AccessBot/Booking_SOPs.md',
          'ClubOS Agents/Booking & AccessBot/Access_Control_Troubleshooting.md',
          'ClubOS Agents/Booking & AccessBot/Refund_Credit_Policies.md',
          'ClubOS Agents/Booking & AccessBot/Membership_Guidelines.md'
        ],
        'brand': [
          'assistant-instructions/brand-assistant.md',
          'ClubOS Agents/BrandTone & MarketingBot/Brand_Guidelines.md',
          'ClubOS Agents/BrandTone & MarketingBot/Customer_Tone_Standards.md',
          'ClubOS Agents/BrandTone & MarketingBot/Marketing_Content_Archive.md'
        ]
      };

      // Try to load from database first
      const cachedDocs = await this.loadFromDatabase();
      if (cachedDocs.size > 0) {
        this.documentsCache = cachedDocs;
        this.initialized = true;
        logger.info('Loaded SOP embeddings from database');
        return;
      }

      // Generate embeddings for all documents
      logger.info('Initializing SOP document embeddings...');
      for (const [assistant, files] of Object.entries(assistantDocs)) {
        const docs = await this.loadAndEmbedDocuments(assistant, files);
        this.documentsCache.set(assistant, docs);
      }

      // Persist to database
      await this.persistEmbeddings();
      this.initialized = true;
      logger.info('SOP document embeddings initialized successfully');

    } catch (error) {
      logger.error('Failed to initialize SOP documents:', error);
      this.initialized = false;
    }
  }

  private async loadFromDatabase(): Promise<Map<string, SOPDocument[]>> {
    const cache = new Map<string, SOPDocument[]>();
    
    if (!db.initialized) return cache;
    
    try {
      const result = await db.query(`
        SELECT * FROM sop_embeddings 
        ORDER BY assistant, id
      `);
      
      for (const row of result.rows) {
        const doc: SOPDocument = {
          id: row.id,
          assistant: row.assistant,
          title: row.title,
          content: row.content,
          embedding: JSON.parse(row.embedding),
          metadata: row.metadata
        };
        
        const existing = cache.get(row.assistant) || [];
        existing.push(doc);
        cache.set(row.assistant, existing);
      }
      
      return cache;
      
    } catch (error) {
      logger.warn('Could not load embeddings from database:', error);
      return cache;
    }
  }

  private async loadAndEmbedDocuments(
    assistant: string, 
    filePaths: string[]
  ): Promise<SOPDocument[]> {
    const documents: SOPDocument[] = [];
    
    // In both development and production, files are now in src/ directory
    const projectRoot = __dirname.includes('dist/services') 
      ? path.join(__dirname, '../..') // Production: dist/services -> dist
      : path.join(__dirname, '..'); // Development: src/services -> src
    
    for (const filePath of filePaths) {
      try {
        const fullPath = path.join(projectRoot, filePath);
        const content = await fs.readFile(fullPath, 'utf-8');
        
        // Skip empty files
        if (!content.trim()) continue;
        
        // Smart chunking for long documents
        const chunks = this.chunkDocument(content, filePath);
        
        for (const chunk of chunks) {
          try {
            const embedding = await this.getEmbedding(chunk.text);
            
            documents.push({
              id: `${filePath}-chunk${chunk.index}`,
              assistant,
              title: chunk.title || path.basename(filePath, '.md'),
              content: chunk.text,
              embedding,
              metadata: {
                source: filePath,
                chunkIndex: chunk.index,
                totalChunks: chunks.length,
                isSystemInstruction: filePath.includes('assistant-instructions')
              }
            });
          } catch (embeddingError) {
            logger.error(`Failed to embed chunk ${chunk.index} of ${filePath}:`, embeddingError);
          }
        }
      } catch (error) {
        logger.warn(`Could not load document ${filePath}:`, error);
      }
    }
    
    return documents;
  }

  private chunkDocument(
    content: string, 
    filePath: string
  ): Array<{text: string, title?: string, index: number}> {
    const lines = content.split('\n');
    const chunks: Array<{text: string, title?: string, index: number}> = [];
    let currentChunk: string[] = [];
    let currentTitle = '';
    let chunkIndex = 0;
    const MAX_CHUNK_SIZE = 2500; // Roughly 600-700 tokens
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Detect markdown headers
      if (line.match(/^#{1,3}\s+/)) {
        // Save current chunk if it has content
        if (currentChunk.length > 0 && currentChunk.join('\n').trim()) {
          chunks.push({
            text: currentChunk.join('\n').trim(),
            title: currentTitle || path.basename(filePath, '.md'),
            index: chunkIndex++
          });
          currentChunk = [];
        }
        currentTitle = line.replace(/^#+\s*/, '').trim();
      }
      
      currentChunk.push(line);
      
      // Check chunk size
      if (currentChunk.join('\n').length > MAX_CHUNK_SIZE) {
        // Find a good break point (paragraph or line break)
        let breakPoint = currentChunk.length - 1;
        for (let j = currentChunk.length - 1; j > currentChunk.length / 2; j--) {
          if (currentChunk[j] === '') {
            breakPoint = j;
            break;
          }
        }
        
        // Save chunk up to break point
        const chunkText = currentChunk.slice(0, breakPoint).join('\n').trim();
        if (chunkText) {
          chunks.push({
            text: chunkText,
            title: currentTitle || path.basename(filePath, '.md'),
            index: chunkIndex++
          });
        }
        
        // Start new chunk with overlap
        currentChunk = [currentTitle, ...currentChunk.slice(breakPoint)];
      }
    }
    
    // Save final chunk
    const finalText = currentChunk.join('\n').trim();
    if (finalText) {
      chunks.push({
        text: finalText,
        title: currentTitle || path.basename(filePath, '.md'),
        index: chunkIndex
      });
    }
    
    return chunks.length > 0 ? chunks : [{text: content, title: path.basename(filePath, '.md'), index: 0}];
  }

  private async getEmbedding(text: string): Promise<number[]> {
    try {
      const response = await this.openai.embeddings.create({
        model: this.EMBEDDING_MODEL,
        input: text.slice(0, 8000), // Model max is 8191 tokens
      });
      
      return response.data[0].embedding;
    } catch (error) {
      logger.error('Failed to generate embedding:', error);
      throw error;
    }
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    
    if (normA === 0 || normB === 0) return 0;
    
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  async findRelevantContext(
    query: string, 
    assistant: string, 
    topK: number = this.TOP_K_DOCUMENTS
  ): Promise<SOPDocument[]> {
    if (!this.initialized || !this.openai) {
      return [];
    }
    
    try {
      const startTime = Date.now();
      
      // Get query embedding
      logger.info('Generating query embedding...');
      const embeddingStart = Date.now();
      const queryEmbedding = await this.getEmbedding(query);
      logger.info(`Query embedding generated in ${Date.now() - embeddingStart}ms`);
      
      // Get documents for this assistant
      const normalizedAssistant = this.normalizeAssistant(assistant);
      const documents = this.documentsCache.get(normalizedAssistant) || [];
      
      if (documents.length === 0) {
        logger.warn(`No documents found for assistant: ${assistant}`);
        return [];
      }
      
      // Calculate similarities
      const similarities = documents.map(doc => ({
        doc,
        similarity: doc.embedding ? this.cosineSimilarity(queryEmbedding, doc.embedding) : 0
      }));
      
      // Sort by similarity and filter
      const relevant = similarities
        .sort((a, b) => b.similarity - a.similarity)
        .filter(s => s.similarity > this.SIMILARITY_THRESHOLD)
        .slice(0, topK)
        .map(s => s.doc);
      
      logger.info(`Found ${relevant.length} relevant documents for query`, {
        assistant,
        queryPreview: query.substring(0, 50),
        topSimilarity: similarities[0]?.similarity || 0
      });
      
      return relevant;
      
    } catch (error) {
      logger.error('Failed to find relevant context:', error);
      return [];
    }
  }

  async processWithContext(
    query: string,
    assistant: string,
    context?: any
  ): Promise<SOPResponse> {
    if (!this.initialized || !this.openai) {
      return {
        response: '',
        confidence: 0,
        source: 'error'
      };
    }
    
    try {
      const totalStart = Date.now();
      
      // Find relevant documents
      logger.info('Finding relevant documents...');
      const docStart = Date.now();
      const relevantDocs = await this.findRelevantContext(query, assistant);
      logger.info(`Found ${relevantDocs.length} relevant docs in ${Date.now() - docStart}ms`);
      
      if (relevantDocs.length === 0) {
        logger.info('No relevant SOP documents found', { assistant, query });
        return {
          response: '',
          confidence: 0,
          source: 'no_match'
        };
      }
      
      // Build context-aware prompt
      const systemPrompt = this.buildSystemPrompt(assistant, relevantDocs);
      
      // Add context to user query if provided
      let contextualQuery = query;
      if (context?.location) {
        contextualQuery += `\n\nContext: Location is ${context.location}`;
      }
      
      // Call GPT-4o with context
      logger.info('Calling GPT-4o...');
      const gptStart = Date.now();
      const completion = await this.openai.chat.completions.create({
        model: this.CHAT_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: contextualQuery }
        ],
        temperature: 0.3,
        max_tokens: 1000,
        response_format: { type: "json_object" }
      });
      logger.info(`GPT-4o responded in ${Date.now() - gptStart}ms`);
      
      const responseContent = completion.choices[0].message.content || '';
      
      // Parse JSON response
      let structured;
      try {
        structured = JSON.parse(responseContent);
      } catch (parseError) {
        logger.error('Failed to parse GPT-4o JSON response:', parseError);
        logger.error('Raw response:', responseContent);
        
        // Fallback: create basic structure
        structured = {
          response: responseContent,
          category: 'general',
          priority: 'medium'
        };
      }
      
      // Calculate confidence based on document relevance and match count
      const avgSimilarity = relevantDocs.reduce((sum, doc, idx) => {
        const weight = 1 / (idx + 1); // Higher weight for more relevant docs
        return sum + (this.documentsCache.get(this.normalizeAssistant(assistant))
          ?.find(d => d.id === doc.id) ? weight * 0.8 : 0) || 0;
      }, 0);
      
      const confidence = Math.min(0.95, 0.7 + avgSimilarity * 0.25);
      
      logger.info(`Total SOP processing time: ${Date.now() - totalStart}ms`);
      
      return {
        response: structured.response || responseContent,
        confidence,
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
    // Separate system instructions from SOPs
    const systemInstruction = documents.find(d => d.metadata?.isSystemInstruction);
    const sops = documents.filter(d => !d.metadata?.isSystemInstruction);
    
    let prompt = '';
    
    // Add base system instruction
    if (systemInstruction) {
      prompt += systemInstruction.content + '\n\n';
    } else {
      // Fallback instructions
      prompt += this.getDefaultSystemInstruction(assistant) + '\n\n';
    }
    
    // Add relevant SOPs as context
    if (sops.length > 0) {
      prompt += '## RELEVANT STANDARD OPERATING PROCEDURES:\n\n';
      
      for (const sop of sops) {
        prompt += `### ${sop.title}\n`;
        prompt += `${sop.content}\n\n`;
      }
      
      prompt += '---\n\n';
    }
    
    // Reinforce JSON formatting
    prompt += 'CRITICAL: You MUST respond with valid JSON only. No markdown, no code blocks, just pure JSON starting with { and ending with }.\n';
    prompt += 'Use the SOPs above as your knowledge base to answer the user\'s question accurately.\n';
    
    return prompt;
  }

  private getDefaultSystemInstruction(assistant: string): string {
    const defaults: Record<string, string> = {
      'emergency': 'You are the Emergency Response Assistant. Prioritize safety, provide clear action steps, and maintain a calm but urgent tone.',
      'tech': 'You are the Technical Support Assistant. Provide step-by-step troubleshooting guidance and be specific about technical procedures.',
      'booking': 'You are the Booking & Access Assistant. Help with reservations, access issues, and customer service matters professionally.',
      'brand': 'You are the Brand & Marketing Assistant. Maintain brand voice while creating engaging customer communications.'
    };
    
    return defaults[assistant] || 'You are a helpful assistant. Provide accurate and professional responses.';
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

  async persistEmbeddings(): Promise<void> {
    if (!db.initialized) {
      logger.warn('Database not initialized, cannot persist embeddings');
      return;
    }
    
    try {
      // Ensure table exists
      await db.query(`
        CREATE TABLE IF NOT EXISTS sop_embeddings (
          id VARCHAR(255) PRIMARY KEY,
          assistant VARCHAR(50) NOT NULL,
          title VARCHAR(255) NOT NULL,
          content TEXT NOT NULL,
          embedding TEXT NOT NULL,
          metadata JSONB DEFAULT '{}',
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `);
      
      // Create indexes
      await db.query(`CREATE INDEX IF NOT EXISTS idx_sop_embeddings_assistant ON sop_embeddings(assistant)`);
      
      // Persist all documents
      for (const [assistant, docs] of this.documentsCache) {
        for (const doc of docs) {
          if (doc.embedding) {
            await db.query(`
              INSERT INTO sop_embeddings (id, assistant, title, content, embedding, metadata)
              VALUES ($1, $2, $3, $4, $5, $6)
              ON CONFLICT (id) DO UPDATE SET
                content = EXCLUDED.content,
                embedding = EXCLUDED.embedding,
                metadata = EXCLUDED.metadata,
                updated_at = NOW()
            `, [
              doc.id,
              assistant,
              doc.title,
              doc.content,
              JSON.stringify(doc.embedding),
              doc.metadata || {}
            ]);
          }
        }
      }
      
      logger.info('Successfully persisted SOP embeddings to database');
      
    } catch (error) {
      logger.error('Failed to persist embeddings:', error);
    }
  }

  // Admin method to refresh specific documents
  async refreshDocument(filePath: string): Promise<void> {
    logger.info('Refreshing document:', filePath);
    
    // Find which assistant this belongs to
    let targetAssistant: string | null = null;
    for (const [assistant, docs] of this.documentsCache) {
      if (docs.some(d => d.metadata?.source === filePath)) {
        targetAssistant = assistant;
        break;
      }
    }
    
    if (!targetAssistant) {
      logger.warn('Document not found in cache:', filePath);
      return;
    }
    
    // Re-embed the document
    const newDocs = await this.loadAndEmbedDocuments(targetAssistant, [filePath]);
    
    // Update cache
    const existingDocs = this.documentsCache.get(targetAssistant) || [];
    const filteredDocs = existingDocs.filter(d => d.metadata?.source !== filePath);
    this.documentsCache.set(targetAssistant, [...filteredDocs, ...newDocs]);
    
    // Persist to database
    await this.persistEmbeddings();
    
    logger.info('Document refreshed successfully:', filePath);
  }

  // Get module status
  getStatus(): {
    initialized: boolean;
    documentCount: number;
    assistants: string[];
  } {
    const documentCount = Array.from(this.documentsCache.values())
      .reduce((sum, docs) => sum + docs.length, 0);
    
    return {
      initialized: this.initialized,
      documentCount,
      assistants: Array.from(this.documentsCache.keys())
    };
  }

  // Get loaded documents for debugging
  getLoadedDocuments() {
    const docs: Record<string, any> = {};
    
    for (const [assistant, documents] of this.documentsCache.entries()) {
      docs[assistant] = documents.map(doc => ({
        id: doc.id,
        title: doc.title,
        contentLength: doc.content.length,
        contentPreview: doc.content.substring(0, 200) + '...',
        hasEmbedding: !!doc.embedding,
        metadata: doc.metadata
      }));
    }
    
    return docs;
  }

  // Refresh document cache from database
  async refreshDocumentCache() {
    try {
      logger.info('Refreshing SOP document cache...');
      
      // Clear current cache
      this.documentsCache.clear();
      
      // Reload from database
      const cachedDocs = await this.loadFromDatabase();
      this.documentsCache = cachedDocs;
      
      logger.info(`SOP cache refreshed: ${this.getTotalDocumentCount()} documents loaded`);
      
    } catch (error) {
      logger.error('Failed to refresh SOP cache:', error);
      throw error;
    }
  }

  // Get total document count across all assistants
  private getTotalDocumentCount(): number {
    return Array.from(this.documentsCache.values())
      .reduce((sum, docs) => sum + docs.length, 0);
  }
}

// Export singleton instance
export const intelligentSOPModule = new IntelligentSOPModule();
