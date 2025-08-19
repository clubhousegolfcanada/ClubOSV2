import pool from '../config/database';
import logger from '../utils/logger';
import notificationService from './notificationService';

interface BadgeRule {
  key: string;
  name: string;
  checkCondition: (userId: string, context?: any) => Promise<boolean>;
  metadata?: (userId: string, context?: any) => Promise<any>;
}

class BadgeRulesEngine {
  private rules: Map<string, BadgeRule> = new Map();

  constructor() {
    this.initializeRules();
  }

  /**
   * Initialize all badge rules
   */
  private initializeRules() {
    // Challenge-based badges
    this.addRule({
      key: 'serial_challenger',
      name: 'Serial Challenger',
      checkCondition: async (userId) => {
        const result = await pool.query(
          'SELECT COUNT(*) as count FROM challenges WHERE creator_id = $1',
          [userId]
        );
        return parseInt(result.rows[0].count) >= 10;
      }
    });

    this.addRule({
      key: 'acceptance_speech',
      name: 'Acceptance Speech',
      checkCondition: async (userId) => {
        const result = await pool.query(
          'SELECT COUNT(*) as count FROM challenges WHERE acceptor_id = $1 AND status != \'declined\'',
          [userId]
        );
        return parseInt(result.rows[0].count) >= 10;
      }
    });

    this.addRule({
      key: 'winning_formula',
      name: 'Winning Formula',
      checkCondition: async (userId) => {
        const result = await pool.query(
          'SELECT COUNT(*) as count FROM challenges WHERE winner_user_id = $1',
          [userId]
        );
        return parseInt(result.rows[0].count) >= 25;
      }
    });

    this.addRule({
      key: 'hot_streak',
      name: 'Hot Streak',
      checkCondition: async (userId) => {
        const result = await pool.query(
          'SELECT max_win_streak FROM customer_profiles WHERE user_id = $1',
          [userId]
        );
        return (result.rows[0]?.max_win_streak || 0) >= 5;
      }
    });

    this.addRule({
      key: 'comeback_kid',
      name: 'Comeback Kid',
      checkCondition: async (userId) => {
        const result = await pool.query(
          'SELECT max_loss_streak FROM customer_profiles WHERE user_id = $1',
          [userId]
        );
        return (result.rows[0]?.max_loss_streak || 0) >= 3;
      }
    });

    // CC-based badges
    this.addRule({
      key: 'century_club',
      name: 'Century Club',
      checkCondition: async (userId) => {
        const result = await pool.query(
          'SELECT total_cc_earned FROM customer_profiles WHERE user_id = $1',
          [userId]
        );
        return (result.rows[0]?.total_cc_earned || 0) >= 100;
      }
    });

    this.addRule({
      key: 'rich_uncle',
      name: 'Rich Uncle',
      checkCondition: async (userId) => {
        const result = await pool.query(
          'SELECT cc_balance FROM customer_profiles WHERE user_id = $1',
          [userId]
        );
        return (result.rows[0]?.cc_balance || 0) >= 1000;
      }
    });

    this.addRule({
      key: 'big_spender',
      name: 'Big Spender',
      checkCondition: async (userId) => {
        const result = await pool.query(
          'SELECT COALESCE(SUM(wager_amount), 0) as total FROM challenges WHERE creator_id = $1',
          [userId]
        );
        return parseFloat(result.rows[0].total) >= 5000;
      }
    });

    // Behavior badges
    this.addRule({
      key: 'reliable',
      name: 'Reliable',
      checkCondition: async (userId) => {
        const result = await pool.query(
          'SELECT credibility_score FROM customer_profiles WHERE user_id = $1',
          [userId]
        );
        return (result.rows[0]?.credibility_score || 0) >= 95;
      }
    });

    this.addRule({
      key: 'david_goliath',
      name: 'David vs Goliath',
      checkCondition: async (userId, context) => {
        if (!context?.challengeId) return false;
        
        const result = await pool.query(
          `SELECT 
            CASE 
              WHEN c.winner_user_id = $1 
              AND ABS(
                (SELECT ARRAY_POSITION(ARRAY['house','amateur','bronze','silver','gold','pro','champion','legend'], cp1.current_rank)) -
                (SELECT ARRAY_POSITION(ARRAY['house','amateur','bronze','silver','gold','pro','champion','legend'], cp2.current_rank))
              ) >= 3
              THEN true
              ELSE false
            END as qualifies
           FROM challenges c
           JOIN customer_profiles cp1 ON cp1.user_id = c.creator_id
           JOIN customer_profiles cp2 ON cp2.user_id = c.acceptor_id
           WHERE c.id = $2`,
          [userId, context.challengeId]
        );
        return result.rows[0]?.qualifies || false;
      }
    });

    this.addRule({
      key: 'perfect_game',
      name: 'Perfect Game',
      checkCondition: async (userId, context) => {
        if (!context?.challengeId) return false;
        
        const result = await pool.query(
          `SELECT 1 FROM challenge_plays 
           WHERE challenge_id = $1 AND user_id = $2 AND score <= 60`,
          [context.challengeId, userId]
        );
        return result.rows.length > 0;
      }
    });

    this.addRule({
      key: 'speed_demon',
      name: 'Speed Demon',
      checkCondition: async (userId, context) => {
        if (!context?.challengeId) return false;
        
        const result = await pool.query(
          `SELECT 1 FROM challenges c
           JOIN challenge_plays cp ON cp.challenge_id = c.id
           WHERE c.id = $1 AND cp.user_id = $2
           AND cp.played_at < c.accepted_at + INTERVAL '1 hour'`,
          [context.challengeId, userId]
        );
        return result.rows.length > 0;
      }
    });

    // Tournament badges
    this.addRule({
      key: 'tournament_champion',
      name: 'Tournament Champion',
      checkCondition: async (userId) => {
        const result = await pool.query(
          'SELECT COUNT(*) as count FROM champion_markers WHERE user_id = $1',
          [userId]
        );
        return parseInt(result.rows[0].count) >= 1;
      }
    });

    logger.info(`Initialized ${this.rules.size} badge rules`);
  }

