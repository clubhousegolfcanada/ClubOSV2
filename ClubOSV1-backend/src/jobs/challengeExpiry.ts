import cron from 'node-cron';
import { pool } from '../utils/database';
import { logger } from '../utils/logger';
import { clubCoinService } from '../services/clubCoinService';
import { notificationService } from '../services/notificationService';

class ChallengeExpiryJob {
  private isRunning = false;

  /**
   * Start the expiry job - runs every hour
   */
  start() {
    // Run every hour at minute 0
    cron.schedule('0 * * * *', async () => {
      if (this.isRunning) {
        logger.info('Challenge expiry job already running, skipping...');
        return;
      }

      await this.checkExpiredChallenges();
    });

    // Also run expiry warnings every 30 minutes
    cron.schedule('*/30 * * * *', async () => {
      await this.sendExpiryWarnings();
    });

    logger.info('Challenge expiry job scheduled');
  }

  /**
   * Check and process expired challenges
   */
  async checkExpiredChallenges() {
    this.isRunning = true;
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Find expired challenges that need processing
      // First, lock the challenges we want to process
      const lockQuery = `
        SELECT id FROM challenges
        WHERE status IN ('accepted', 'active', 'awaiting_sync')
        AND expires_at < CURRENT_TIMESTAMP
        FOR UPDATE SKIP LOCKED
      `;
      
      const lockedChallenges = await client.query(lockQuery);
      
      if (lockedChallenges.rows.length === 0) {
        await client.query('COMMIT');
        return;
      }
      
      const challengeIds = lockedChallenges.rows.map(r => r.id);
      
      // Now get the full data with joins
      const expiredQuery = `
        SELECT 
          c.*,
          cp1.played_at as creator_played,
          cp2.played_at as acceptor_played,
          s1.amount as creator_stake,
          s2.amount as acceptor_stake
        FROM challenges c
        LEFT JOIN challenge_plays cp1 ON cp1.challenge_id = c.id AND cp1.user_id = c.creator_id
        LEFT JOIN challenge_plays cp2 ON cp2.challenge_id = c.id AND cp2.user_id = c.acceptor_id
        LEFT JOIN stakes s1 ON s1.challenge_id = c.id AND s1.user_id = c.creator_id
        LEFT JOIN stakes s2 ON s2.challenge_id = c.id AND s2.user_id = c.acceptor_id
        WHERE c.id = ANY($1::uuid[])
      `;

      const result = await client.query(expiredQuery, [challengeIds]);
      
      for (const challenge of result.rows) {
        await this.processExpiredChallenge(challenge, client);
      }

      await client.query('COMMIT');
      
      logger.info(`Processed ${result.rows.length} expired challenges`);
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error processing expired challenges:', error);
    } finally {
      client.release();
      this.isRunning = false;
    }
  }

  /**
   * Process a single expired challenge
   */
  private async processExpiredChallenge(challenge: any, client: any) {
    const creatorPlayed = !!challenge.creator_played;
    const acceptorPlayed = !!challenge.acceptor_played;

    // Both played - auto-resolve
    if (creatorPlayed && acceptorPlayed) {
      await this.autoResolveChallenge(challenge.id, client);
      return;
    }

    // Neither played - refund both
    if (!creatorPlayed && !acceptorPlayed) {
      await this.refundBothPlayers(challenge, client);
      return;
    }

    // Only one played - forfeit the no-show
    if (creatorPlayed && !acceptorPlayed) {
      await this.forfeitNoShow(challenge, 'acceptor', client);
    } else if (!creatorPlayed && acceptorPlayed) {
      await this.forfeitNoShow(challenge, 'creator', client);
    }
  }

  /**
   * Auto-resolve when both have played
   */
  private async autoResolveChallenge(challengeId: string, client: any) {
    try {
      // Update status to ready_resolve
      await client.query(
        `UPDATE challenges SET status = 'ready_resolve' WHERE id = $1`,
        [challengeId]
      );

      // The regular resolution process will handle it
      logger.info(`Challenge ${challengeId} marked for auto-resolution`);
    } catch (error) {
      logger.error(`Error auto-resolving challenge ${challengeId}:`, error);
    }
  }

  /**
   * Refund both players when neither played
   */
  private async refundBothPlayers(challenge: any, client: any) {
    try {
      // Update challenge status
      await client.query(
        `UPDATE challenges SET status = 'expired' WHERE id = $1`,
        [challenge.id]
      );

      // Refund creator stake
      if (challenge.creator_stake) {
        await clubCoinService.refundStakes(
          challenge.id,
          challenge.creator_id,
          parseFloat(challenge.creator_stake),
          'Challenge expired - both players no-show'
        );
      }

      // Refund acceptor stake
      if (challenge.acceptor_stake) {
        await clubCoinService.refundStakes(
          challenge.id,
          challenge.acceptor_id,
          parseFloat(challenge.acceptor_stake),
          'Challenge expired - both players no-show'
        );
      }

      // Log audit
      await client.query(
        `INSERT INTO challenge_audit (challenge_id, event_type, event_data)
         VALUES ($1, 'expired_refund', $2)`,
        [challenge.id, JSON.stringify({ reason: 'both_no_show' })]
      );

      logger.info(`Refunded both players for expired challenge ${challenge.id}`);
    } catch (error) {
      logger.error(`Error refunding challenge ${challenge.id}:`, error);
    }
  }

  /**
   * Forfeit the player who didn't play
   */
  private async forfeitNoShow(challenge: any, noShowRole: 'creator' | 'acceptor', client: any) {
    try {
      const noShowUserId = noShowRole === 'creator' ? challenge.creator_id : challenge.acceptor_id;
      const playedUserId = noShowRole === 'creator' ? challenge.acceptor_id : challenge.creator_id;
      const forfeitAmount = parseFloat(noShowRole === 'creator' ? challenge.creator_stake : challenge.acceptor_stake);

      // Update challenge status
      await client.query(
        `UPDATE challenges 
         SET status = 'resolved', 
             winner_user_id = $1,
             resolved_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [playedUserId, challenge.id]
      );

      // Record no-show
      await client.query(
        `INSERT INTO challenge_no_shows (challenge_id, user_id, role, expected_by, cc_forfeited)
         VALUES ($1, $2, $3, $4, $5)`,
        [challenge.id, noShowUserId, noShowRole, challenge.expires_at, forfeitAmount]
      );

      // Award pot to the player who played
      const totalPot = parseFloat(challenge.creator_stake) + parseFloat(challenge.acceptor_stake);
      await clubCoinService.credit({
        userId: playedUserId,
        type: 'challenge_win',
        amount: totalPot,
        challengeId: challenge.id,
        description: 'Won by opponent no-show'
      });

      // Update credibility score for no-show player
      await client.query(
        `UPDATE customer_profiles 
         SET credibility_score = GREATEST(0, credibility_score - 10)
         WHERE user_id = $1`,
        [noShowUserId]
      );

      // Create result record
      await client.query(
        `INSERT INTO challenge_results 
         (challenge_id, winner_user_id, loser_user_id, base_pot, final_payout, resolution_type)
         VALUES ($1, $2, $3, $4, $5, 'no_show')`,
        [challenge.id, playedUserId, noShowUserId, totalPot, totalPot]
      );

      // Send notifications
      await this.sendNoShowNotifications(playedUserId, noShowUserId, totalPot);

      logger.info(`Forfeited ${noShowRole} for no-show in challenge ${challenge.id}`);
    } catch (error) {
      logger.error(`Error processing no-show for challenge ${challenge.id}:`, error);
    }
  }

  /**
   * Send expiry warning notifications
   */
  async sendExpiryWarnings() {
    try {
      // 72-hour warning
      const warning72Query = `
        SELECT c.*, u1.email as creator_email, u2.email as acceptor_email
        FROM challenges c
        JOIN users u1 ON u1.id = c.creator_id
        JOIN users u2 ON u2.id = c.acceptor_id
        WHERE c.status IN ('accepted', 'active')
        AND c.expires_at BETWEEN CURRENT_TIMESTAMP + INTERVAL '71 hours' 
                            AND CURRENT_TIMESTAMP + INTERVAL '73 hours'
        AND NOT EXISTS (
          SELECT 1 FROM challenge_audit 
          WHERE challenge_id = c.id 
          AND event_type = '72h_warning'
          AND created_at > CURRENT_TIMESTAMP - INTERVAL '24 hours'
        )
      `;

      const warning72 = await pool.query(warning72Query);
      
      for (const challenge of warning72.rows) {
        await this.sendExpiryWarning(challenge, 72);
      }

      // 12-hour warning
      const warning12Query = `
        SELECT c.*, u1.email as creator_email, u2.email as acceptor_email
        FROM challenges c
        JOIN users u1 ON u1.id = c.creator_id
        JOIN users u2 ON u2.id = c.acceptor_id
        WHERE c.status IN ('accepted', 'active')
        AND c.expires_at BETWEEN CURRENT_TIMESTAMP + INTERVAL '11 hours' 
                            AND CURRENT_TIMESTAMP + INTERVAL '13 hours'
        AND NOT EXISTS (
          SELECT 1 FROM challenge_audit 
          WHERE challenge_id = c.id 
          AND event_type = '12h_warning'
          AND created_at > CURRENT_TIMESTAMP - INTERVAL '6 hours'
        )
      `;

      const warning12 = await pool.query(warning12Query);
      
      for (const challenge of warning12.rows) {
        await this.sendExpiryWarning(challenge, 12);
      }

      logger.info(`Sent ${warning72.rows.length} 72h warnings and ${warning12.rows.length} 12h warnings`);
    } catch (error) {
      logger.error('Error sending expiry warnings:', error);
    }
  }

  /**
   * Send expiry warning notification
   */
  private async sendExpiryWarning(challenge: any, hours: number) {
    try {
      // Check who hasn't played
      const playsQuery = `
        SELECT 
          cp1.played_at as creator_played,
          cp2.played_at as acceptor_played
        FROM challenges c
        LEFT JOIN challenge_plays cp1 ON cp1.challenge_id = c.id AND cp1.user_id = c.creator_id
        LEFT JOIN challenge_plays cp2 ON cp2.challenge_id = c.id AND cp2.user_id = c.acceptor_id
        WHERE c.id = $1
      `;

      const plays = await pool.query(playsQuery, [challenge.id]);
      const playData = plays.rows[0];

      // Send to creator if they haven't played
      if (!playData.creator_played) {
        await notificationService.sendToUser(challenge.creator_id, {
          title: `Challenge expires in ${hours} hours!`,
          body: `Complete your round soon or forfeit your stake.`,
          data: { challengeId: challenge.id, type: 'expiry_warning' }
        });
      }

      // Send to acceptor if they haven't played
      if (!playData.acceptor_played) {
        await notificationService.sendToUser(challenge.acceptor_id, {
          title: `Challenge expires in ${hours} hours!`,
          body: `Complete your round soon or forfeit your stake.`,
          data: { challengeId: challenge.id, type: 'expiry_warning' }
        });
      }

      // Log warning sent
      await pool.query(
        `INSERT INTO challenge_audit (challenge_id, event_type, event_data)
         VALUES ($1, $2, $3)`,
        [challenge.id, `${hours}h_warning`, JSON.stringify({ hours })]
      );
    } catch (error) {
      logger.error(`Error sending expiry warning for challenge ${challenge.id}:`, error);
    }
  }

  /**
   * Send no-show notifications
   */
  private async sendNoShowNotifications(winnerId: string, loserId: string, pot: number) {
    try {
      // Notify winner
      await notificationService.sendToUser(winnerId, {
        title: 'Challenge Won by Forfeit',
        body: `Your opponent didn't play. You won ${pot} CC!`,
        data: { type: 'challenge_forfeit' }
      });

      // Notify loser
      await notificationService.sendToUser(loserId, {
        title: 'Challenge Forfeited',
        body: `You didn't complete your round in time. Your stake was forfeited.`,
        data: { type: 'challenge_forfeit' }
      });
    } catch (error) {
      logger.error('Error sending no-show notifications:', error);
    }
  }
}

// Export singleton instance
export default new ChallengeExpiryJob();