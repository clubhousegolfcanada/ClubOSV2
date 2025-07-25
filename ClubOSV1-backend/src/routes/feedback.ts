import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { readJsonFile, writeJsonFile, appendToJsonArray } from '../utils/fileUtils';
import { logger } from '../utils/logger';
import { slackFallback } from '../services/slackFallback';
import { query } from '../utils/db';
import { Feedback, FeedbackSource } from '../types';

const router = Router();

// Helper function to save feedback to PostgreSQL
async function saveFeedbackToDatabase(feedback: Feedback): Promise<void> {
  try {
    await query(
      `INSERT INTO feedback 
      (id, timestamp, user_id, user_email, request_description, location, route, 
       response, confidence, is_useful, feedback_type, feedback_source, 
       slack_thread_ts, slack_user_name, slack_user_id, slack_channel, 
       original_request_id, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)`,
      [
        feedback.id,
        feedback.timestamp,
        feedback.userId,
        feedback.userEmail,
        feedback.requestDescription,
        feedback.location,
        feedback.route,
        feedback.response,
        feedback.confidence,
        feedback.isUseful,
        feedback.feedbackType,
        feedback.feedbackSource,
        feedback.slackThreadTs,
        feedback.slackUserName,
        feedback.slackUserId,
        feedback.slackChannel,
        feedback.originalRequestId,
        feedback.createdAt
      ]
    );
  } catch (error) {
    logger.error('Failed to save feedback to database:', error);
    // Don't throw - fall back to JSON file storage
  }
}

// POST /api/feedback - Submit feedback for a response
router.post('/', authenticate, async (req, res) => {
  try {
    const { 
      timestamp, 
      requestDescription, 
      location, 
      route, 
      response, 
      confidence, 
      isUseful, 
      feedbackType,
      feedbackSource = 'user' as FeedbackSource,
      slackThreadTs,
      slackUserName,
      slackUserId,
      slackChannel,
      originalRequestId
    } = req.body;

    // Create feedback entry
    const feedbackEntry: Feedback = {
      id: `feedback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp,
      userId: req.user?.id,
      userEmail: req.user?.email,
      requestDescription,
      location,
      route,
      response,
      confidence,
      isUseful,
      feedbackType,
      feedbackSource,
      slackThreadTs,
      slackUserName,
      slackUserId,
      slackChannel,
      originalRequestId,
      createdAt: new Date().toISOString()
    };

    // Log feedback
    logger.info('Feedback received', {
      feedbackType,
      isUseful,
      route,
      userId: req.user?.id,
      feedbackSource
    });

    // Save to PostgreSQL database
    await saveFeedbackToDatabase(feedbackEntry);

    // Also save to JSON files for backward compatibility
    // If not useful, append to the "not_useful_feedback.json" file
    if (!isUseful) {
      await appendToJsonArray('not_useful_feedback.json', feedbackEntry);
      
      // Send Slack notification for unhelpful responses
      try {
        if (slackFallback.isEnabled() && feedbackSource === 'user') {
          await slackFallback.sendUnhelpfulFeedbackNotification(feedbackEntry);
          logger.info('Slack notification sent for unhelpful feedback', { feedbackId: feedbackEntry.id });
        }
      } catch (slackError) {
        logger.error('Failed to send Slack notification for feedback:', slackError);
        // Don't fail the feedback submission if Slack fails
      }
    }

    // Also log all feedback to a general log file
    await appendToJsonArray('all_feedback.json', feedbackEntry);

    res.json({ 
      success: true, 
      message: 'Feedback recorded successfully',
      feedbackId: feedbackEntry.id 
    });
  } catch (error) {
    logger.error('Error recording feedback:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to record feedback' 
    });
  }
});

// GET /api/feedback/not-useful - Get all not useful feedback (admin/operator only)
router.get('/not-useful', authenticate, async (req, res) => {
  try {
    // Check if user has appropriate role
    if (req.user?.role !== 'admin' && req.user?.role !== 'operator') {
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied. Admin or operator only.' 
      });
    }

    try {
      // Try to get from database first
      const dbResult = await query(
        `SELECT * FROM feedback 
         WHERE is_useful = false 
         ORDER BY created_at DESC`
      );
      
      if (dbResult.rows.length > 0) {
        res.json({ 
          success: true, 
          data: dbResult.rows,
          count: dbResult.rows.length,
          source: 'database'
        });
      } else {
        // Fall back to JSON file
        const feedbackArray = await readJsonFile<any[]>('not_useful_feedback.json');
        res.json({ 
          success: true, 
          data: feedbackArray,
          count: feedbackArray.length,
          source: 'json_file'
        });
      }
    } catch (error) {
      // If database fails, try JSON file
      try {
        const feedbackArray = await readJsonFile<any[]>('not_useful_feedback.json');
        res.json({ 
          success: true, 
          data: feedbackArray,
          count: feedbackArray.length,
          source: 'json_file' 
        });
      } catch (fileError) {
        // If file doesn't exist, return empty array
        res.json({ 
          success: true, 
          data: [],
          count: 0,
          message: 'No feedback found' 
        });
      }
    }
  } catch (error) {
    logger.error('Error retrieving feedback:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to retrieve feedback' 
    });
  }
});

// GET /api/feedback/slack-replies - Get Slack replies (admin/operator only)
router.get('/slack-replies', authenticate, async (req, res) => {
  try {
    // Check if user has appropriate role
    if (req.user?.role !== 'admin' && req.user?.role !== 'operator') {
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied. Admin or operator only.' 
      });
    }

    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    // Query the slack_replies_view for easy access to Slack replies
    const result = await query(
      `SELECT * FROM slack_replies_view 
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    // Get total count
    const countResult = await query(
      `SELECT COUNT(*) as total FROM feedback WHERE feedback_source = 'slack_reply'`
    );
    
    res.json({ 
      success: true, 
      data: result.rows,
      count: result.rows.length,
      total: parseInt(countResult.rows[0].total),
      limit,
      offset
    });
  } catch (error) {
    logger.error('Error retrieving Slack replies:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to retrieve Slack replies' 
    });
  }
});