  /**
   * Add a rule to the engine
   */
  private addRule(rule: BadgeRule) {
    this.rules.set(rule.key, rule);
  }

  /**
   * Check all badges for a user
   */
  async checkAllBadges(userId: string, context?: any): Promise<string[]> {
    const awardedBadges: string[] = [];

    for (const [key, rule] of this.rules) {
      try {
        const awarded = await this.checkAndAwardBadge(userId, key, context);
        if (awarded) {
          awardedBadges.push(key);
        }
      } catch (error) {
        logger.error(`Error checking badge ${key} for user ${userId}:`, error);
      }
    }

    return awardedBadges;
  }

  /**
   * Check and award a specific badge
   */
  async checkAndAwardBadge(userId: string, badgeKey: string, context?: any): Promise<boolean> {
    const rule = this.rules.get(badgeKey);
    if (!rule) {
      logger.warn(`Badge rule not found: ${badgeKey}`);
      return false;
    }

    try {
      // Check if user already has this badge
      const existing = await pool.query(
        'SELECT 1 FROM user_badges WHERE user_id = $1 AND badge_key = $2',
        [userId, badgeKey]
      );

      if (existing.rows.length > 0) {
        return false; // Already has badge
      }

      // Check if condition is met
      const conditionMet = await rule.checkCondition(userId, context);
      if (!conditionMet) {
        return false;
      }

      // Get metadata if available
      const metadata = rule.metadata ? await rule.metadata(userId, context) : {};

      // Award the badge
      await pool.query(
        'INSERT INTO user_badges (user_id, badge_key, metadata) VALUES ($1, $2, $3)',
        [userId, badgeKey, metadata]
      );

      // Log the award
      await pool.query(
        `INSERT INTO badge_audit (user_id, badge_key, action, context)
         VALUES ($1, $2, 'awarded_automatic', $3)`,
        [userId, badgeKey, context || {}]
      );

      // Send notification
      await this.sendBadgeNotification(userId, badgeKey);

      logger.info(`Awarded badge ${badgeKey} to user ${userId}`);
      return true;

    } catch (error) {
      logger.error(`Error awarding badge ${badgeKey} to user ${userId}:`, error);
      return false;
    }
  }

  /**
   * Send notification for badge award
   */
  private async sendBadgeNotification(userId: string, badgeKey: string) {
    try {
      const badgeResult = await pool.query(
        'SELECT name, description FROM badges WHERE key = $1',
        [badgeKey]
      );

      if (badgeResult.rows.length > 0) {
        const badge = badgeResult.rows[0];
        await notificationService.sendToUser(userId, {
          title: 'New Badge Earned!',
          body: `You earned "${badge.name}" - ${badge.description}`,
          data: { type: 'badge_earned', badge_key: badgeKey }
        });
      }
    } catch (error) {
      logger.error('Error sending badge notification:', error);
    }
  }

  /**
   * Trigger badge checks after specific events
   */
  async triggerEvent(event: string, userId: string, context?: any) {
    const badgesToCheck: string[] = [];

    switch (event) {
      case 'challenge_created':
        badgesToCheck.push('serial_challenger', 'big_spender');
        break;
      
      case 'challenge_accepted':
        badgesToCheck.push('acceptance_speech');
        break;
      
      case 'challenge_completed':
        badgesToCheck.push(
          'winning_formula',
          'hot_streak',
          'comeback_kid',
          'century_club',
          'david_goliath',
          'perfect_game',
          'speed_demon'
        );
        break;
      
      case 'cc_balance_updated':
        badgesToCheck.push('rich_uncle', 'century_club');
        break;
      
      case 'rank_updated':
        badgesToCheck.push('gold_standard', 'pro_bono', 'the_champion_rank', 'living_legend');
        break;
      
      case 'tournament_won':
        badgesToCheck.push('tournament_champion');
        break;
      
      case 'credibility_updated':
        badgesToCheck.push('reliable');
        break;
    }

    const awarded: string[] = [];
    for (const badgeKey of badgesToCheck) {
      const wasAwarded = await this.checkAndAwardBadge(userId, badgeKey, context);
      if (wasAwarded) {
        awarded.push(badgeKey);
      }
    }

    if (awarded.length > 0) {
      logger.info(`Event ${event} triggered ${awarded.length} badges for user ${userId}:`, awarded);
    }

    return awarded;
  }

  /**
   * Recalculate all badges for a user (maintenance function)
   */
  async recalculateUserBadges(userId: string): Promise<void> {
    logger.info(`Recalculating all badges for user ${userId}`);
    
    const awarded = await this.checkAllBadges(userId);
    
    logger.info(`Recalculation complete. Awarded ${awarded.length} new badges to user ${userId}`);
  }
}

// Export singleton instance
export default new BadgeRulesEngine();