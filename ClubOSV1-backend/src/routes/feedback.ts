import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { logger } from '../utils/logger';
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

    // Create feedback in database
    const feedbackEntry = await db.createFeedback({
      timestamp: timestamp ? new Date(timestamp) : new Date(),
      user_id: req.user?.id,
      user_email: req.user?.email,
      request_description: requestDescription,
      location,
      route,
      response,
      confidence,
      is_useful: isUseful,
      feedback_type: feedbackType,
      feedback_source: feedbackSource,
      slack_thread_ts: slackThreadTs,
      slack_user_name: slackUserName,
      slack_user_id: slackUserId,
      slack_channel: slackChannel,
      original_request_id: originalRequestId
    });

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
        await slackFallback.sendUnhelpfulFeedbackNotification({
          id: feedbackEntry.id,
          timestamp: feedbackEntry.timestamp.toISOString(),
          userId: feedbackEntry.user_id,
          userEmail: feedbackEntry.user_email,
          requestDescription: feedbackEntry.request_description,
          location: feedbackEntry.location,
          route: feedbackEntry.route,
          response: feedbackEntry.response,
          confidence: feedbackEntry.confidence,
          isUseful: feedbackEntry.is_useful,
          feedbackType: feedbackEntry.feedback_type,
          feedbackSource: feedbackEntry.feedback_source,
          createdAt: feedbackEntry.created_at.toISOString()
        });
        logger.info('Slack notification sent for unhelpful feedback', { feedbackId: feedbackEntry.id });
      } catch (slackError) {
        logger.error('Failed to send Slack notification for feedback:', slackError);
      }
    }

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

    const feedback = await db.getNotUsefulFeedback();
    
    res.json({ 
      success: true, 
      data: feedback.map(f => ({
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
        createdAt: f.created_at.toISOString()
      })),
      count: feedback.length
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

    const feedback = await db.getNotUsefulFeedback();
    
    const feedbackArray = feedback.map(item => ({
      request: item.request_description,
      location: item.location,
      route: item.route,
      response: item.response,
      confidence: item.confidence,
      timestamp: item.timestamp.toISOString()
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

    const deletedCount = await db.clearNotUsefulFeedback();
    
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
