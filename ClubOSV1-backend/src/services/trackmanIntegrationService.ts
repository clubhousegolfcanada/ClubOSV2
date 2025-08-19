import axios from 'axios';
import pool from '../config/database';
import logger from '../utils/logger';

interface TrackManSettings {
  courseId: string;
  courseName: string;
  holes: number;
  scoringType: 'stroke_play' | 'match_play' | 'stableford';
  teeType?: 'championship' | 'mens' | 'ladies' | 'forward';
  windSpeed?: number;
  windDirection?: number;
  pinPosition?: 'front' | 'middle' | 'back';
  gameMode?: 'practice' | 'tournament' | 'casual';
}

interface TrackManRound {
  roundId: string;
  userId: string;
  courseId: string;
  startTime: Date;
  endTime?: Date;
  totalScore: number;
  holes: TrackManHole[];
  settings: TrackManSettings;
  verified: boolean;
}

interface TrackManHole {
  holeNumber: number;
  par: number;
  score: number;
  strokes: number;
  putts?: number;
  fairwayHit?: boolean;
  greenInRegulation?: boolean;
  distance?: number;
}

class TrackManIntegrationService {
  private apiUrl: string;
  private apiKey: string;
  private webhookSecret: string;

  constructor() {
    this.apiUrl = process.env.TRACKMAN_API_URL || 'https://api.trackman.com/v1';
    this.apiKey = process.env.TRACKMAN_API_KEY || '';
    this.webhookSecret = process.env.TRACKMAN_WEBHOOK_SECRET || '';
  }

  /**
   * Get available course settings from TrackMan catalog
   */
  async getSettingsCatalog(): Promise<TrackManSettings[]> {
    try {
      // In production, this would call the actual TrackMan API
      // For now, return mock data
      const catalog = [
        {
          courseId: 'pebble-beach',
          courseName: 'Pebble Beach',
          holes: 18,
          scoringType: 'stroke_play' as const,
          teeType: 'championship' as const
        },
        {
          courseId: 'st-andrews',
          courseName: 'St Andrews Old Course',
          holes: 18,
          scoringType: 'stroke_play' as const,
          teeType: 'championship' as const
        },
        {
          courseId: 'augusta-national',
          courseName: 'Augusta National',
          holes: 18,
          scoringType: 'stroke_play' as const,
          teeType: 'championship' as const
        },
        {
          courseId: 'quick-9',
          courseName: 'Quick 9 Holes',
          holes: 9,
          scoringType: 'stroke_play' as const,
          teeType: 'mens' as const
        },
        {
          courseId: 'match-play-18',
          courseName: 'Match Play Championship',
          holes: 18,
          scoringType: 'match_play' as const,
          teeType: 'championship' as const
        }
      ];

      // Cache in database
      for (const setting of catalog) {
        await pool.query(
          `INSERT INTO trackman_settings_catalog 
           (id, name, category, course_name, holes, scoring_type, tee_type, is_active)
           VALUES ($1, $2, $3, $4, $5, $6, $7, true)
           ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name,
           is_active = true,
           updated_at = CURRENT_TIMESTAMP`,
          [
            setting.courseId,
            setting.courseName,
            'standard',
            setting.courseName,
            setting.holes,
            setting.scoringType,
            setting.teeType
          ]
        );
      }

      return catalog;
    } catch (error) {
      logger.error('Error fetching TrackMan settings catalog:', error);
      throw error;
    }
  }

