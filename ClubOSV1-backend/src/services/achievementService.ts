import pool from '../utils/db';

interface Achievement {
  id: string;
  code: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  badge_url?: string;
  rarity: string;
  points: number;
  is_active: boolean;
  auto_award: boolean;
  auto_criteria?: any;
  metadata?: any;
}

interface UserAchievement {
  id: string;
  user_id: string;
  achievement_id: string;
  awarded_by?: string;
  awarded_at: Date;
  reason?: string;
  tournament_id?: string;
  display_priority: number;
  is_featured: boolean;
  expires_at?: Date;
  metadata?: any;
}

interface AwardAchievementParams {
  userId: string;
  achievementId: string;
  awardedBy: string;
  reason?: string;
  tournamentId?: string;
  metadata?: any;
}

interface CreateCustomAchievementParams {
  userId: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  backgroundColor: string;
  category?: string;
  rarity?: string;
  points?: number;
  reason?: string;
  awardedBy: string;
  tournamentId?: string;
  glowColor?: string;
  animationType?: string;
}

class AchievementService {
  // Create and award custom achievement in one operation
  async createAndAwardCustomAchievement(params: CreateCustomAchievementParams): Promise<string> {
    const {
      userId, name, description, icon, color, backgroundColor,
      category = 'custom', rarity = 'special', points = 100,
      reason, awardedBy, tournamentId, glowColor, animationType
    } = params;

    const sql = `
      SELECT create_and_award_achievement(
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
      ) as achievement_id
    `;
    
    const result = await pool.query(sql, [
      userId, name, description, icon, color, backgroundColor,
      category, rarity, points, reason, awardedBy, tournamentId,
      glowColor, animationType
    ]);
    
    return result.rows[0].achievement_id;
  }
  // Get all available achievements
  async getAllAchievements(category?: string): Promise<Achievement[]> {
    let sql = `
      SELECT 
        id, code, name, description, category, icon, badge_url,
        rarity, points, is_active, auto_award, auto_criteria,
        display_order, metadata
      FROM achievements
      WHERE is_active = true
    `;
    
    const params: any[] = [];
    if (category) {
      sql += ' AND category = $1';
      params.push(category);
    }
    
    sql += ' ORDER BY display_order, category, rarity DESC, name';
    
    const result = await pool.query(sql, params);
    return result.rows;
  }

  // Get achievements for a specific user
  async getUserAchievements(userId: string): Promise<any[]> {
    const sql = `
      SELECT 
        ua.id,
        ua.achievement_id,
        ua.awarded_at,
        ua.awarded_by,
        ua.reason,
        ua.tournament_id,
        ua.display_priority,
        ua.is_featured,
        ua.expires_at,
        ua.metadata as user_metadata,
        a.code,
        a.name,
        a.description,
        a.category,
        a.icon,
        a.badge_url,
        a.rarity,
        a.points,
        a.metadata as achievement_metadata,
        u.name as awarded_by_name
      FROM user_achievements ua
      JOIN achievements a ON a.id = ua.achievement_id
      LEFT JOIN users u ON u.id = ua.awarded_by
      WHERE ua.user_id = $1
        AND (ua.expires_at IS NULL OR ua.expires_at > NOW())
      ORDER BY 
        ua.is_featured DESC,
        ua.display_priority DESC,
        CASE a.rarity 
          WHEN 'legendary' THEN 4
          WHEN 'epic' THEN 3
          WHEN 'rare' THEN 2
          WHEN 'common' THEN 1
        END DESC,
        ua.awarded_at DESC
    `;
    
    const result = await pool.query(sql, [userId]);
    return result.rows;
  }

