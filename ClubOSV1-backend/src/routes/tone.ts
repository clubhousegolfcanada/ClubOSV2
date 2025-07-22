import { Router, Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { AppError } from '../middleware/errorHandler';
import { validate } from '../middleware/validation';
import { body } from 'express-validator';
import { strictLimiter } from '../middleware/security';
import axios from 'axios';

const router = Router();

// Your OpenAI Assistant ID for tone conversion
const TONE_ASSISTANT_ID = process.env.TONE_ASSISTANT_ID || 'asst_jvkYiS8LKwfaNOuGeEagKAgi';

// Convert text to Clubhouse tone
router.post('/convert', 
  strictLimiter,
  validate([
    body('text')
      .trim()
      .notEmpty()
      .withMessage('Text is required')
      .isLength({ min: 1, max: 500 })
      .withMessage('Text must be between 1 and 500 characters')
  ]),
  async (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    
    try {
      const { text } = req.body;
      
      logger.info('Tone conversion request:', { text });
      
      // Call OpenAI Assistant API
      const openaiResponse = await axios.post(
        'https://api.openai.com/v1/threads/runs',
        {
          assistant_id: TONE_ASSISTANT_ID,
          thread: {
            messages: [
              {
                role: "user",
                content: text
              }
            ]
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
            'OpenAI-Beta': 'assistants=v2'
          }
        }
      );

      // Wait for completion
      const threadId = openaiResponse.data.thread_id;
      const runId = openaiResponse.data.id;
      
      let runStatus = openaiResponse.data.status;
      let attempts = 0;
      const maxAttempts = 30; // 30 seconds max
      
      // Poll for completion
      while (runStatus === 'queued' || runStatus === 'in_progress') {
        if (attempts >= maxAttempts) {
          throw new AppError('TIMEOUT', 'Tone conversion timed out', 408);
        }
        
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
        
        const statusResponse = await axios.get(
          `https://api.openai.com/v1/threads/${threadId}/runs/${runId}`,
          {
            headers: {
              'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
              'OpenAI-Beta': 'assistants=v2'
            }
          }
        );
        
        runStatus = statusResponse.data.status;
        attempts++;
      }
      
      if (runStatus !== 'completed') {
        throw new AppError('FAILED', 'Tone conversion failed', 500);
      }
      
      // Get the assistant's response
      const messagesResponse = await axios.get(
        `https://api.openai.com/v1/threads/${threadId}/messages`,
        {
          headers: {
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
            'OpenAI-Beta': 'assistants=v2'
          }
        }
      );
      
      const assistantMessage = messagesResponse.data.data.find(
        (msg: any) => msg.role === 'assistant'
      );
      
      if (!assistantMessage) {
        throw new AppError('NO_RESPONSE', 'No response from tone converter', 500);
      }
      
      const convertedText = assistantMessage.content[0].text.value;
      
      logger.info('Tone conversion successful:', { 
        original: text, 
        converted: convertedText,
        processingTime: Date.now() - startTime
      });
      
      res.json({
        success: true,
        data: {
          originalText: text,
          convertedText,
          processingTime: Date.now() - startTime
        }
      });
      
    } catch (error) {
      logger.error('Tone conversion failed:', error);
      
      if (axios.isAxiosError(error)) {
        next(new AppError(
          'OPENAI_ERROR',
          'Failed to convert tone',
          error.response?.status || 500
        ));
      } else {
        next(error);
      }
    }
  }
);

export default router;
