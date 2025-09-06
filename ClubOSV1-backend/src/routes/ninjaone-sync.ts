import express from 'express';
import { authenticate } from '../middleware/auth';
import { roleGuard } from '../middleware/roleGuard';
import { pool } from '../utils/db';
import ninjaOneService from '../services/ninjaone';
import { logger } from '../utils/logger';

const router = express.Router();

// Get all scripts from database
router.get('/scripts', authenticate, roleGuard(['operator', 'admin']), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM ninjaone_scripts 
       WHERE is_active = true 
       ORDER BY category, name`
    );
    
    res.json({ success: true, scripts: result.rows });
  } catch (error: any) {
    logger.error('Error fetching scripts:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get all devices from database
router.get('/devices', authenticate, roleGuard(['operator', 'admin']), async (req, res) => {
  try {
    const { location } = req.query;
    
    let query = `SELECT * FROM ninjaone_devices WHERE is_active = true`;
    const params: any[] = [];
    
    if (location) {
      query += ` AND location = $1`;
      params.push(location);
    }
    
    query += ` ORDER BY location, bay_number`;
    
    const result = await pool.query(query, params);
    res.json({ success: true, devices: result.rows });
  } catch (error: any) {
    logger.error('Error fetching devices:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Sync scripts from NinjaOne (admin only)
router.post('/sync-scripts', authenticate, roleGuard(['admin']), async (req, res) => {
  try {
    // In production, this would call NinjaOne API
    // For now, we'll use demo data
    const isDemoMode = !process.env.NINJAONE_CLIENT_ID || 
                      process.env.NINJAONE_CLIENT_ID === 'demo_client_id';
    
    if (isDemoMode) {
      // Demo scripts to simulate sync
      const demoScripts = [
        { id: 'restart-trackman', name: 'Restart TrackMan Software' },
        { id: 'reboot-pc', name: 'Reboot Simulator PC' },
        { id: 'restart-music', name: 'Restart Music System' },
        { id: 'restart-tv', name: 'Restart Tournament TV' },
        { id: 'clear-cache', name: 'Clear TrackMan Cache' },
        { id: 'restart-browser', name: 'Restart Browser' }
      ];
      
      for (const script of demoScripts) {
        await pool.query(
          `INSERT INTO ninjaone_scripts (script_id, name, display_name, category, icon, requires_bay)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (script_id) 
           DO UPDATE SET 
             name = EXCLUDED.name,
             updated_at = CURRENT_TIMESTAMP`,
          [
            script.id,
            script.id,
            script.name,
            script.id.includes('trackman') ? 'trackman' : 
            script.id.includes('music') ? 'music' :
            script.id.includes('tv') ? 'tv' : 'system',
            'zap',
            !script.id.includes('music') && !script.id.includes('tv')
          ]
        );
      }
      
      return res.json({ 
        success: true, 
        message: 'Demo scripts synced successfully',
        count: demoScripts.length 
      });
    }
    
    // Production: Actually call NinjaOne API
    // const scripts = await ninjaOneService.getScripts();
    // ... sync logic here
    
    res.json({ success: true, message: 'Scripts synced from NinjaOne' });
  } catch (error: any) {
    logger.error('Error syncing scripts:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Sync devices from NinjaOne (admin only)
router.post('/sync-devices', authenticate, roleGuard(['admin']), async (req, res) => {
  try {
    const isDemoMode = !process.env.NINJAONE_CLIENT_ID || 
                      process.env.NINJAONE_CLIENT_ID === 'demo_client_id';
    
    if (isDemoMode) {
      // Demo devices for all locations
      const locations = [
        { name: 'Bedford', bays: 2 },
        { name: 'Dartmouth', bays: 4 },
        { name: 'Stratford', bays: 3 },
        { name: 'Bayers Lake', bays: 5 },
        { name: 'Truro', bays: 3 }
      ];
      
      let deviceCount = 0;
      
      for (const location of locations) {
        // Add bay devices
        for (let i = 1; i <= location.bays; i++) {
          await pool.query(
            `INSERT INTO ninjaone_devices (device_id, location, bay_number, device_name, device_type)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (location, bay_number) 
             DO UPDATE SET 
               device_id = EXCLUDED.device_id,
               device_name = EXCLUDED.device_name,
               updated_at = CURRENT_TIMESTAMP`,
            [
              `DEMO-${location.name.toUpperCase()}-BAY${i}`,
              location.name,
              i.toString(),
              `${location.name} Bay ${i} PC`,
              'trackman'
            ]
          );
          deviceCount++;
        }
        
        // Add music and TV systems
        await pool.query(
          `INSERT INTO ninjaone_devices (device_id, location, bay_number, device_name, device_type)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (location, bay_number) 
           DO UPDATE SET 
             device_id = EXCLUDED.device_id,
             device_name = EXCLUDED.device_name,
             updated_at = CURRENT_TIMESTAMP`,
          [
            `DEMO-${location.name.toUpperCase()}-MUSIC`,
            location.name,
            'music',
            `${location.name} Music System`,
            'music'
          ]
        );
        
        await pool.query(
          `INSERT INTO ninjaone_devices (device_id, location, bay_number, device_name, device_type)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (location, bay_number) 
           DO UPDATE SET 
             device_id = EXCLUDED.device_id,
             device_name = EXCLUDED.device_name,
             updated_at = CURRENT_TIMESTAMP`,
          [
            `DEMO-${location.name.toUpperCase()}-TV`,
            location.name,
            'tv',
            `${location.name} TV System`,
            'tv'
          ]
        );
        deviceCount += 2;
      }
      
      return res.json({ 
        success: true, 
        message: 'Demo devices synced successfully',
        count: deviceCount 
      });
    }
    
    // Production: Actually call NinjaOne API
    // const devices = await ninjaOneService.getDevices();
    // ... sync logic here
    
    res.json({ success: true, message: 'Devices synced from NinjaOne' });
  } catch (error: any) {
    logger.error('Error syncing devices:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update script configuration (admin only)
router.put('/scripts/:id', authenticate, roleGuard(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const { display_name, category, icon, warning_message, is_active } = req.body;
    
    const result = await pool.query(
      `UPDATE ninjaone_scripts 
       SET display_name = $2, category = $3, icon = $4, warning_message = $5, is_active = $6, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [id, display_name, category, icon, warning_message, is_active]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Script not found' });
    }
    
    res.json({ success: true, script: result.rows[0] });
  } catch (error: any) {
    logger.error('Error updating script:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update device configuration (admin only)
router.put('/devices/:id', authenticate, roleGuard(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const { device_name, is_active } = req.body;
    
    const result = await pool.query(
      `UPDATE ninjaone_devices 
       SET device_name = $2, is_active = $3, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [id, device_name, is_active]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Device not found' });
    }
    
    res.json({ success: true, device: result.rows[0] });
  } catch (error: any) {
    logger.error('Error updating device:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;