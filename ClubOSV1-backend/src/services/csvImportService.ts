/**
 * CSV Import Service for V3-PLS Pattern Learning
 * Handles large-scale imports with background processing
 */

import { db } from '../utils/database';
import { logger } from '../utils/logger';
import OpenAI from 'openai';
import { v4 as uuidv4 } from 'uuid';

interface ImportJob {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  totalMessages: number;
  processedMessages: number;
  conversationsFound: number;
  conversationsAnalyzed: number;
  patternsCreated: number;
  patternsEnhanced: number;
  errors: string[];
  startedAt: Date;
  completedAt?: Date;
  userId: string;
}

interface MessageData {
  id: string;
  body: string;
  direction: string;
  from: string;
  to: string;
  sentAt: string;
}

class CSVImportService {
  private activeJobs: Map<string, ImportJob> = new Map();
  private openai: OpenAI;
  
  constructor() {
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  /**
   * Start a CSV import job
   */
  async startImport(csvData: string, userId: string): Promise<ImportJob> {
    const jobId = uuidv4();
    
    // Parse CSV to count messages
    const messages = this.parseCSV(csvData);
    
    const job: ImportJob = {
      id: jobId,
      status: 'pending',
      totalMessages: messages.length,
      processedMessages: 0,
      conversationsFound: 0,
      conversationsAnalyzed: 0,
      patternsCreated: 0,
      patternsEnhanced: 0,
      errors: [],
      startedAt: new Date(),
      userId
    };
    
    this.activeJobs.set(jobId, job);
    
    // Start processing in background
    this.processImportJob(jobId, messages).catch(error => {
      logger.error('[CSV Import] Job failed', { jobId, error });
      job.status = 'failed';
      job.errors.push(error.message);
    });
    
    return job;
  }

  /**
   * Get job status
   */
  getJobStatus(jobId: string): ImportJob | null {
    return this.activeJobs.get(jobId) || null;
  }

  /**
   * Parse CSV data with proper handling
   */
  private parseCSV(csvData: string): MessageData[] {
    const parseCSVLine = (line: string): string[] => {
      const result = [];
      let current = '';
      let inQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    };
    
    const lines = csvData.split('\n');
    const headers = parseCSVLine(lines[0]);
    
    const idCol = headers.indexOf('id');
    const bodyCol = headers.indexOf('conversationBody');
    const directionCol = headers.indexOf('direction');
    const fromCol = headers.indexOf('from');
    const toCol = headers.indexOf('to');
    const sentAtCol = headers.indexOf('sentAt');
    
    const messages: MessageData[] = [];
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const cols = parseCSVLine(line);
      if (cols.length >= headers.length) {
        messages.push({
          id: cols[idCol] || '',
          body: cols[bodyCol] || '',
          direction: cols[directionCol] || '',
          from: cols[fromCol] || '',
          to: cols[toCol] || '',
          sentAt: cols[sentAtCol] || ''
        });
      }
    }
    
    return messages;
  }

  /**
   * Process import job in chunks
   */
  private async processImportJob(jobId: string, messages: MessageData[]) {
    const job = this.activeJobs.get(jobId);
    if (!job) return;
    
    job.status = 'processing';
    
    try {
      // Sort messages chronologically
      messages.sort((a, b) => {
        const timeA = new Date(a.sentAt || 0).getTime();
        const timeB = new Date(b.sentAt || 0).getTime();
        return timeA - timeB;
      });
      
      // Group into conversations
      const conversations = this.groupConversations(messages);
      job.conversationsFound = conversations.size;
      
      // Process in batches to avoid rate limits
      const BATCH_SIZE = 10;
      const DELAY_BETWEEN_BATCHES = 2000; // 2 seconds
      const MAX_CONVERSATIONS = 500; // Safety limit
      
      const conversationArray = Array.from(conversations.values()).slice(0, MAX_CONVERSATIONS);
      
      for (let i = 0; i < conversationArray.length; i += BATCH_SIZE) {
        const batch = conversationArray.slice(i, i + BATCH_SIZE);
        
        // Process batch in parallel
        const batchPromises = batch.map(conv => this.analyzeConversation(conv));
        const patterns = await Promise.all(batchPromises);
        
        // Save patterns
        for (const pattern of patterns.flat()) {
          if (pattern) {
            const result = await this.savePattern(pattern);
            if (result.created) {
              job.patternsCreated++;
            } else if (result.enhanced) {
              job.patternsEnhanced++;
            }
          }
        }
        
        job.conversationsAnalyzed += batch.length;
        job.processedMessages = Math.min(messages.length, (i + BATCH_SIZE) * 10);
        
        // Rate limit protection
        if (i + BATCH_SIZE < conversationArray.length) {
          await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
        }
      }
      
      job.status = 'completed';
      job.completedAt = new Date();
      
      // Store job result in database for persistence
      await this.saveJobResult(job);
      
    } catch (error: any) {
      job.status = 'failed';
      job.errors.push(error.message);
      logger.error('[CSV Import] Processing failed', { jobId, error });
    }
  }

