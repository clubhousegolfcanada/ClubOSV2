import { query } from '../utils/db';
import { logger } from '../utils/logger';
import { openPhoneService } from '../services/openphoneService';
import { storeClubAIMessage } from '../services/clubaiService';

/**
 * Durable follow-up for ClubAI-triggered TrackMan restarts / radar reboots.
 *
 * Replaces the in-memory `setTimeout(..., 120000)` that used to live in the
 * openphone webhook handler. That timer was lost on every git push (Railway
 * restarts the process on each deploy), so a restart triggered shortly before a
 * deploy never sent its success/failure follow-up and never escalated on failure.
 *
 * The durable state lives on the conversation row (set by the webhook when the
 * restart is triggered): clubai_restart_state, clubai_restart_command_id. This
 * job polls that state every 30s and reacts once the command reaches a terminal
 * state — or after a timeout if the agent never completes it. Because the state
 * is in the DB and this poller is re-established on every boot, a follow-up owed
 * across a deploy is still delivered by the next process.
 */

const POLL_INTERVAL_MS = 30 * 1000;
// If the command hasn't completed within this window, treat it as failed and
// escalate. The customer was told "~2 minutes"; give a little slack before we
// hand off to a human. The command itself expires in the queue at 10 minutes.
const FOLLOWUP_TIMEOUT_SEC = 300;

const ACTIVE_STATES = ['restart_triggered', 'radar_reboot_triggered'];

class ClubAIRestartFollowupJob {
  private timer: NodeJS.Timeout | null = null;
  private isRunning = false;

  start() {
    if (this.timer) return;
    this.timer = setInterval(() => this.tick(), POLL_INTERVAL_MS);
    logger.info('ClubAI restart follow-up job started (30s poll)');
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async tick() {
    if (this.isRunning) return; // never overlap ticks
    this.isRunning = true;
    try {
      let rows: any[];
      try {
        const result = await query(
          `SELECT c.id, c.phone_number, c.clubai_restart_state AS state,
                  cmd.status AS cmd_status,
                  EXTRACT(EPOCH FROM (NOW() - cmd.requested_at)) AS elapsed_sec
           FROM openphone_conversations c
           JOIN trackman_restart_commands cmd ON cmd.id = c.clubai_restart_command_id
           WHERE c.clubai_restart_state = ANY($1)`,
          [ACTIVE_STATES]
        );
        rows = result.rows;
      } catch (err: any) {
        // 42703 = clubai_restart_* columns not migrated yet — nothing to do.
        if (err.code === '42703') return;
        throw err;
      }

      for (const row of rows) {
        const isRadar = row.state === 'radar_reboot_triggered';
        const elapsed = Number(row.elapsed_sec) || 0;
        const status = row.cmd_status as string;

        const succeeded = status === 'completed';
        const failed = status === 'failed' || status === 'expired'
          || (status !== 'completed' && elapsed >= FOLLOWUP_TIMEOUT_SEC);

        if (!succeeded && !failed) continue; // still in flight — check again next tick

        await this.finalize(row.id, row.phone_number, isRadar, succeeded);
      }
    } catch (error) {
      logger.error('[ClubAI Follow-up] tick error:', error);
    } finally {
      this.isRunning = false;
    }
  }

  private async finalize(convId: string, phoneNumber: string, isRadar: boolean, succeeded: boolean) {
    try {
      // Atomically claim the conversation so a concurrent tick / another process
      // can't send the follow-up twice. For a failure we also escalate inside the
      // same UPDATE, so the conversation is locked for an operator even if the
      // outbound SMS below fails.
      const claim = succeeded
        ? await query(
            `UPDATE openphone_conversations SET clubai_restart_state = NULL
             WHERE id = $1 AND clubai_restart_state = ANY($2) RETURNING id`,
            [convId, ACTIVE_STATES]
          )
        : await query(
            `UPDATE openphone_conversations
             SET clubai_restart_state = NULL, clubai_escalated = true, conversation_locked = true
             WHERE id = $1 AND clubai_restart_state = ANY($2) RETURNING id`,
            [convId, ACTIVE_STATES]
          );

      if (claim.rows.length === 0) return; // already handled by another tick

      const defaultNumber = process.env.OPENPHONE_DEFAULT_NUMBER;
      const msg = succeeded
        ? (isRadar
            ? `Radar should be back — hit a shot and let me know if it's tracking. - ClubAI`
            : `Should be back online now. Let me know if you need anything else! - ClubAI`)
        : (isRadar
            ? `The radar reset didn't go through. Let me connect you with the team. - ClubAI`
            : `The restart didn't go through. Let me connect you with the team. - ClubAI`);

      if (defaultNumber) {
        try {
          await openPhoneService.sendMessage(phoneNumber, defaultNumber, msg);
          await storeClubAIMessage(convId, msg, 0.9);
        } catch (sendErr) {
          // On failure the conversation is already escalated/locked above, so a
          // human still picks it up even if this courtesy SMS didn't send.
          logger.error('[ClubAI Follow-up] send failed:', sendErr);
        }
      }

      logger.info('[ClubAI Follow-up] finalized', { convId, isRadar, succeeded });
    } catch (error) {
      logger.error('[ClubAI Follow-up] finalize error:', error);
    }
  }
}

export const clubaiRestartFollowupJob = new ClubAIRestartFollowupJob();
