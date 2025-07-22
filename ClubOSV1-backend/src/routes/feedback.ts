import { Router } from 'express';
import { promises as fs } from 'fs';
import path from 'path';
import { authenticate } from '../middleware/auth';

const router = Router();

// Directory for feedback logs
const FEEDBACK_DIR = path.join(process.cwd(), 'feedback_logs');

// Ensure feedback directory exists
const ensureFeedbackDir = async () => {
  try {
    await fs.access(FEEDBACK_DIR);
  } catch {
    await fs.mkdir(FEEDBACK_DIR, { recursive: true });
  }
};

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

    // Ensure directory exists
    await ensureFeedbackDir();

    // If not useful, append to the "not_useful_feedback.json" file
    if (!isUseful) {
      const notUsefulFile = path.join(FEEDBACK_DIR, 'not_useful_feedback.json');
      
      try {
        // Read existing data
        const existingData = await fs.readFile(notUsefulFile, 'utf-8');
        const feedbackArray = JSON.parse(existingData);
        feedbackArray.push(feedbackEntry);
        
        // Write updated data
        await fs.writeFile(notUsefulFile, JSON.stringify(feedbackArray, null, 2));
      } catch {
        // If file doesn't exist, create it with the first entry
        await fs.writeFile(notUsefulFile, JSON.stringify([feedbackEntry], null, 2));
      }
    }

    // Also log all feedback to a general log file
    const allFeedbackFile = path.join(FEEDBACK_DIR, 'all_feedback.json');
    
    try {
      const existingData = await fs.readFile(allFeedbackFile, 'utf-8');
      const feedbackArray = JSON.parse(existingData);
      feedbackArray.push(feedbackEntry);
      await fs.writeFile(allFeedbackFile, JSON.stringify(feedbackArray, null, 2));
    } catch {
      await fs.writeFile(allFeedbackFile, JSON.stringify([feedbackEntry], null, 2));
    }

    res.json({ 
      success: true, 
      message: 'Feedback recorded successfully',
      feedbackId: feedbackEntry.id 
    });
  } catch (error) {
    console.error('Error recording feedback:', error);
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

    await ensureFeedbackDir();
    const notUsefulFile = path.join(FEEDBACK_DIR, 'not_useful_feedback.json');
    
    try {
      const data = await fs.readFile(notUsefulFile, 'utf-8');
      const feedbackArray = JSON.parse(data);
      
      res.json({ 
        success: true, 
        data: feedbackArray,
        count: feedbackArray.length 
      });
    } catch {
      res.json({ 
        success: true, 
        data: [],
        count: 0,
        message: 'No feedback found' 
      });
    }
  } catch (error) {
    console.error('Error retrieving feedback:', error);
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

    await ensureFeedbackDir();
    const notUsefulFile = path.join(FEEDBACK_DIR, 'not_useful_feedback.json');
    
    try {
      const data = await fs.readFile(notUsefulFile, 'utf-8');
      const feedbackArray = JSON.parse(data);
      
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
    console.error('Error exporting feedback:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to export feedback' 
    });
  }
});

export default router;