  /**
   * Group messages into conversations
   */
  private groupConversations(messages: MessageData[]): Map<string, any> {
    const conversations = new Map();
    const activeConversations = new Map();
    
    for (const msg of messages) {
      // Skip automated messages
      if (msg.body.includes('CN6cc5c67b4') || msg.body.includes('CN2cc08d4c')) continue;
      
      const convId = msg.id ? msg.id.split('_')[0].substring(0, 10) : '';
      const phoneKey = msg.direction === 'incoming' ? msg.from : msg.to;
      const timestamp = new Date(msg.sentAt || Date.now()).getTime();
      
      let convKey = convId || phoneKey;
      
      if (!convId && phoneKey) {
        const lastActivity = activeConversations.get(phoneKey);
        if (lastActivity && (timestamp - lastActivity.timestamp) < 2 * 60 * 60 * 1000) {
          convKey = lastActivity.convKey;
        } else {
          convKey = `${phoneKey}_${timestamp}`;
        }
      }
      
      activeConversations.set(phoneKey, { timestamp, convKey });
      
      if (!conversations.has(convKey)) {
        conversations.set(convKey, { 
          customer: [], 
          operator: [], 
          startTime: timestamp,
          endTime: timestamp,
          messages: []
        });
      }
      
      const conv = conversations.get(convKey);
      conv.endTime = Math.max(conv.endTime, timestamp);
      conv.messages.push({ ...msg, timestamp });
      
      if (msg.direction === 'incoming') {
        conv.customer.push(msg.body);
      } else {
        conv.operator.push(msg.body);
      }
    }
    
    return conversations;
  }

  /**
   * Analyze a single conversation with GPT-4o
   */
  private async analyzeConversation(conv: any): Promise<any[]> {
    if (conv.customer.length === 0 || conv.operator.length === 0) {
      return [];
    }
    
    try {
      const customerContext = conv.customer.slice(0, 5).join('\n');
      const operatorContext = conv.operator.slice(0, 5).join('\n');
      const duration = (conv.endTime - conv.startTime) / 1000 / 60;
      
      const completion = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `Analyze this customer service conversation and extract reusable patterns.
                    The conversation lasted ${duration.toFixed(0)} minutes with ${conv.messages.length} messages.
                    Focus on the main issue and resolution, not greetings or closings.
                    Return JSON with:
                    - type: booking|tech_issue|access|faq|gift_cards|hours|membership|general
                    - trigger: generalized version of the customer's main question/issue
                    - response: template of the operator's solution with variables like {{customer_name}}, {{bay_number}}
                    - confidence: 0.5-0.9 based on how clear and reusable the pattern is
                    - variables: array of template variables found`
          },
          {
            role: "user",
            content: `Customer messages:\n${customerContext}\n\nOperator responses:\n${operatorContext}`
          }
        ],
        response_format: { type: "json_object" }
      });
      
      const result = JSON.parse(completion.choices[0].message.content || '{}');
      
      if (result.trigger && result.response) {
        return [{
          type: result.type || 'general',
          trigger: result.trigger,
          response: result.response,
          confidence: result.confidence || 0.6,
          variables: result.variables || []
        }];
      }
    } catch (error) {
      logger.error('[CSV Import] GPT-4o analysis failed', error);
    }
    
    return [];
  }

  /**
   * Save pattern to database
   */
  private async savePattern(pattern: any): Promise<{ created: boolean; enhanced: boolean }> {
    try {
      // Check for existing similar pattern
      const existing = await db.query(
        `SELECT id, confidence_score FROM decision_patterns 
         WHERE pattern_type = $1 
         AND (
           similarity(trigger_text, $2) > 0.7
           OR LOWER(trigger_text) LIKE LOWER($3)
         )`,
        [pattern.type, pattern.trigger, `%${pattern.trigger.substring(0, 30)}%`]
      );
      
      if (existing.rows.length === 0) {
        // Insert new pattern
        await db.query(
          `INSERT INTO decision_patterns (
            pattern_type,
            pattern_signature,
            trigger_text,
            response_template,
            confidence_score,
            auto_executable,
            execution_count,
            success_count,
            is_active,
            learned_from,
            template_variables,
            created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())`,
          [
            pattern.type,
            `csv_import_${Date.now()}`,
            pattern.trigger,
            pattern.response,
            pattern.confidence,
            false,
            0,
            0,
            true,
            'csv_batch_import',
            JSON.stringify(pattern.variables)
          ]
        );
        return { created: true, enhanced: false };
      } else {
        // Boost existing pattern
        const newConfidence = Math.min(existing.rows[0].confidence_score + 0.02, 0.95);
        await db.query(
          `UPDATE decision_patterns 
           SET confidence_score = $1,
               execution_count = execution_count + 1,
               last_modified = NOW()
           WHERE id = $2`,
          [newConfidence, existing.rows[0].id]
        );
        return { created: false, enhanced: true };
      }
    } catch (error) {
      logger.error('[CSV Import] Failed to save pattern', error);
      return { created: false, enhanced: false };
    }
  }

  /**
   * Save job result to database
   */
  private async saveJobResult(job: ImportJob) {
    try {
      await db.query(
        `INSERT INTO pattern_import_jobs (
          id, user_id, status, total_messages, processed_messages,
          conversations_found, conversations_analyzed, patterns_created,
          patterns_enhanced, errors, started_at, completed_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (id) DO UPDATE SET
          status = $3, processed_messages = $5, conversations_analyzed = $7,
          patterns_created = $8, patterns_enhanced = $9, errors = $10, completed_at = $12`,
        [
          job.id, job.userId, job.status, job.totalMessages, job.processedMessages,
          job.conversationsFound, job.conversationsAnalyzed, job.patternsCreated,
          job.patternsEnhanced, JSON.stringify(job.errors), job.startedAt, job.completedAt
        ]
      );
    } catch (error) {
      logger.error('[CSV Import] Failed to save job result', error);
    }
  }

  /**
   * Clean up old jobs from memory
   */
  cleanupOldJobs() {
    const ONE_HOUR = 60 * 60 * 1000;
    const now = Date.now();
    
    for (const [jobId, job] of this.activeJobs) {
      if (job.completedAt && (now - job.completedAt.getTime()) > ONE_HOUR) {
        this.activeJobs.delete(jobId);
      }
    }
  }
}

export const csvImportService = new CSVImportService();