// GET /api/feedback/export - Export not useful feedback as downloadable file (admin only)
router.get('/export', authenticate, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied. Admin only.' 
      });
    }

    try {
      // Try to get from database first
      const dbResult = await query(
        `SELECT request_description, location, route, response, confidence, timestamp 
         FROM feedback 
         WHERE is_useful = false 
         ORDER BY created_at DESC`
      );
      
      let feedbackArray;
      if (dbResult.rows.length > 0) {
        feedbackArray = dbResult.rows;
      } else {
        // Fall back to JSON file
        const jsonData = await readJsonFile<any[]>('not_useful_feedback.json');
        feedbackArray = jsonData.map((item: any) => ({
          request: item.requestDescription,
          location: item.location,
          route: item.route,
          response: item.response,
          confidence: item.confidence,
          timestamp: item.timestamp
        }));
      }
      
      // Set headers for file download
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="clubos_feedback_${new Date().toISOString().split('T')[0]}.json"`);
      
      res.send(JSON.stringify(feedbackArray, null, 2));
    } catch {
      res.status(404).json({ 
        success: false, 
        message: 'No feedback to export' 
      });
    }
  } catch (error) {
    logger.error('Error exporting feedback:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to export feedback' 
    });
  }
});

// DELETE /api/feedback/clear - Clear all not useful feedback (admin only)
router.delete('/clear', authenticate, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied. Admin only.' 
      });
    }

    try {
      // Clear from database
      await query('DELETE FROM feedback WHERE is_useful = false');
      
      // Clear the not_useful_feedback.json file by writing an empty array
      await writeJsonFile('not_useful_feedback.json', []);
      
      logger.info('Feedback cleared by admin', {
        userId: req.user.id,
        userEmail: req.user.email
      });
      
      res.json({ 
        success: true, 
        message: 'All feedback cleared successfully' 
      });
    } catch (error) {
      logger.error('Error clearing feedback:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to clear feedback' 
      });
    }
  } catch (error) {
    logger.error('Error in clear feedback endpoint:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    });
  }
});

export default router;