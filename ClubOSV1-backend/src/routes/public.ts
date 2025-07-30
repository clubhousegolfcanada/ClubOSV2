import express from 'express';
import { publicRateLimiter } from '../middleware/publicRateLimiter';
import { logger } from '../utils/logger';
import { db } from '../utils/database';
import axios from 'axios';

const router = express.Router();

// Public ClubOS Boy endpoint - no authentication required
router.post('/clubosboy', publicRateLimiter, async (req, res) => {
  const startTime = Date.now();
  const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
  
  try {
    const { question, location, source } = req.body;

    // Validate input
    if (!question || typeof question !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid question'
      });
    }

    if (question.length < 10) {
      return res.status(400).json({
        success: false,
        message: 'Please provide more details in your question'
      });
    }

    if (question.length > 500) {
      return res.status(400).json({
        success: false,
        message: 'Please keep your question under 500 characters'
      });
    }

    // Log public request
    try {
      await db.query(
        `INSERT INTO public_requests (ip_address, question, location, source, created_at)
         VALUES ($1, $2, $3, $4, NOW())`,
        [clientIp, question, location || 'Not specified', source || 'public_web']
      );
    } catch (dbError) {
      logger.error('Failed to log public request:', dbError);
      // Continue processing even if logging fails
    }

    // Get OpenAI API configuration
    const apiKey = process.env.OPENAI_API_KEY;
    const assistantId = process.env.OPENAI_ASSISTANT_ID || process.env.CLUBOS_BOY_ASSISTANT_ID;

    if (!apiKey || !assistantId) {
      logger.error('OpenAI configuration missing');
      return res.status(500).json({
        success: false,
        message: 'AI assistant is not configured. Please contact support.'
      });
    }

    // Create a thread for this conversation
    const threadResponse = await axios.post(
      'https://api.openai.com/v1/threads',
      {},
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'OpenAI-Beta': 'assistants=v2'
        }
      }
    );

    const threadId = threadResponse.data.id;

    // Add the user's message to the thread
    await axios.post(
      `https://api.openai.com/v1/threads/${threadId}/messages`,
      {
        role: 'user',
        content: `[Public Request from ${location || 'Unknown Location'}] ${question}`
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'OpenAI-Beta': 'assistants=v2'
        }
      }
    );

    // Run the assistant
    const runResponse = await axios.post(
      `https://api.openai.com/v1/threads/${threadId}/runs`,
      {
        assistant_id: assistantId
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'OpenAI-Beta': 'assistants=v2'
        }
      }
    );

    const runId = runResponse.data.id;

    // Poll for completion (with timeout)
    let attempts = 0;
    const maxAttempts = 30; // 15 seconds timeout (500ms intervals)
    let runStatus = 'in_progress';

    while (runStatus === 'in_progress' && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const statusResponse = await axios.get(
        `https://api.openai.com/v1/threads/${threadId}/runs/${runId}`,
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'OpenAI-Beta': 'assistants=v2'
          }
        }
      );

      runStatus = statusResponse.data.status;
      attempts++;
    }

    if (runStatus !== 'completed') {
      throw new Error(`Assistant run failed with status: ${runStatus}`);
    }

    // Get the assistant's response
    const messagesResponse = await axios.get(
      `https://api.openai.com/v1/threads/${threadId}/messages`,
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'OpenAI-Beta': 'assistants=v2'
        }
      }
    );

    const assistantMessage = messagesResponse.data.data.find(
      (msg: any) => msg.role === 'assistant'
    );

    if (!assistantMessage || !assistantMessage.content[0]?.text?.value) {
      throw new Error('No response from assistant');
    }

    const responseText = assistantMessage.content[0].text.value;

    // Log successful response
    const duration = Date.now() - startTime;
    logger.info('Public ClubOS Boy request processed', {
      ip: clientIp,
      location,
      duration,
      questionLength: question.length
    });

    return res.json({
      success: true,
      message: responseText
    });

  } catch (error: any) {
    logger.error('Public ClubOS Boy error:', {
      error: error.message,
      stack: error.stack,
      ip: clientIp
    });

    // Check if it's an OpenAI error
    if (error.response?.status === 429) {
      return res.status(429).json({
        success: false,
        message: 'Our AI assistant is currently busy. Please try again in a moment or text us directly at (902) 707-3748.'
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Sorry, something went wrong. Please text us directly at (902) 707-3748 for immediate help.'
    });
  }
});

// Public health check
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'public-api',
    timestamp: new Date().toISOString()
  });
});

export default router;