  /**
   * Verify a round was actually played
   */
  async verifyRound(roundId: string, userId: string): Promise<TrackManRound | null> {
    try {
      // In production, this would call TrackMan API to verify the round
      // For now, check our database for recorded round data
      const result = await pool.query(
        `SELECT * FROM trackman_rounds 
         WHERE round_id = $1 AND user_id = $2`,
        [roundId, userId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const round = result.rows[0];
      return {
        roundId: round.round_id,
        userId: round.user_id,
        courseId: round.course_id,
        startTime: round.start_time,
        endTime: round.end_time,
        totalScore: round.total_score,
        holes: round.hole_data || [],
        settings: round.settings,
        verified: round.verified
      };
    } catch (error) {
      logger.error('Error verifying TrackMan round:', error);
      return null;
    }
  }

  /**
   * Sync round data from TrackMan
   */
  async syncRoundData(challengeId: string, userId: string): Promise<boolean> {
    try {
      // Get challenge details
      const challengeResult = await pool.query(
        'SELECT * FROM challenges WHERE id = $1',
        [challengeId]
      );

      if (challengeResult.rows.length === 0) {
        throw new Error('Challenge not found');
      }

      const challenge = challengeResult.rows[0];

      // In production, this would call TrackMan API to get recent rounds
      // For now, simulate with mock data
      const mockRound = await this.generateMockRound(
        userId,
        challenge.course_id,
        challenge.trackman_settings
      );

      // Store round data
      await pool.query(
        `INSERT INTO trackman_rounds 
         (round_id, user_id, challenge_id, course_id, start_time, end_time, 
          total_score, hole_data, settings, verified, raw_data)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, $10)
         ON CONFLICT (round_id) DO UPDATE SET
         total_score = EXCLUDED.total_score,
         verified = true`,
        [
          mockRound.roundId,
          userId,
          challengeId,
          mockRound.courseId,
          mockRound.startTime,
          mockRound.endTime,
          mockRound.totalScore,
          JSON.stringify(mockRound.holes),
          JSON.stringify(mockRound.settings),
          JSON.stringify(mockRound)
        ]
      );

      // Record play in challenge
      await pool.query(
        `INSERT INTO challenge_plays 
         (challenge_id, user_id, trackman_round_id, score, played_at)
         VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
         ON CONFLICT (challenge_id, user_id) DO UPDATE SET
         trackman_round_id = EXCLUDED.trackman_round_id,
         score = EXCLUDED.score,
         played_at = EXCLUDED.played_at`,
        [challengeId, userId, mockRound.roundId, mockRound.totalScore]
      );

      // Update challenge status
      await this.updateChallengeStatus(challengeId);

      return true;
    } catch (error) {
      logger.error('Error syncing TrackMan round data:', error);
      return false;
    }
  }

  /**
   * Update challenge status based on plays
   */
  private async updateChallengeStatus(challengeId: string) {
    const playsResult = await pool.query(
      `SELECT COUNT(*) as play_count 
       FROM challenge_plays 
       WHERE challenge_id = $1`,
      [challengeId]
    );

    const playCount = parseInt(playsResult.rows[0].play_count);

    if (playCount === 1) {
      // First player has played
      await pool.query(
        `UPDATE challenges 
         SET status = 'awaiting_sync' 
         WHERE id = $1 AND status = 'accepted'`,
        [challengeId]
      );
    } else if (playCount === 2) {
      // Both players have played - ready to resolve
      await pool.query(
        `UPDATE challenges 
         SET status = 'ready_resolve' 
         WHERE id = $1`,
        [challengeId]
      );
    }
  }

  /**
   * Generate mock round data for testing
   */
  private async generateMockRound(
    userId: string,
    courseId: string,
    settings: any
  ): Promise<TrackManRound> {
    const holes = settings.holes || 18;
    const holeData: TrackManHole[] = [];
    let totalScore = 0;

    // Generate realistic golf scores
    for (let i = 1; i <= holes; i++) {
      const par = i % 3 === 0 ? 3 : i % 5 === 0 ? 5 : 4; // Mix of par 3, 4, 5
      const score = par + Math.floor(Math.random() * 3) - 1; // -1 to +1 from par
      
      holeData.push({
        holeNumber: i,
        par,
        score,
        strokes: score,
        putts: Math.max(1, Math.floor(Math.random() * 3) + 1),
        fairwayHit: Math.random() > 0.4,
        greenInRegulation: Math.random() > 0.3,
        distance: par === 3 ? 150 + Math.random() * 50 :
                  par === 4 ? 350 + Math.random() * 100 :
                  450 + Math.random() * 100
      });
      
      totalScore += score;
    }

    const startTime = new Date();
    startTime.setHours(startTime.getHours() - 3); // Started 3 hours ago
    
    return {
      roundId: `TM-${Date.now()}-${userId.substring(0, 8)}`,
      userId,
      courseId,
      startTime,
      endTime: new Date(),
      totalScore,
      holes: holeData,
      settings,
      verified: true
    };
  }

  /**
   * Handle webhook from TrackMan for real-time updates
   */
  async handleWebhook(payload: any, signature: string): Promise<void> {
    try {
      // Verify webhook signature
      if (!this.verifyWebhookSignature(payload, signature)) {
        throw new Error('Invalid webhook signature');
      }

      const { event, data } = payload;

      switch (event) {
        case 'round.completed':
          await this.handleRoundCompleted(data);
          break;
        
        case 'round.started':
          await this.handleRoundStarted(data);
          break;
        
        case 'shot.recorded':
          await this.handleShotRecorded(data);
          break;
        
        default:
          logger.warn(`Unknown TrackMan webhook event: ${event}`);
      }
    } catch (error) {
      logger.error('Error handling TrackMan webhook:', error);
      throw error;
    }
  }

  /**
   * Verify webhook signature
   */
  private verifyWebhookSignature(payload: any, signature: string): boolean {
    // In production, implement proper HMAC signature verification
    // For now, return true for testing
    return true;
  }

  /**
   * Handle round completed webhook
   */
  private async handleRoundCompleted(data: any) {
    const { roundId, userId, score, challengeId } = data;

    if (challengeId) {
      // Update challenge play
      await pool.query(
        `UPDATE challenge_plays 
         SET score = $1, synced_at = CURRENT_TIMESTAMP 
         WHERE challenge_id = $2 AND user_id = $3`,
        [score, challengeId, userId]
      );

      // Check if both players have completed
      await this.updateChallengeStatus(challengeId);
    }

    logger.info(`Round ${roundId} completed for user ${userId} with score ${score}`);
  }

  /**
   * Handle round started webhook
   */
  private async handleRoundStarted(data: any) {
    const { roundId, userId, challengeId } = data;

    if (challengeId) {
      // Update challenge to active
      await pool.query(
        `UPDATE challenges 
         SET status = 'active' 
         WHERE id = $1 AND status = 'accepted'`,
        [challengeId]
      );
    }

    logger.info(`Round ${roundId} started for user ${userId}`);
  }

  /**
   * Handle shot recorded webhook
   */
  private async handleShotRecorded(data: any) {
    // Could be used for live tracking in the future
    logger.debug('Shot recorded:', data);
  }

  /**
   * Get round statistics for a user
   */
  async getUserRoundStats(userId: string): Promise<any> {
    try {
      const result = await pool.query(
        `SELECT 
          COUNT(*) as total_rounds,
          AVG(total_score) as avg_score,
          MIN(total_score) as best_score,
          MAX(total_score) as worst_score
         FROM trackman_rounds
         WHERE user_id = $1 AND verified = true`,
        [userId]
      );

      return result.rows[0];
    } catch (error) {
      logger.error('Error getting user round stats:', error);
      return null;
    }
  }
}

// Export singleton instance
export default new TrackManIntegrationService();