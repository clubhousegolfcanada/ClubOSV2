import { Router, Request, Response } from 'express';
import { query } from '../utils/db';
import { authenticate } from '../middleware/auth';
import { roleGuard } from '../middleware/roleGuard';

const router = Router();

// Direct database fix for contractor role
router.post('/fix', 
  authenticate,
  roleGuard(['admin']),
  async (req: Request, res: Response) => {
    try {
      console.log('Starting contractor role fix...');
      
      // First, check current constraint
      const constraintCheck = await query(`
        SELECT conname, pg_get_constraintdef(oid) as definition
        FROM pg_constraint
        WHERE conname = 'valid_role' 
        AND conrelid = 'users'::regclass
      `);
      
      console.log('Current constraint:', constraintCheck.rows);
      
      // Drop the old constraint
      await query(`ALTER TABLE users DROP CONSTRAINT IF EXISTS valid_role`);
      console.log('Dropped old constraint');
      
      // Add new constraint with contractor
      await query(`
        ALTER TABLE users ADD CONSTRAINT valid_role 
        CHECK (role IN ('admin', 'operator', 'support', 'kiosk', 'customer', 'contractor'))
      `);
      console.log('Added new constraint with contractor');
      
      // Verify the fix
      const newCheck = await query(`
        SELECT pg_get_constraintdef(oid) as definition
        FROM pg_constraint
        WHERE conname = 'valid_role' 
        AND conrelid = 'users'::regclass
      `);
      
      console.log('New constraint:', newCheck.rows[0]?.definition);
      
      res.json({
        success: true,
        message: 'Contractor role constraint fixed successfully',
        constraint: newCheck.rows[0]?.definition
      });
      
    } catch (error: any) {
      console.error('Error fixing contractor role:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        detail: error.detail
      });
    }
  }
);

export default router;