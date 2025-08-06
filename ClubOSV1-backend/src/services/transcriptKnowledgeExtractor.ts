import { logger } from '../utils/logger';
import { db } from '../utils/database';
import OpenAI from 'openai';

// Create OpenAI instance lazily
let openai: OpenAI | null = null;

function getOpenAI(): OpenAI | null {
  if (!process.env.OPENAI_API_KEY) {
    return null;
  }
  if (!openai) {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }
  return openai;
}

interface TranscriptDialogue {
  content: string;
  start: number;
  end: number;
  identifier: string;
  userId?: string;
}

interface ExtractedKnowledge {
  category: string;
  problem: string;
  solution: string;
  confidence: number;
  context?: string;
}

export class TranscriptKnowledgeExtractor {
  /**
   * Extract knowledge from a call transcript
   */
  async extractKnowledge(transcriptId: string): Promise<ExtractedKnowledge[]> {
    try {
      // Fetch the transcript
      const result = await db.query(
        'SELECT * FROM call_transcripts WHERE id = $1',
        [transcriptId]
      );
      
      if (result.rows.length === 0) {
        throw new Error('Transcript not found');
      }
      
      const transcript = result.rows[0];
      const dialogue: TranscriptDialogue[] = transcript.dialogue;
      
      if (!dialogue || dialogue.length === 0) {
        logger.warn('No dialogue found in transcript', { transcriptId });
        return [];
      }
      
      // Convert dialogue to conversation format
      const conversation = this.formatDialogue(dialogue);
      
      // Use OpenAI to extract knowledge
      const prompt = `Analyze this customer service call transcript and extract actionable knowledge.

Call Transcript:
${conversation}

Extract any customer issues, problems, or questions along with the solutions or responses provided. Focus on:
1. Technical issues and their resolutions
2. Common customer questions and answers
3. Process-related problems and solutions
4. Any feature requests or feedback

For each piece of knowledge extracted, provide:
- Category (technical, process, billing, feature_request, general)
- Problem/Question (what the customer was asking about)
- Solution/Answer (how it was resolved or answered)
- Confidence (0-1, how confident you are this is useful knowledge)

Return as JSON array of objects with these fields. Only include clear, actionable knowledge that could help resolve similar issues in the future.`;

      const openaiClient = getOpenAI();
      if (!openaiClient) {
        logger.warn('OpenAI not available for knowledge extraction');
        return [];
      }

      const response = await openaiClient.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          {
            role: 'system',
            content: 'You are an expert at analyzing customer service conversations and extracting actionable knowledge for improving support.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' }
      });
      
      const extracted = JSON.parse(response.choices[0].message.content || '{"knowledge": []}');
      const knowledge: ExtractedKnowledge[] = extracted.knowledge || [];
      
      // Store extracted knowledge in the database
      if (knowledge.length > 0) {
        for (const item of knowledge) {
          await db.query(`
            INSERT INTO extracted_knowledge 
            (source_id, source_type, category, problem, solution, confidence, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, NOW())
          `, [
            transcriptId,
            'call_transcript',
            item.category,
            item.problem,
            item.solution,
            item.confidence
          ]);
        }
        
        // Mark transcript as processed
        await db.query(
          'UPDATE call_transcripts SET processed = TRUE, extracted_knowledge = $1 WHERE id = $2',
          [JSON.stringify(knowledge), transcriptId]
        );
      }
      
      logger.info('Extracted knowledge from transcript', {
        transcriptId,
        knowledgeCount: knowledge.length
      });
      
      return knowledge;
    } catch (error) {
      logger.error('Failed to extract knowledge from transcript:', error);
      throw error;
    }
  }
  
  /**
   * Format dialogue into readable conversation
   */
  private formatDialogue(dialogue: TranscriptDialogue[]): string {
    return dialogue.map(turn => {
      const speaker = turn.userId ? 'Agent' : 'Customer';
      return `${speaker}: ${turn.content}`;
    }).join('\n\n');
  }
  
  /**
   * Process all unprocessed transcripts
   */
  async processUnprocessedTranscripts(): Promise<{
    processed: number;
    knowledgeExtracted: number;
    errors: number;
  }> {
    const stats = {
      processed: 0,
      knowledgeExtracted: 0,
      errors: 0
    };
    
    try {
      // Get unprocessed transcripts
      const result = await db.query(`
        SELECT id FROM call_transcripts 
        WHERE processed = FALSE 
        ORDER BY created_at DESC 
        LIMIT 10
      `);
      
      for (const row of result.rows) {
        try {
          const knowledge = await this.extractKnowledge(row.id);
          stats.processed++;
          stats.knowledgeExtracted += knowledge.length;
          
          // Add delay to respect rate limits
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
          logger.error(`Failed to process transcript ${row.id}:`, error);
          stats.errors++;
        }
      }
      
      logger.info('Batch transcript processing completed', stats);
      return stats;
    } catch (error) {
      logger.error('Failed to process transcripts:', error);
      throw error;
    }
  }
  
  /**
   * Search extracted knowledge
   */
  async searchKnowledge(query: string, category?: string): Promise<any[]> {
    try {
      let sql = `
        SELECT * FROM extracted_knowledge 
        WHERE (problem ILIKE $1 OR solution ILIKE $1)
      `;
      const params: any[] = [`%${query}%`];
      
      if (category) {
        sql += ' AND category = $2';
        params.push(category);
      }
      
      sql += ' ORDER BY confidence DESC, created_at DESC LIMIT 20';
      
      const result = await db.query(sql, params);
      return result.rows;
    } catch (error) {
      logger.error('Failed to search knowledge:', error);
      return [];
    }
  }
}

// Export singleton instance
export const transcriptKnowledgeExtractor = new TranscriptKnowledgeExtractor();