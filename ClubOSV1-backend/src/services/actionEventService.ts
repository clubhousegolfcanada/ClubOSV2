/**
 * ActionEventService - Unified action log for V3-PLS situation-based learning
 *
 * This service captures all operator actions (door unlocks, device sessions,
 * ticket creation, etc.) for correlation with customer conversations.
 *
 * Part of the V3-PLS Enhanced Learning System (Phase 1)
 */

import { db } from '../utils/database';
import { logger } from '../utils/logger';

export interface ActionEvent {
  actionType: ActionType;
  actionSource: ActionSource;
  phoneNumber?: string;
  conversationId?: string;
  operatorId?: string;
  operatorName?: string;
  actionParams?: Record<string, any>;
  actionResult?: Record<string, any>;
  success?: boolean;
  durationMs?: number;
}

export type ActionType =
  | 'door_unlock'
  | 'device_reset'
  | 'device_session'
  | 'ticket_create'
  | 'ticket_update'
  | 'ticket_close'
  | 'booking_create'
  | 'booking_update'
  | 'booking_cancel'
  | 'message_send'
  | 'pattern_execute'
  | 'escalation';

export type ActionSource =
  | 'unifi'
  | 'ninjaone'
  | 'splashtop'
  | 'tickets'
  | 'booking'
  | 'openphone'
  | 'v3pls'
  | 'manual';

export interface ActionEventRow {
  id: number;
  action_type: string;
  action_source: string;
  phone_number: string | null;
  conversation_id: string | null;
  operator_id: string | null;
  operator_name: string | null;
  action_params: Record<string, any>;
  action_result: Record<string, any>;
  success: boolean;
  created_at: Date;
  duration_ms: number | null;
}

class ActionEventService {
  private static instance: ActionEventService;

  private constructor() {
    logger.info('[ActionEventService] Initialized');
  }

  static getInstance(): ActionEventService {
    if (!ActionEventService.instance) {
      ActionEventService.instance = new ActionEventService();
    }
    return ActionEventService.instance;
  }

  /**
   * Emit an action event to the database for correlation with conversations
   *
   * @param event - The action event to record
   * @returns The ID of the created event, or null if failed
   */
  async emitAction(event: ActionEvent): Promise<number | null> {
    try {
      const result = await db.query(`
        INSERT INTO action_events
        (action_type, action_source, phone_number, conversation_id,
         operator_id, operator_name, action_params, action_result,
         success, duration_ms)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING id
      `, [
        event.actionType,
        event.actionSource,
        event.phoneNumber || null,
        event.conversationId || null,
        event.operatorId || null,
        event.operatorName || null,
        JSON.stringify(event.actionParams || {}),
        JSON.stringify(event.actionResult || {}),
        event.success ?? true,
        event.durationMs || null
      ]);

      const eventId = result.rows[0]?.id;

      logger.info('[ActionEvent] Recorded', {
        id: eventId,
        type: event.actionType,
        source: event.actionSource,
        phone: event.phoneNumber ? `...${event.phoneNumber.slice(-4)}` : null
      });

      return eventId;
    } catch (error) {
      // Table might not exist yet if migration hasn't run
      if ((error as any)?.code === '42P01') {
        logger.debug('[ActionEvent] Table not yet created, skipping');
        return null;
      }
      logger.error('[ActionEvent] Failed to emit', { error, event: event.actionType });
      return null;
    }
  }

  /**
   * Get recent actions for a phone number (for correlation with conversations)
   *
   * @param phoneNumber - The customer's phone number
   * @param windowMinutes - How far back to look (default 30 minutes)
   * @returns Array of recent actions
   */
  async getRecentActions(
    phoneNumber: string,
    windowMinutes: number = 30
  ): Promise<ActionEventRow[]> {
    try {
      const result = await db.query(`
        SELECT * FROM action_events
        WHERE phone_number = $1
          AND created_at > NOW() - INTERVAL '1 minute' * $2
        ORDER BY created_at DESC
      `, [phoneNumber, windowMinutes]);

      return result.rows;
    } catch (error) {
      // Table might not exist yet
      if ((error as any)?.code === '42P01') {
        return [];
      }
      logger.error('[ActionEvent] Failed to get recent actions', { error, phoneNumber });
      return [];
    }
  }

  /**
   * Get recent actions by an operator (for learning their patterns)
   *
   * @param operatorId - The operator's user ID
   * @param windowMinutes - How far back to look (default 60 minutes)
   * @returns Array of recent actions
   */
  async getOperatorActions(
    operatorId: string,
    windowMinutes: number = 60
  ): Promise<ActionEventRow[]> {
    try {
      const result = await db.query(`
        SELECT * FROM action_events
        WHERE operator_id = $1
          AND created_at > NOW() - INTERVAL '1 minute' * $2
        ORDER BY created_at DESC
      `, [operatorId, windowMinutes]);

      return result.rows;
    } catch (error) {
      if ((error as any)?.code === '42P01') {
        return [];
      }
      logger.error('[ActionEvent] Failed to get operator actions', { error, operatorId });
      return [];
    }
  }

  /**
   * Find actions correlated with a conversation (within time window)
   *
   * @param conversationId - The conversation ID to correlate with
   * @param phoneNumber - The customer's phone number
   * @param windowMinutes - Window before/after conversation (default 30 minutes)
   * @returns Array of correlated actions
   */
  async getCorrelatedActions(
    conversationId: string,
    phoneNumber: string,
    windowMinutes: number = 30
  ): Promise<ActionEventRow[]> {
    try {
      const result = await db.query(`
        SELECT ae.* FROM action_events ae
        WHERE (ae.conversation_id = $1 OR ae.phone_number = $2)
          AND ae.created_at > NOW() - INTERVAL '1 minute' * $3
        ORDER BY ae.created_at DESC
      `, [conversationId, phoneNumber, windowMinutes]);

      return result.rows;
    } catch (error) {
      if ((error as any)?.code === '42P01') {
        return [];
      }
      logger.error('[ActionEvent] Failed to get correlated actions', { error, conversationId });
      return [];
    }
  }

  /**
   * Get action statistics for analytics
   *
   * @param hours - How many hours back to analyze (default 24)
   * @returns Statistics by action type and source
   */
  async getActionStats(hours: number = 24): Promise<{
    byType: Record<string, number>;
    bySource: Record<string, number>;
    total: number;
    successRate: number;
  }> {
    try {
      const result = await db.query(`
        SELECT
          action_type,
          action_source,
          COUNT(*) as count,
          SUM(CASE WHEN success THEN 1 ELSE 0 END) as success_count
        FROM action_events
        WHERE created_at > NOW() - INTERVAL '1 hour' * $1
        GROUP BY action_type, action_source
      `, [hours]);

      const byType: Record<string, number> = {};
      const bySource: Record<string, number> = {};
      let total = 0;
      let successCount = 0;

      for (const row of result.rows) {
        byType[row.action_type] = (byType[row.action_type] || 0) + parseInt(row.count);
        bySource[row.action_source] = (bySource[row.action_source] || 0) + parseInt(row.count);
        total += parseInt(row.count);
        successCount += parseInt(row.success_count);
      }

      return {
        byType,
        bySource,
        total,
        successRate: total > 0 ? successCount / total : 1
      };
    } catch (error) {
      if ((error as any)?.code === '42P01') {
        return { byType: {}, bySource: {}, total: 0, successRate: 1 };
      }
      logger.error('[ActionEvent] Failed to get stats', { error });
      return { byType: {}, bySource: {}, total: 0, successRate: 1 };
    }
  }
}

// Export singleton instance
export const actionEventService = ActionEventService.getInstance();
