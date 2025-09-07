import express from 'express';
import { authenticate } from '../middleware/auth';
import { query as db } from '../utils/db';
import logger from '../utils/logger';

const router = express.Router();

// Get current inventory
router.get('/inventory', authenticate, async (req, res) => {
  try {
    const [features, branding, sops, integrations] = await Promise.all([
      db('SELECT * FROM feature_inventory ORDER BY category, name'),
      db('SELECT * FROM branding_inventory ORDER BY element_type'),
      db('SELECT * FROM sop_inventory ORDER BY category, name'),
      db('SELECT * FROM integration_inventory ORDER BY type, name')
    ]);

    res.json({
      features: features.rows,
      branding: branding.rows,
      sops: sops.rows,
      integrations: integrations.rows
    });
  } catch (error) {
    logger.error('Error fetching inventory:', error);
    res.status(500).json({ error: 'Failed to fetch inventory' });
  }
});

// Add feature
router.post('/inventory/feature', authenticate, async (req, res) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { name, category, is_transferable, notes } = req.body;
    
    const result = await db(
      `INSERT INTO feature_inventory (name, category, is_transferable, notes) 
       VALUES ($1, $2, $3, $4) 
       RETURNING *`,
      [name, category, is_transferable || false, notes || '']
    );

    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Error adding feature:', error);
    res.status(500).json({ error: 'Failed to add feature' });
  }
});

// Add branding item
router.post('/inventory/branding', authenticate, async (req, res) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { element_type, current_value, is_customizable, notes } = req.body;
    
    const result = await db(
      `INSERT INTO branding_inventory (element_type, current_value, is_customizable, notes) 
       VALUES ($1, $2, $3, $4) 
       RETURNING *`,
      [element_type, current_value, is_customizable || false, notes || '']
    );

    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Error adding branding:', error);
    res.status(500).json({ error: 'Failed to add branding' });
  }
});

// Add SOP
router.post('/inventory/sop', authenticate, async (req, res) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { name, category, is_industry_specific, notes } = req.body;
    
    const result = await db(
      `INSERT INTO sop_inventory (name, category, is_industry_specific, notes) 
       VALUES ($1, $2, $3, $4) 
       RETURNING *`,
      [name, category, is_industry_specific || false, notes || '']
    );

    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Error adding SOP:', error);
    res.status(500).json({ error: 'Failed to add SOP' });
  }
});

// Add integration
router.post('/inventory/integration', authenticate, async (req, res) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { name, type, is_required, notes } = req.body;
    
    const result = await db(
      `INSERT INTO integration_inventory (name, type, is_required, notes) 
       VALUES ($1, $2, $3, $4) 
       RETURNING *`,
      [name, type, is_required || false, notes || '']
    );

    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Error adding integration:', error);
    res.status(500).json({ error: 'Failed to add integration' });
  }
});

// Delete inventory item
router.delete('/inventory/:type/:id', authenticate, async (req, res) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { type, id } = req.params;
    const tables: Record<string, string> = {
      feature: 'feature_inventory',
      branding: 'branding_inventory',
      sop: 'sop_inventory',
      integration: 'integration_inventory'
    };

    const table = tables[type];
    if (!table) {
      return res.status(400).json({ error: 'Invalid type' });
    }

    await db(`DELETE FROM ${table} WHERE id = $1`, [id]);
    res.json({ success: true });
  } catch (error) {
    logger.error('Error deleting item:', error);
    res.status(500).json({ error: 'Failed to delete item' });
  }
});

// Get saved configurations
router.get('/configurations', authenticate, async (req, res) => {
  try {
    const result = await db(
      'SELECT * FROM white_label_configurations ORDER BY created_at DESC'
    );
    res.json(result.rows);
  } catch (error) {
    logger.error('Error fetching configurations:', error);
    res.status(500).json({ error: 'Failed to fetch configurations' });
  }
});

// Save a new configuration
router.post('/configurations', authenticate, async (req, res) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { name, features, branding, sops, integrations } = req.body;
    
    const result = await db(
      `INSERT INTO white_label_configurations (name, features, branding, sops, integrations, created_by) 
       VALUES ($1, $2, $3, $4, $5, $6) 
       RETURNING *`,
      [
        name,
        JSON.stringify({ selected: features }),
        JSON.stringify({ selected: branding }),
        JSON.stringify({ selected: sops }),
        JSON.stringify({ selected: integrations }),
        req.user.id
      ]
    );

    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Error saving configuration:', error);
    res.status(500).json({ error: 'Failed to save configuration' });
  }
});

// Generate implementation blueprint
router.get('/blueprint/:configId', authenticate, async (req, res) => {
  try {
    const configResult = await db(
      'SELECT * FROM white_label_configurations WHERE id = $1',
      [req.params.configId]
    );

    if (configResult.rows.length === 0) {
      return res.status(404).json({ error: 'Configuration not found' });
    }

    const config = configResult.rows[0];
    
    // Fetch selected items from inventory
    const [features, branding, sops, integrations] = await Promise.all([
      db(
        'SELECT * FROM feature_inventory WHERE id = ANY($1::uuid[])',
        [config.features.selected || []]
      ),
      db(
        'SELECT * FROM branding_inventory WHERE id = ANY($1::uuid[])',
        [config.branding.selected || []]
      ),
      db(
        'SELECT * FROM sop_inventory WHERE id = ANY($1::uuid[])',
        [config.sops.selected || []]
      ),
      db(
        'SELECT * FROM integration_inventory WHERE id = ANY($1::uuid[])',
        [config.integrations.selected || []]
      )
    ]);

    const blueprint = {
      configuration: {
        id: config.id,
        name: config.name,
        created_at: config.created_at
      },
      implementation: {
        features: features.rows,
        branding: branding.rows,
        sops: sops.rows,
        integrations: integrations.rows
      },
      migration_steps: [
        {
          phase: 'Database Setup',
          tasks: [
            'Create tenant schema',
            'Set up multi-tenancy support',
            'Migrate existing data to tenant structure'
          ]
        },
        {
          phase: 'Authentication',
          tasks: [
            'Implement tenant-aware authentication',
            'Add tenant switching capability',
            'Update JWT tokens with tenant context'
          ]
        },
        {
          phase: 'Branding',
          tasks: branding.rows.filter((b: any) => b.is_customizable).map((b: any) => 
            `Make ${b.element_type} customizable`
          )
        },
        {
          phase: 'Feature Configuration',
          tasks: features.rows.filter((f: any) => !f.is_transferable).map((f: any) =>
            `Make ${f.name} configurable or optional`
          )
        },
        {
          phase: 'Integration Updates',
          tasks: integrations.rows.map((i: any) =>
            i.is_required 
              ? `Ensure ${i.name} supports multi-tenancy`
              : `Make ${i.name} optional per tenant`
          )
        }
      ],
      estimated_effort: {
        database: '2-3 weeks',
        backend: '3-4 weeks',
        frontend: '2-3 weeks',
        testing: '1-2 weeks',
        total: '8-12 weeks'
      }
    };

    res.json(blueprint);
  } catch (error) {
    logger.error('Error generating blueprint:', error);
    res.status(500).json({ error: 'Failed to generate blueprint' });
  }
});

export default router;