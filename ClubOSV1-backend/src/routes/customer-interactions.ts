import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth';
import { roleGuard } from '../middleware/roleGuard';
import { validate } from '../middleware/validation';
import { query } from 'express-validator';
import { db } from '../utils/database';
import { logger } from '../utils/logger';
import { anonymizePhoneNumber } from '../utils/encryption';
import { openPhoneService } from '../services/openphoneService';
import { transcriptKnowledgeExtractor } from '../services/transcriptKnowledgeExtractor';

const router = Router();

// Get unified view of all customer interactions (messages + calls)
router.get('/unified',
  authenticate,
  roleGuard(['admin', 'operator']),
  validate([
    query('phoneNumber').optional().isMobilePhone('any'),
    query('days').optional().isInt({ min: 1, max: 365 }).withMessage('Days must be between 1 and 365'),
    query('includeTranscripts').optional().isBoolean()
  ]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { phoneNumber, days = 30, includeTranscripts = true } = req.query;
      
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - Number(days));
      
      const interactions: any = {
        phoneNumber: phoneNumber ? anonymizePhoneNumber(phoneNumber as string) : null,
        dateRange: {
          from: cutoffDate.toISOString(),
          to: new Date().toISOString()
        },
        textMessages: [],
        callTranscripts: [],
        extractedKnowledge: [],
        summary: {
          totalTexts: 0,
          totalCalls: 0,
          totalKnowledge: 0,
          lastInteraction: null
        }
      };
      
      // 1. Get text message conversations
      if (phoneNumber) {
        const messageResult = await db.query(`
          SELECT * FROM openphone_conversations 
          WHERE phone_number = $1 
          ORDER BY updated_at DESC
        `, [phoneNumber]);
        
        interactions.textMessages = messageResult.rows.map(conv => ({
          id: conv.id,
          messages: conv.messages || [],
          createdAt: conv.created_at,
          updatedAt: conv.updated_at,
          messageCount: conv.messages?.length || 0
        }));
        
        interactions.summary.totalTexts = interactions.textMessages.reduce(
          (sum: number, conv: any) => sum + conv.messageCount, 0
        );
      } else {
        // Get recent conversations if no specific phone number
        const messageResult = await db.query(`
          SELECT * FROM openphone_conversations 
          WHERE created_at >= $1
          ORDER BY updated_at DESC
          LIMIT 50
        `, [cutoffDate]);
        
        interactions.textMessages = messageResult.rows.map(conv => ({
          id: conv.id,
          phoneNumber: anonymizePhoneNumber(conv.phone_number),
          customerName: conv.customer_name,
          messages: conv.messages || [],
          createdAt: conv.created_at,
          updatedAt: conv.updated_at,
          messageCount: conv.messages?.length || 0
        }));
        
        interactions.summary.totalTexts = interactions.textMessages.reduce(
          (sum: number, conv: any) => sum + conv.messageCount, 0
        );
      }
      
      // 2. Get call transcripts
      if (includeTranscripts) {
        let transcriptQuery = `
          SELECT 
            ct.*,
            COUNT(ek.id) as knowledge_count
          FROM call_transcripts ct
          LEFT JOIN extracted_knowledge ek ON ek.source_id = ct.id AND ek.source_type = 'call_transcript'
        `;
        
        const transcriptParams: any[] = [];
        if (phoneNumber) {
          transcriptQuery += ` WHERE ct.phone_number = $1`;
          transcriptParams.push(phoneNumber);
        } else {
          transcriptQuery += ` WHERE ct.created_at >= $1`;
          transcriptParams.push(cutoffDate);
        }
        
        transcriptQuery += ` GROUP BY ct.id ORDER BY ct.created_at DESC`;
        
        const transcriptResult = await db.query(transcriptQuery, transcriptParams);
        
        interactions.callTranscripts = transcriptResult.rows.map(transcript => ({
          id: transcript.id,
          callId: transcript.call_id,
          phoneNumber: transcript.phone_number ? anonymizePhoneNumber(transcript.phone_number) : null,
          duration: transcript.duration,
          dialogue: transcript.dialogue || [],
          createdAt: transcript.created_at,
          processed: transcript.processed,
          knowledgeExtracted: transcript.knowledge_count || 0,
          // Convert dialogue to readable format
          conversationText: (transcript.dialogue || []).map((turn: any) => 
            `${turn.userId ? 'Agent' : 'Customer'}: ${turn.content}`
          ).join('\n')
        }));
        
        interactions.summary.totalCalls = interactions.callTranscripts.length;
      }
      
      // 3. Get extracted knowledge
      let knowledgeQuery = `
        SELECT * FROM extracted_knowledge 
        WHERE source_type IN ('openphone_conversation', 'call_transcript')
      `;
      
      const knowledgeParams: any[] = [];
      if (phoneNumber) {
        // This is trickier - we need to join to find knowledge from this phone number
        knowledgeQuery = `
          SELECT ek.* 
          FROM extracted_knowledge ek
          LEFT JOIN openphone_conversations oc ON ek.source_id = oc.id AND ek.source_type = 'openphone_conversation'
          LEFT JOIN call_transcripts ct ON ek.source_id = ct.id AND ek.source_type = 'call_transcript'
          WHERE (oc.phone_number = $1 OR ct.phone_number = $1)
        `;
        knowledgeParams.push(phoneNumber);
      } else {
        knowledgeQuery += ` AND created_at >= $1`;
        knowledgeParams.push(cutoffDate);
      }
      
      knowledgeQuery += ` ORDER BY created_at DESC`;
      
      const knowledgeResult = await db.query(knowledgeQuery, knowledgeParams);
      
      interactions.extractedKnowledge = knowledgeResult.rows.map(item => ({
        id: item.id,
        sourceType: item.source_type,
        category: item.category,
        problem: item.problem,
        solution: item.solution,
        confidence: item.confidence,
        createdAt: item.created_at,
        appliedToSop: item.applied_to_sop
      }));
      
      interactions.summary.totalKnowledge = interactions.extractedKnowledge.length;
      
      // 4. Determine last interaction
      const lastDates = [];
      if (interactions.textMessages.length > 0) {
        lastDates.push(new Date(interactions.textMessages[0].updatedAt));
      }
      if (interactions.callTranscripts.length > 0) {
        lastDates.push(new Date(interactions.callTranscripts[0].createdAt));
      }
      
      if (lastDates.length > 0) {
        interactions.summary.lastInteraction = new Date(Math.max(...lastDates.map(d => d.getTime())));
      }
      
      res.json({
        success: true,
        data: interactions
      });
    } catch (error) {
      logger.error('Failed to get unified customer interactions:', error);
      next(error);
    }
  }
);

