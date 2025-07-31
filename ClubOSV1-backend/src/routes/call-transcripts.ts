import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth';
import { roleGuard } from '../middleware/roleGuard';
import { validate } from '../middleware/validation';
import { query, body } from 'express-validator';
import { db } from '../utils/database';
import { logger } from '../utils/logger';
import { openPhoneService } from '../services/openphoneService';
import { transcriptKnowledgeExtractor } from '../services/transcriptKnowledgeExtractor';

const router = Router();

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'call-transcripts',
    timestamp: new Date().toISOString() 
  });
});

// List recent calls
router.get('/calls',
  authenticate,
  roleGuard(['admin', 'operator', 'support']),
  validate([
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('direction').optional().isIn(['inbound', 'outbound']).withMessage('Invalid direction'),
    query('phoneNumber').optional().isMobilePhone('any').withMessage('Invalid phone number'),
    query('days').optional().isInt({ min: 1, max: 90 }).withMessage('Days must be between 1 and 90')
  ]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { limit = 50, direction, phoneNumber, days = 7 } = req.query;
      
      // Calculate date range
      const createdAfter = new Date();
      createdAfter.setDate(createdAfter.getDate() - Number(days));
      
      // Get phone numbers to search
      let phoneNumberIds: string[] = [];
      if (phoneNumber) {
        const phoneNumbers = await openPhoneService.getPhoneNumbers();
        const matchingNumber = phoneNumbers.find(pn => pn.phoneNumber === phoneNumber);
        if (matchingNumber) {
          phoneNumberIds = [matchingNumber.id];
        }
      }
      
      // List calls
      const { calls } = await openPhoneService.listCalls({
        limit: Number(limit),
        direction: direction as 'inbound' | 'outbound',
        phoneNumberId: phoneNumberIds.length > 0 ? phoneNumberIds[0] : undefined,
        createdAfter: createdAfter.toISOString()
      });
      
      // Add transcript availability flag to each call
      const callsWithTranscriptInfo = await Promise.all(
        calls.map(async (call) => {
          try {
            // Check if transcript exists (quick check without fetching full content)
            const transcript = await openPhoneService.getCallTranscript(call.id);
            return {
              ...call,
              hasTranscript: !!transcript && transcript.status === 'completed',
              transcriptStatus: transcript?.status || 'absent'
            };
          } catch (error) {
            return {
              ...call,
              hasTranscript: false,
              transcriptStatus: 'absent'
            };
          }
        })
      );
      
      res.json({
        success: true,
        data: {
          calls: callsWithTranscriptInfo,
          count: callsWithTranscriptInfo.length,
          daysIncluded: Number(days)
        }
      });
    } catch (error) {
      logger.error('Failed to list calls:', error);
      next(error);
    }
  }
);

// Get call transcript
router.get('/calls/:callId/transcript',
  authenticate,
  roleGuard(['admin', 'operator', 'support']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { callId } = req.params;
      
      logger.info('Fetching transcript for call', { callId, userId: req.user?.id });
      
      const transcript = await openPhoneService.getCallTranscript(callId);
      
      if (!transcript) {
        return res.status(404).json({
          success: false,
          error: 'Transcript not found for this call'
        });
      }
      
      // Log access for auditing
      await db.createAuthLog({
        user_id: req.user!.id,
        action: 'view_call_transcript',
        ip_address: req.ip,
        user_agent: req.get('user-agent'),
        success: true
      });
      
      res.json({
        success: true,
        data: transcript
      });
    } catch (error: any) {
      if (error.response?.status === 403) {
        return res.status(403).json({
          success: false,
          error: 'Call transcripts require OpenPhone Business plan'
        });
      }
      next(error);
    }
  }
);

// Get call summary
router.get('/calls/:callId/summary',
  authenticate,
  roleGuard(['admin', 'operator', 'support']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { callId } = req.params;
      
      const summary = await openPhoneService.getCallSummary(callId);
      
      if (!summary) {
        return res.status(404).json({
          success: false,
          error: 'Summary not found for this call'
        });
      }
      
      res.json({
        success: true,
        data: summary
      });
    } catch (error) {
      next(error);
    }
  }
);

// Store transcript for knowledge extraction
router.post('/calls/:callId/store-transcript',
  authenticate,
  roleGuard(['admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { callId } = req.params;
      
      // Fetch the transcript
      const transcript = await openPhoneService.getCallTranscript(callId);
      
      if (!transcript || transcript.status !== 'completed') {
        return res.status(404).json({
          success: false,
          error: 'No completed transcript found for this call'
        });
      }
      
      // Ensure table exists
      await db.query(`
        CREATE TABLE IF NOT EXISTS call_transcripts (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          call_id VARCHAR(255) UNIQUE NOT NULL,
          phone_number VARCHAR(20),
          duration INTEGER,
          dialogue JSONB NOT NULL,
          created_at TIMESTAMP NOT NULL,
          stored_at TIMESTAMP DEFAULT NOW(),
          processed BOOLEAN DEFAULT FALSE,
          extracted_knowledge JSONB DEFAULT '[]'
        )
      `);
      
      // Extract phone number from dialogue participants
      let phoneNumber = null;
      if (transcript.dialogue && transcript.dialogue.length > 0) {
        const externalParticipant = transcript.dialogue.find(d => !d.userId);
        phoneNumber = externalParticipant?.identifier;
      }
      
      // Store the transcript
      const result = await db.query(`
        INSERT INTO call_transcripts (call_id, phone_number, duration, dialogue, created_at)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (call_id) DO UPDATE SET
          dialogue = EXCLUDED.dialogue,
          duration = EXCLUDED.duration,
          stored_at = NOW()
        RETURNING id
      `, [
        callId,
        phoneNumber,
        transcript.duration,
        JSON.stringify(transcript.dialogue),
        transcript.createdAt
      ]);
      
      logger.info('Stored call transcript', { 
        callId, 
        transcriptId: result.rows[0].id,
        duration: transcript.duration,
        dialogueCount: transcript.dialogue?.length || 0
      });
      
      res.json({
        success: true,
        data: {
          transcriptId: result.rows[0].id,
          callId,
          duration: transcript.duration,
          phoneNumber,
          dialogueCount: transcript.dialogue?.length || 0
        }
      });
    } catch (error) {
      logger.error('Failed to store transcript:', error);
      next(error);
    }
  }
);

