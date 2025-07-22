import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { readJsonFile, writeJsonFile, appendToJsonArray } from '../utils/fileUtils';
import { logger } from '../utils/logger';

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
      feedbackType 
    } = req.body;

    // Create feedback entry
    const feedbackEntry = {
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
      createdAt: new Date().toISOString()
    };

    // Log feedback
    logger.info('Feedback received', {
      feedbackType,
      isUseful,
      route,
      userId: req.user?.id
    });

    // If not useful, append to the "not_useful_feedback.json" file
    if (!isUseful) {
      await appendToJsonArray('not_useful_feedback.json', feedbackEntry);
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

// GET /api/feedback/not-useful - Get all not useful feedback (admin only)
router.get('/not-useful', authenticate, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied. Admin only.' 
      });
    }

    try {
      const feedbackArray = await readJsonFile<any[]>('not_useful_feedback.json');
      
      res.json({ 
        success: true, 
        data: feedbackArray,
        count: feedbackArray.length 
      });
    } catch (error) {
      // If file doesn't exist, return empty array
      res.json({ 
        success: true, 
        data: [],
        count: 0,
        message: 'No feedback found' 
      });
    }
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

    try {
      const feedbackArray = await readJsonFile<any[]>('not_useful_feedback.json');
      
      // Format for Claude
      const formattedFeedback = feedbackArray.map((item: any) => ({
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
      
      res.send(JSON.stringify(formattedFeedback, null, 2));
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

export default router;
