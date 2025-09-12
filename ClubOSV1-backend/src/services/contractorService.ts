import { db } from '../utils/database';
import { logger } from '../utils/logger';
import { ContractorPermission } from '../types';

export class ContractorService {
  async getPermissions(userId: string, location?: string): Promise<ContractorPermission[]> {
    try {
      const query = location
        ? `SELECT * FROM contractor_permissions 
           WHERE user_id = $1 AND location = $2 
           AND (active_until IS NULL OR active_until > NOW())`
        : `SELECT * FROM contractor_permissions 
           WHERE user_id = $1 
           AND (active_until IS NULL OR active_until > NOW())`;
      
      const params = location ? [userId, location] : [userId];
      const result = await db.query(query, params);
      
      return result.rows.map(row => ({
        id: row.id,
        userId: row.user_id,
        location: row.location,
        canUnlockDoors: row.can_unlock_doors,
        canSubmitChecklists: row.can_submit_checklists,
        canViewHistory: row.can_view_history,
        activeFrom: row.active_from,
        activeUntil: row.active_until,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        createdBy: row.created_by
      }));
    } catch (error) {
      logger.error('Error getting contractor permissions:', error);
      throw error;
    }
  }

  async canUnlockDoor(userId: string, location: string): Promise<boolean> {
    try {
      const permissions = await this.getPermissions(userId, location);
      return permissions.length > 0 && permissions[0].canUnlockDoors;
    } catch (error) {
      logger.error('Error checking door unlock permission:', error);
      return false;
    }
  }

  async canSubmitChecklist(userId: string, location: string): Promise<boolean> {
    try {
      const permissions = await this.getPermissions(userId, location);
      return permissions.length > 0 && permissions[0].canSubmitChecklists;
    } catch (error) {
      logger.error('Error checking checklist submission permission:', error);
      return false;
    }
  }

  async logDoorUnlock(userId: string, location: string, doorId: string) {
    try {
      // First check if there's an active submission for this contractor
      const existingSubmission = await db.query(
        `SELECT id, door_unlocks FROM contractor_checklist_submissions 
         WHERE contractor_id = $1 AND location = $2 AND end_time IS NULL
         ORDER BY start_time DESC LIMIT 1`,
        [userId, location]
      );

      const doorUnlockData = { 
        doorId, 
        timestamp: new Date().toISOString(),
        location 
      };

      if (existingSubmission.rows.length > 0) {
        // Update existing submission
        const submission = existingSubmission.rows[0];
        const currentUnlocks = submission.door_unlocks || [];
        currentUnlocks.push(doorUnlockData);

        await db.query(
          `UPDATE contractor_checklist_submissions 
           SET door_unlocks = $1, updated_at = NOW()
           WHERE id = $2`,
          [JSON.stringify(currentUnlocks), submission.id]
        );
      } else {
        // Create new submission
        await db.query(
          `INSERT INTO contractor_checklist_submissions 
           (contractor_id, location, door_unlocks, start_time)
           VALUES ($1, $2, $3, NOW())`,
          [userId, location, JSON.stringify([doorUnlockData])]
        );
      }

      logger.info('Contractor door unlock logged', {
        userId,
        location,
        doorId
      });
    } catch (error) {
      logger.error('Error logging door unlock:', error);
      throw error;
    }
  }

  async createPermission(
    userId: string, 
    location: string, 
    permissions: Partial<ContractorPermission>,
    createdBy: string
  ): Promise<ContractorPermission> {
    try {
      const result = await db.query(
        `INSERT INTO contractor_permissions 
         (user_id, location, can_unlock_doors, can_submit_checklists, 
          can_view_history, active_from, active_until, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [
          userId,
          location,
          permissions.canUnlockDoors ?? true,
          permissions.canSubmitChecklists ?? true,
          permissions.canViewHistory ?? false,
          permissions.activeFrom || new Date(),
          permissions.activeUntil || null,
          createdBy
        ]
      );

      return {
        id: result.rows[0].id,
        userId: result.rows[0].user_id,
        location: result.rows[0].location,
        canUnlockDoors: result.rows[0].can_unlock_doors,
        canSubmitChecklists: result.rows[0].can_submit_checklists,
        canViewHistory: result.rows[0].can_view_history,
        activeFrom: result.rows[0].active_from,
        activeUntil: result.rows[0].active_until,
        createdAt: result.rows[0].created_at,
        updatedAt: result.rows[0].updated_at,
        createdBy: result.rows[0].created_by
      };
    } catch (error) {
      logger.error('Error creating contractor permission:', error);
      throw error;
    }
  }

  async updatePermission(
    permissionId: string,
    updates: Partial<ContractorPermission>
  ): Promise<ContractorPermission> {
    try {
      const setClauses = [];
      const values = [];
      let paramCount = 1;

      if (updates.canUnlockDoors !== undefined) {
        setClauses.push(`can_unlock_doors = $${paramCount++}`);
        values.push(updates.canUnlockDoors);
      }
      if (updates.canSubmitChecklists !== undefined) {
        setClauses.push(`can_submit_checklists = $${paramCount++}`);
        values.push(updates.canSubmitChecklists);
      }
      if (updates.canViewHistory !== undefined) {
        setClauses.push(`can_view_history = $${paramCount++}`);
        values.push(updates.canViewHistory);
      }
      if (updates.activeUntil !== undefined) {
        setClauses.push(`active_until = $${paramCount++}`);
        values.push(updates.activeUntil);
      }

      setClauses.push(`updated_at = NOW()`);
      values.push(permissionId);

      const result = await db.query(
        `UPDATE contractor_permissions 
         SET ${setClauses.join(', ')}
         WHERE id = $${paramCount}
         RETURNING *`,
        values
      );

      if (result.rows.length === 0) {
        throw new Error('Permission not found');
      }

      return {
        id: result.rows[0].id,
        userId: result.rows[0].user_id,
        location: result.rows[0].location,
        canUnlockDoors: result.rows[0].can_unlock_doors,
        canSubmitChecklists: result.rows[0].can_submit_checklists,
        canViewHistory: result.rows[0].can_view_history,
        activeFrom: result.rows[0].active_from,
        activeUntil: result.rows[0].active_until,
        createdAt: result.rows[0].created_at,
        updatedAt: result.rows[0].updated_at,
        createdBy: result.rows[0].created_by
      };
    } catch (error) {
      logger.error('Error updating contractor permission:', error);
      throw error;
    }
  }

  async getContractorActivity(userId: string, limit: number = 50) {
    try {
      const result = await db.query(
        `SELECT 
          cs.id,
          cs.location,
          cs.door_unlocks,
          cs.start_time,
          cs.end_time,
          cs.created_at,
          cls.id as submission_id,
          cls.submitted_at,
          cls.location as checklist_location,
          cl.name as checklist_name
         FROM contractor_checklist_submissions cs
         LEFT JOIN checklist_submissions cls ON cs.checklist_submission_id = cls.id
         LEFT JOIN checklists cl ON cls.checklist_id = cl.id
         WHERE cs.contractor_id = $1
         ORDER BY cs.created_at DESC
         LIMIT $2`,
        [userId, limit]
      );

      return result.rows;
    } catch (error) {
      logger.error('Error getting contractor activity:', error);
      throw error;
    }
  }
}

export const contractorService = new ContractorService();