// Batch import transcripts for recent calls
router.post('/import-recent',
  authenticate,
  roleGuard(['admin']),
  validate([
    body('days').optional().isInt({ min: 1, max: 30 }).withMessage('Days must be between 1 and 30'),
    body('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
  ]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { days = 7, limit = 20 } = req.body;
      
      logger.info('Starting batch transcript import', { days, limit });
      
      // Get recent calls
      const createdAfter = new Date();
      createdAfter.setDate(createdAfter.getDate() - days);
      
      const { calls } = await openPhoneService.listCalls({
        limit,
        createdAfter: createdAfter.toISOString()
      });
      
      const results = {
        total: calls.length,
        imported: 0,
        skipped: 0,
        failed: 0
      };
      
      // Process each call
      for (const call of calls) {
        try {
          // Check if already stored
          const existing = await db.query(
            'SELECT id FROM call_transcripts WHERE call_id = $1',
            [call.id]
          );
          
          if (existing.rows.length > 0) {
            results.skipped++;
            continue;
          }
          
          // Fetch and store transcript
          const transcript = await openPhoneService.getCallTranscript(call.id);
          
          if (transcript && transcript.status === 'completed') {
            // Extract phone number
            let phoneNumber = null;
            if (transcript.dialogue && transcript.dialogue.length > 0) {
              const externalParticipant = transcript.dialogue.find(d => !d.userId);
              phoneNumber = externalParticipant?.identifier;
            }
            
            await db.query(`
              INSERT INTO call_transcripts (call_id, phone_number, duration, dialogue, created_at)
              VALUES ($1, $2, $3, $4, $5)
            `, [
              call.id,
              phoneNumber,
              transcript.duration,
              JSON.stringify(transcript.dialogue),
              transcript.createdAt
            ]);
            
            results.imported++;
          } else {
            results.skipped++;
          }
          
          // Rate limiting delay
          await new Promise(resolve => setTimeout(resolve, 100));
          
        } catch (error) {
          logger.error(`Failed to import transcript for call ${call.id}:`, error);
          results.failed++;
        }
      }
      
      logger.info('Batch transcript import completed', results);
      
      res.json({
        success: true,
        data: results
      });
    } catch (error) {
      logger.error('Batch import failed:', error);
      next(error);
    }
  }
);

// Extract knowledge from a specific transcript
router.post('/transcripts/:transcriptId/extract-knowledge',
  authenticate,
  roleGuard(['admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { transcriptId } = req.params;
      
      logger.info('Extracting knowledge from transcript', { transcriptId });
      
      const knowledge = await transcriptKnowledgeExtractor.extractKnowledge(transcriptId);
      
      res.json({
        success: true,
        data: {
          transcriptId,
          knowledgeExtracted: knowledge.length,
          knowledge
        }
      });
    } catch (error) {
      logger.error('Failed to extract knowledge:', error);
      next(error);
    }
  }
);

// Process all unprocessed transcripts
router.post('/process-unprocessed',
  authenticate,
  roleGuard(['admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      logger.info('Starting batch knowledge extraction');
      
      const stats = await transcriptKnowledgeExtractor.processUnprocessedTranscripts();
      
      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      logger.error('Batch processing failed:', error);
      next(error);
    }
  }
);

// Search extracted knowledge
router.get('/knowledge/search',
  authenticate,
  roleGuard(['admin', 'operator', 'support']),
  validate([
    query('q').notEmpty().withMessage('Search query is required'),
    query('category').optional().isIn(['technical', 'process', 'billing', 'feature_request', 'general'])
  ]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { q, category } = req.query;
      
      const results = await transcriptKnowledgeExtractor.searchKnowledge(
        q as string,
        category as string
      );
      
      res.json({
        success: true,
        data: {
          query: q,
          category,
          results,
          count: results.length
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get transcript statistics
router.get('/stats',
  authenticate,
  roleGuard(['admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const stats = await db.query(`
        SELECT 
          COUNT(*) as total_transcripts,
          COUNT(CASE WHEN processed = TRUE THEN 1 END) as processed_transcripts,
          COUNT(CASE WHEN processed = FALSE THEN 1 END) as unprocessed_transcripts,
          AVG(duration) as avg_duration,
          MIN(created_at) as oldest_transcript,
          MAX(created_at) as newest_transcript
        FROM call_transcripts
      `);
      
      const knowledgeStats = await db.query(`
        SELECT 
          category,
          COUNT(*) as count,
          AVG(confidence) as avg_confidence
        FROM extracted_knowledge
        WHERE source_type = 'call_transcript'
        GROUP BY category
        ORDER BY count DESC
      `);
      
      res.json({
        success: true,
        data: {
          transcripts: stats.rows[0],
          knowledgeByCategory: knowledgeStats.rows
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;