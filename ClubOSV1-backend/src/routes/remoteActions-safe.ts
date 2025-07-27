import express from 'express';
import { requireAuth, requireRole } from '../middleware/auth';
import { pool } from '../utils/db';

const router = express.Router();

// Temporary safe version that won't crash on import
router.post('/execute', requireAuth, requireRole('operator'), async (req, res) => {
  try {
    const { action, location, bayNumber } = req.body;
    
    // For now, always return demo mode response
    const simulatedJobId = `SIM-${Date.now()}`;
    
    res.json({
      success: true,
      message: `[DEMO] ${action} initiated on ${location} Bay ${bayNumber}`,
      jobId: simulatedJobId,
      device: `${location} Bay ${bayNumber} PC`,
      simulated: true,
      estimatedTime: action === 'reboot-pc' ? '3-5 minutes' : '30-60 seconds'
    });
    
  } catch (error: any) {
    console.error('Remote action error:', error);
    res.status(500).json({ 
      error: 'Failed to execute remote action',
      message: error.message || 'An unexpected error occurred'
    });
  }
});

// Check job status
router.get('/status/:jobId', requireAuth, async (req, res) => {
  try {
    // Always return completed for demo jobs
    if (req.params.jobId.startsWith('SIM-')) {
      const jobAge = Date.now() - parseInt(req.params.jobId.split('-')[1]);
      const status = jobAge > 5000 ? 'completed' : 'running';
      
      return res.json({
        jobId: req.params.jobId,
        status: status,
        result: { simulated: true }
      });
    }
    
    // For non-demo jobs, return error
    res.status(404).json({ error: 'Job not found' });
    
  } catch (error) {
    res.status(500).json({ error: 'Failed to check job status' });
  }
});

// Get device status
router.get('/devices/:location', requireAuth, requireRole('operator'), async (req, res) => {
  try {
    // Return all devices as online in demo mode
    const devices = [
      { bay: '1', name: `${req.params.location} Bay 1 PC`, status: 'online', demo: true },
      { bay: '2', name: `${req.params.location} Bay 2 PC`, status: 'online', demo: true },
      { bay: '3', name: `${req.params.location} Bay 3 PC`, status: 'online', demo: true },
    ];
    
    res.json({ devices, demo: true });
    
  } catch (error) {
    res.status(500).json({ error: 'Failed to get device status' });
  }
});

export default router;