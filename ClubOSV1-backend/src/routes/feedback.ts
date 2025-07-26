import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { logger } from '../utils/logger';
import { readJsonFile, writeJsonFile, appendToJsonArray } from '../utils/fileUtils';
import { FeedbackEntry } from '../types';
import { db } from '../utils/database';
import { slackFallback } from '../services/slackFallback';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

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
      feedbackSource = 'user',
      slackThreadTs,
      slackUserName,
      slackUserId,
      slackChannel,
      originalRequestId
    } = req.body;

    const feedbackEntry: FeedbackEntry = {
      id: uuidv4(),
      timestamp: timestamp || new Date().toISOString(),
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

    // Try to save to database first
    if (db.isEnabled()) {
      try {
        await db.createFeedback({
          timestamp: new Date(feedbackEntry.timestamp),
          user_id: feedbackEntry.userId,
          user_email: feedbackEntry.userEmail,
          request_description: feedbackEntry.requestDescription,
          location: feedbackEntry.location,
          route: feedbackEntry.route,
          response: feedbackEntry.response,
          confidence: feedbackEntry.confidence,
          is_useful: feedbackEntry.isUseful,
          feedback_type: feedbackEntry.feedbackType,
          feedback_source: feedbackEntry.feedbackSource,
          slack_thread_ts: feedbackEntry.slackThreadTs,
          slack_user_name: feedbackEntry.slackUserName,
          slack_user_id: feedbackEntry.slackUserId,
          slack_channel: feedbackEntry.slackChannel,
          original_request_id: feedbackEntry.originalRequestId
        });
      } catch (error) {
        logger.error('Database error, saving to JSON:', error);
      }
    }

    // Always save to JSON as backup
    await appendToJsonArray('feedback.json', feedbackEntry);

    // Log feedback
    logger.info('Feedback received', {
      feedbackType,
      isUseful,
      route,
      userId: req.user?.id,
      feedbackSource
    });

    // Send Slack notification for unhelpful responses
    if (!isUseful && slackFallback.isEnabled() && feedbackSource === 'user') {
      try {
        await slackFallback.sendUnhelpfulFeedbackNotification(feedbackEntry);
        logger.info('Slack notification sent for unhelpful feedback', { feedbackId: feedbackEntry.id });
      } catch (slackError) {
        logger.error('Failed to send Slack notification for feedback:', slackError);
      }
    }

    res.json({ 
      success: true, 
      message: 'Feedback recorded successfully',
      feedbackId: feedbackEntry.id,
      storage: db.isEnabled() ? 'database' : 'json'
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

    let feedback: FeedbackEntry[] = [];
    let source = 'json';

    // Try to get from database first
    if (db.isEnabled()) {
      try {
        const dbFeedback = await db.getNotUsefulFeedback();
        feedback = dbFeedback.map(f => ({
          id: f.id,
          timestamp: f.timestamp.toISOString(),
          userId: f.user_id,
          userEmail: f.user_email,
          requestDescription: f.request_description,
          location: f.location,
          route: f.route,
          response: f.response,
          confidence: f.confidence,
          isUseful: f.is_useful,
          feedbackType: f.feedback_type,
          feedbackSource: f.feedback_source,
          slackThreadTs: f.slack_thread_ts,
          slackUserName: f.slack_user_name,
          slackUserId: f.slack_user_id,
          slackChannel: f.slack_channel,
          originalRequestId: f.original_request_id,
          createdAt: f.created_at.toISOString()
        }));
        source = 'database';
      } catch (error) {
        logger.error('Database error, falling back to JSON:', error);
      }
    }

    // Fall back to JSON if needed
    if (feedback.length === 0 && source === 'json') {
      const allFeedback = await readJsonFile<FeedbackEntry[]>('feedback.json');
      feedback = allFeedback.filter(item => !item.isUseful);
    }
    
    res.json({ 
      success: true, 
      data: feedback,
      count: feedback.length,
      source
    });
  } catch (error) {
    logger.error('Error retrieving feedback:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to retrieve feedback' 
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

    let feedback: FeedbackEntry[] = [];

    // Try to get from database first
    if (db.isEnabled()) {
      try {
        const dbFeedback = await db.getNotUsefulFeedback();
        feedback = dbFeedback.map(f => ({
          id: f.id,
          timestamp: f.timestamp.toISOString(),
          userId: f.user_id,
          userEmail: f.user_email,
          requestDescription: f.request_description,
          location: f.location,
          route: f.route,
          response: f.response,
          confidence: f.confidence,
          isUseful: f.is_useful,
          feedbackType: f.feedback_type,
          feedbackSource: f.feedback_source,
          slackThreadTs: f.slack_thread_ts,
          slackUserName: f.slack_user_name,
          slackUserId: f.slack_user_id,
          slackChannel: f.slack_channel,
          originalRequestId: f.original_request_id,
          createdAt: f.created_at.toISOString()
        }));
      } catch (error) {
        logger.error('Database error, falling back to JSON:', error);
      }
    }

    // Fall back to JSON if needed
    if (feedback.length === 0) {
      const allFeedback = await readJsonFile<FeedbackEntry[]>('feedback.json');
      feedback = allFeedback.filter(item => !item.isUseful);
    }
    
    const feedbackArray = feedback.map(item => ({
      request: item.requestDescription,
      location: item.location,
      route: item.route,
      response: item.response,
      confidence: item.confidence,
      timestamp: item.timestamp
    }));
    
    // Set headers for file download
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="clubos_feedback_${new Date().toISOString().split('T')[0]}.json"`);
    
    res.send(JSON.stringify(feedbackArray, null, 2));
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

    let deletedCount = 0;

    // Clear from database if enabled
    if (db.isEnabled()) {
      try {
        deletedCount = await db.clearNotUsefulFeedback();
      } catch (error) {
        logger.error('Database error:', error);
      }
    }

    // Also clear from JSON
    const allFeedback = await readJsonFile<FeedbackEntry[]>('feedback.json');
    const usefulFeedback = allFeedback.filter(item => item.isUseful);
    const jsonDeletedCount = allFeedback.length - usefulFeedback.length;
    
    await writeJsonFile('feedback.json', usefulFeedback);
    
    // Use the larger count
    deletedCount = Math.max(deletedCount, jsonDeletedCount);
    
    logger.info('Feedback cleared by admin', {
      userId: req.user.id,
      userEmail: req.user.email,
      deletedCount
    });
    
    res.json({ 
      success: true, 
      message: `${deletedCount} feedback entries cleared successfully` 
    });
  } catch (error) {
    logger.error('Error clearing feedback:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to clear feedback' 
    });
  }
});

export default router;