// Export all customer interactions for LLM processing
router.get('/export-for-llm',
  authenticate,
  roleGuard(['admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { days = 30, format = 'structured' } = req.query;
      
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - Number(days));
      
      logger.info('Exporting customer interactions for LLM', { days, format });
      
      // Get all text conversations
      const textResult = await db.query(`
        SELECT 
          id,
          phone_number,
          customer_name,
          messages,
          created_at,
          updated_at
        FROM openphone_conversations
        WHERE created_at >= $1
        ORDER BY created_at DESC
      `, [cutoffDate]);
      
      // Get all call transcripts
      const callResult = await db.query(`
        SELECT 
          id,
          call_id,
          phone_number,
          duration,
          dialogue,
          created_at
        FROM call_transcripts
        WHERE created_at >= $1
        ORDER BY created_at DESC
      `, [cutoffDate]);
      
      // Get all extracted knowledge
      const knowledgeResult = await db.query(`
        SELECT 
          id,
          source_type,
          category,
          problem,
          solution,
          confidence,
          created_at
        FROM extracted_knowledge
        WHERE created_at >= $1
        ORDER BY confidence DESC, created_at DESC
      `, [cutoffDate]);
      
      if (format === 'llm_friendly') {
        // Format for direct LLM consumption
        let llmText = `CUSTOMER INTERACTION DATA EXPORT
Generated: ${new Date().toISOString()}
Period: Last ${days} days

=== TEXT CONVERSATIONS (${textResult.rows.length} total) ===\n\n`;
        
        for (const conv of textResult.rows) {
          llmText += `Phone: ${anonymizePhoneNumber(conv.phone_number)}\n`;
          llmText += `Customer: ${conv.customer_name || 'Unknown'}\n`;
          llmText += `Date: ${conv.created_at}\n`;
          llmText += `Messages (${conv.messages?.length || 0}):\n`;
          
          for (const msg of (conv.messages || [])) {
            const sender = msg.direction === 'inbound' ? 'Customer' : 'Agent';
            llmText += `  ${sender}: ${msg.text || msg.body}\n`;
          }
          llmText += '\n---\n\n';
        }
        
        llmText += `\n=== CALL TRANSCRIPTS (${callResult.rows.length} total) ===\n\n`;
        
        for (const call of callResult.rows) {
          llmText += `Call ID: ${call.call_id}\n`;
          llmText += `Phone: ${call.phone_number ? anonymizePhoneNumber(call.phone_number) : 'Unknown'}\n`;
          llmText += `Duration: ${call.duration} seconds\n`;
          llmText += `Date: ${call.created_at}\n`;
          llmText += `Transcript:\n`;
          
          for (const turn of (call.dialogue || [])) {
            const speaker = turn.userId ? 'Agent' : 'Customer';
            llmText += `  ${speaker}: ${turn.content}\n`;
          }
          llmText += '\n---\n\n';
        }
        
        llmText += `\n=== EXTRACTED KNOWLEDGE (${knowledgeResult.rows.length} items) ===\n\n`;
        
        for (const item of knowledgeResult.rows) {
          llmText += `Category: ${item.category}\n`;
          llmText += `Problem: ${item.problem}\n`;
          llmText += `Solution: ${item.solution}\n`;
          llmText += `Confidence: ${(item.confidence * 100).toFixed(0)}%\n`;
          llmText += `Source: ${item.source_type}\n`;
          llmText += '\n---\n\n';
        }
        
        res.setHeader('Content-Type', 'text/plain');
        res.setHeader('Content-Disposition', `attachment; filename="customer-interactions-llm-${Date.now()}.txt"`);
        res.send(llmText);
        
      } else {
        // Structured JSON format
        const exportData = {
          metadata: {
            exportDate: new Date().toISOString(),
            periodDays: Number(days),
            cutoffDate: cutoffDate.toISOString(),
            counts: {
              textConversations: textResult.rows.length,
              callTranscripts: callResult.rows.length,
              extractedKnowledge: knowledgeResult.rows.length
            }
          },
          textConversations: textResult.rows.map(conv => ({
            id: conv.id,
            phoneNumber: anonymizePhoneNumber(conv.phone_number),
            customerName: conv.customer_name,
            messages: conv.messages || [],
            createdAt: conv.created_at,
            updatedAt: conv.updated_at
          })),
          callTranscripts: callResult.rows.map(call => ({
            id: call.id,
            callId: call.call_id,
            phoneNumber: call.phone_number ? anonymizePhoneNumber(call.phone_number) : null,
            duration: call.duration,
            dialogue: call.dialogue || [],
            createdAt: call.created_at
          })),
          extractedKnowledge: knowledgeResult.rows
        };
        
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="customer-interactions-${Date.now()}.json"`);
        res.json(exportData);
      }
      
      // Log the export
      await db.createAuthLog({
        user_id: req.user!.id,
        action: 'export_customer_interactions',
        ip_address: req.ip,
        user_agent: req.get('user-agent'),
        success: true,
        error_message: `Exported ${days} days of data in ${format} format`
      });
      
    } catch (error) {
      logger.error('Failed to export customer interactions:', error);
      next(error);
    }
  }
);

// Process and extract knowledge from a specific conversation or transcript
router.post('/extract-knowledge/:id',
  authenticate,
  roleGuard(['admin']),
  validate([
    query('type').isIn(['conversation', 'transcript']).withMessage('Type must be conversation or transcript')
  ]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { type } = req.query;
      
      if (type === 'transcript') {
        // Use the transcript knowledge extractor
        const knowledge = await transcriptKnowledgeExtractor.extractKnowledge(id);
        
        res.json({
          success: true,
          data: {
            sourceId: id,
            sourceType: 'call_transcript',
            knowledgeExtracted: knowledge.length,
            knowledge
          }
        });
      } else {
        // Extract from text conversation
        // TODO: Implement conversation knowledge extraction
        res.json({
          success: true,
          data: {
            sourceId: id,
            sourceType: 'openphone_conversation',
            knowledgeExtracted: 0,
            knowledge: [],
            message: 'Text conversation knowledge extraction not yet implemented'
          }
        });
      }
    } catch (error) {
      logger.error('Failed to extract knowledge:', error);
      next(error);
    }
  }
);

export default router;