  // Award achievement to a user
  async awardAchievement(params: AwardAchievementParams): Promise<UserAchievement> {
    const { userId, achievementId, awardedBy, reason, tournamentId, metadata } = params;
    
    // Check if achievement exists and is active
    const achievementCheck = await pool.query(
      'SELECT id, name FROM achievements WHERE id = $1 AND is_active = true',
      [achievementId]
    );
    
    if (achievementCheck.rows.length === 0) {
      throw new Error('Achievement not found or inactive');
    }
    
    // Check if already awarded (for the same tournament if applicable)
    const existingCheck = await pool.query(
      `SELECT id FROM user_achievements 
       WHERE user_id = $1 AND achievement_id = $2 
       AND ($3::VARCHAR IS NULL OR tournament_id = $3)`,
      [userId, achievementId, tournamentId]
    );
    
    if (existingCheck.rows.length > 0) {
      throw new Error('Achievement already awarded to this user');
    }
    
    // Award the achievement
    const sql = `
      INSERT INTO user_achievements (
        user_id, achievement_id, awarded_by, reason, 
        tournament_id, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    
    const result = await pool.query(sql, [
      userId, achievementId, awardedBy, reason, 
      tournamentId, metadata || {}
    ]);
    
    // Update latest achievement timestamp in customer_profiles
    await pool.query(
      `UPDATE customer_profiles 
       SET latest_achievement_at = NOW()
       WHERE user_id = $1`,
      [userId]
    );
    
    // Check and update rarest achievement
    await this.updateRarestAchievement(userId);
    
    return result.rows[0];
  }

  // Revoke an achievement
  async revokeAchievement(userId: string, achievementId: string, tournamentId?: string): Promise<void> {
    const sql = `
      DELETE FROM user_achievements 
      WHERE user_id = $1 AND achievement_id = $2
      AND ($3::VARCHAR IS NULL OR tournament_id = $3)
    `;
    
    await pool.query(sql, [userId, achievementId, tournamentId]);
    
    // Update rarest achievement after deletion
    await this.updateRarestAchievement(userId);
  }

  // Update user's rarest achievement
  private async updateRarestAchievement(userId: string): Promise<void> {
    const sql = `
      UPDATE customer_profiles
      SET rarest_achievement = (
        SELECT ua.achievement_id
        FROM user_achievements ua
        JOIN achievements a ON a.id = ua.achievement_id
        WHERE ua.user_id = $1
        ORDER BY 
          CASE a.rarity 
            WHEN 'legendary' THEN 4
            WHEN 'epic' THEN 3
            WHEN 'rare' THEN 2
            WHEN 'common' THEN 1
          END DESC
        LIMIT 1
      )
      WHERE user_id = $1
    `;
    
    await pool.query(sql, [userId]);
  }

  // Get achievement statistics
  async getAchievementStats(): Promise<any> {
    const sql = `
      SELECT 
        COUNT(DISTINCT ua.user_id) as total_users_with_achievements,
        COUNT(*) as total_awards,
        a.name as most_awarded_achievement,
        a.icon as most_awarded_icon,
        COUNT(ua.id) as award_count
      FROM user_achievements ua
      JOIN achievements a ON a.id = ua.achievement_id
      GROUP BY a.id, a.name, a.icon
      ORDER BY award_count DESC
      LIMIT 1
    `;
    
    const recentAwardsSql = `
      SELECT 
        ua.awarded_at,
        u.name as user_name,
        a.name as achievement_name,
        a.icon as achievement_icon,
        a.rarity
      FROM user_achievements ua
      JOIN users u ON u.id = ua.user_id
      JOIN achievements a ON a.id = ua.achievement_id
      ORDER BY ua.awarded_at DESC
      LIMIT 10
    `;
    
    const [statsResult, recentResult] = await Promise.all([
      pool.query(sql),
      pool.query(recentAwardsSql)
    ]);
    
    return {
      stats: statsResult.rows[0],
      recentAwards: recentResult.rows
    };
  }

  // Bulk award achievements (for tournaments)
  async bulkAwardAchievements(awards: AwardAchievementParams[]): Promise<void> {
    for (const award of awards) {
      try {
        await this.awardAchievement(award);
      } catch (error) {
        logger.error(`Failed to award achievement to user ${award.userId}:`, error);
        // Continue with other awards even if one fails
      }
    }
  }

  // Check and award milestone achievements
  async checkMilestoneAchievements(userId: string): Promise<void> {
    const sql = `SELECT check_milestone_achievements($1)`;
    await pool.query(sql, [userId]);
  }

  // Get user's featured achievements
  async getFeaturedAchievements(userId: string): Promise<any[]> {
    const sql = `
      SELECT 
        a.id, a.code, a.name, a.icon, a.badge_url, a.rarity,
        ua.awarded_at, ua.tournament_id
      FROM user_achievements ua
      JOIN achievements a ON a.id = ua.achievement_id
      WHERE ua.user_id = $1 AND ua.is_featured = true
      ORDER BY ua.display_priority DESC
      LIMIT 3
    `;
    
    const result = await pool.query(sql, [userId]);
    return result.rows;
  }

  // Set featured achievements for a user
  async setFeaturedAchievements(userId: string, achievementIds: string[]): Promise<void> {
    // First, unfeatured all
    await pool.query(
      'UPDATE user_achievements SET is_featured = false WHERE user_id = $1',
      [userId]
    );
    
    // Then set featured for selected ones (max 3)
    const featuredIds = achievementIds.slice(0, 3);
    for (let i = 0; i < featuredIds.length; i++) {
      await pool.query(
        `UPDATE user_achievements 
         SET is_featured = true, display_priority = $3
         WHERE user_id = $1 AND achievement_id = $2`,
        [userId, featuredIds[i], 3 - i]
      );
    }
    
    // Update preferences
    await pool.query(
      `INSERT INTO achievement_preferences (user_id, featured_achievements)
       VALUES ($1, $2)
       ON CONFLICT (user_id) 
       DO UPDATE SET featured_achievements = $2, updated_at = NOW()`,
      [userId, featuredIds]
    );
  }

  // Get achievement leaderboard
  async getAchievementLeaderboard(limit: number = 10): Promise<any[]> {
    const sql = `
      SELECT 
        u.id as user_id,
        u.name as name,
        cp.achievement_count,
        cp.achievement_points,
        cp.rarest_achievement,
        ra.name as rarest_achievement_name,
        ra.icon as rarest_achievement_icon,
        ra.rarity as rarest_achievement_rarity
      FROM customer_profiles cp
      JOIN users u ON u.id = cp.user_id
      LEFT JOIN achievements ra ON ra.id = cp.rarest_achievement
      WHERE cp.achievement_count > 0
      ORDER BY 
        cp.achievement_points DESC,
        cp.achievement_count DESC
      LIMIT $1
    `;
    
    const result = await pool.query(sql, [limit]);
    return result.rows;
  }
}

export const achievementService = new AchievementService();