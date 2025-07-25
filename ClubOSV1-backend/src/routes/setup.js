const express = require('express');
const { setupDatabase } = require('../scripts/setupDatabase');

const router = express.Router();

// One-time database setup endpoint
router.post('/setup-database', async (req, res) => {
  try {
    // Simple security check - only allow with a secret key
    const setupKey = req.headers['x-setup-key'];
    
    if (setupKey !== 'setup-clubos-db-2025') {
      return res.status(401).json({
        success: false,
        message: 'Invalid setup key'
      });
    }
    
    console.log('Starting database setup via HTTP endpoint...');
    
    // Run the setup
    await setupDatabase();
    
    res.json({
      success: true,
      message: 'Database setup completed successfully'
    });
    
  } catch (error) {
    console.error('Database setup failed:', error);
    res.status(500).json({
      success: false,
      message: 'Database setup failed',
      error: error.message
    });
  }
});

module.exports = router;
