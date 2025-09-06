import express from 'express';
import { authenticateToken } from '../middleware/auth';
import { WhiteLabelAnalyzer } from '../services/whiteLabelAnalyzer';
import { db } from '../database/db';

const router = express.Router();
const analyzer = new WhiteLabelAnalyzer();

// Analyze the system and populate inventory
router.post('/analyze', authenticateToken, async (req, res) => {
  try {
    // Only admins can run analysis
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const analysis = await analyzer.analyzeSystem();
    res.json(analysis);
  } catch (error) {
    console.error('Error analyzing system:', error);
    res.status(500).json({ error: 'Failed to analyze system' });
  }
});

// Get current inventory
router.get('/inventory', authenticateToken, async (req, res) => {
  try {
    const inventory = await analyzer.getInventorySummary();
    res.json(inventory);
  } catch (error) {
    console.error('Error fetching inventory:', error);
    res.status(500).json({ error: 'Failed to fetch inventory' });
  }
});

// Get saved configurations
router.get('/configurations', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM white_label_configurations ORDER BY created_at DESC'
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching configurations:', error);
    res.status(500).json({ error: 'Failed to fetch configurations' });
  }
});

// Save a new configuration
router.post('/configurations', authenticateToken, async (req, res) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const config = {
      ...req.body,
      created_by: req.user.id
    };

    const saved = await analyzer.saveConfiguration(config);
    res.json(saved);
  } catch (error) {
    console.error('Error saving configuration:', error);
    res.status(500).json({ error: 'Failed to save configuration' });
  }
});

// Generate implementation blueprint
router.post('/blueprint/:configId', authenticateToken, async (req, res) => {
  try {
    const blueprint = await analyzer.generateBlueprint(req.params.configId);
    res.json(blueprint);
  } catch (error) {
    console.error('Error generating blueprint:', error);
    res.status(500).json({ error: 'Failed to generate blueprint' });
  }
});

// Update feature transferability
router.patch('/features/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { is_clubos_specific, is_transferable } = req.body;
    
    const result = await db.query(
      `UPDATE feature_inventory 
       SET is_clubos_specific = $1, is_transferable = $2
       WHERE id = $3
       RETURNING *`,
      [is_clubos_specific, is_transferable, req.params.id]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating feature:', error);
    res.status(500).json({ error: 'Failed to update feature' });
  }
});

// Update branding item
router.patch('/branding/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { replacement_strategy } = req.body;
    
    const result = await db.query(
      `UPDATE branding_inventory 
       SET replacement_strategy = $1
       WHERE id = $2
       RETURNING *`,
      [replacement_strategy, req.params.id]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating branding:', error);
    res.status(500).json({ error: 'Failed to update branding' });
  }
});

// Update SOP
router.patch('/sops/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { is_replaceable, replacement_template } = req.body;
    
    const result = await db.query(
      `UPDATE sop_inventory 
       SET is_replaceable = $1, replacement_template = $2
       WHERE id = $3
       RETURNING *`,
      [is_replaceable, replacement_template, req.params.id]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating SOP:', error);
    res.status(500).json({ error: 'Failed to update SOP' });
  }
});

// Update integration
router.patch('/integrations/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { is_required, is_client_specific } = req.body;
    
    const result = await db.query(
      `UPDATE integration_inventory 
       SET is_required = $1, is_client_specific = $2
       WHERE id = $3
       RETURNING *`,
      [is_required, is_client_specific, req.params.id]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating integration:', error);
    res.status(500).json({ error: 'Failed to update integration' });
  }
});

export default router;