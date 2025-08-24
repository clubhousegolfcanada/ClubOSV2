import { Router } from 'express';
import { achievementService } from '../services/achievementService';
import { authenticate } from '../middleware/auth';
import { checkOperatorRole } from '../middleware/checkOperatorRole';

const router = Router();

// Get all available achievements
router.get('/', authenticate, async (req, res) => {
  try {
    const { category } = req.query;
    const achievements = await achievementService.getAllAchievements(category as string);
    res.json(achievements);
  } catch (error) {
    console.error('Error fetching achievements:', error);
    res.status(500).json({ error: 'Failed to fetch achievements' });
  }
});

// Get achievements for a specific user
router.get('/user/:userId', authenticate, async (req, res) => {
  try {
    const { userId } = req.params;
    const achievements = await achievementService.getUserAchievements(userId);
    res.json(achievements);
  } catch (error) {
    console.error('Error fetching user achievements:', error);
    res.status(500).json({ error: 'Failed to fetch user achievements' });
  }
});

// Get featured achievements for a user
router.get('/user/:userId/featured', authenticate, async (req, res) => {
  try {
    const { userId } = req.params;
    const achievements = await achievementService.getFeaturedAchievements(userId);
    res.json(achievements);
  } catch (error) {
    console.error('Error fetching featured achievements:', error);
    res.status(500).json({ error: 'Failed to fetch featured achievements' });
  }
});

// Award achievement to a user (operator only)
router.post('/award', authenticate, checkOperatorRole, async (req, res) => {
  try {
    const { userId, achievementId, reason, tournamentId, metadata } = req.body;
    const awardedBy = req.user?.id;

    if (!userId || !achievementId) {
      return res.status(400).json({ error: 'userId and achievementId are required' });
    }

    const achievement = await achievementService.awardAchievement({
      userId,
      achievementId,
      awardedBy,
      reason,
      tournamentId,
      metadata
    });

    res.json({ 
      success: true, 
      message: 'Achievement awarded successfully',
      achievement 
    });
  } catch (error: any) {
    console.error('Error awarding achievement:', error);
    if (error.message === 'Achievement already awarded to this user') {
      return res.status(409).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to award achievement' });
  }
});

// Bulk award achievements (operator only)
router.post('/bulk-award', authenticate, checkOperatorRole, async (req, res) => {
  try {
    const { awards } = req.body;
    const awardedBy = req.user?.id;

    if (!Array.isArray(awards)) {
      return res.status(400).json({ error: 'awards must be an array' });
    }

    // Add awardedBy to each award
    const awardsWithOperator = awards.map(award => ({
      ...award,
      awardedBy
    }));

    await achievementService.bulkAwardAchievements(awardsWithOperator);

    res.json({ 
      success: true, 
      message: `Successfully processed ${awards.length} achievement awards`
    });
  } catch (error) {
    console.error('Error bulk awarding achievements:', error);
    res.status(500).json({ error: 'Failed to bulk award achievements' });
  }
});

// Revoke achievement from a user (operator only)
router.delete('/revoke', authenticate, checkOperatorRole, async (req, res) => {
  try {
    const { userId, achievementId, tournamentId } = req.body;

    if (!userId || !achievementId) {
      return res.status(400).json({ error: 'userId and achievementId are required' });
    }

    await achievementService.revokeAchievement(userId, achievementId, tournamentId);

    res.json({ 
      success: true, 
      message: 'Achievement revoked successfully' 
    });
  } catch (error) {
    console.error('Error revoking achievement:', error);
    res.status(500).json({ error: 'Failed to revoke achievement' });
  }
});

// Set featured achievements for current user
router.post('/featured', authenticate, async (req, res) => {
  try {
    const userId = req.user?.id;
    const { achievementIds } = req.body;

    if (!Array.isArray(achievementIds)) {
      return res.status(400).json({ error: 'achievementIds must be an array' });
    }

    await achievementService.setFeaturedAchievements(userId, achievementIds);

    res.json({ 
      success: true, 
      message: 'Featured achievements updated successfully' 
    });
  } catch (error) {
    console.error('Error setting featured achievements:', error);
    res.status(500).json({ error: 'Failed to set featured achievements' });
  }
});

// Get achievement statistics (operator only)
router.get('/stats', authenticate, checkOperatorRole, async (req, res) => {
  try {
    const stats = await achievementService.getAchievementStats();
    res.json(stats);
  } catch (error) {
    console.error('Error fetching achievement stats:', error);
    res.status(500).json({ error: 'Failed to fetch achievement statistics' });
  }
});

// Get achievement leaderboard
router.get('/leaderboard', authenticate, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const leaderboard = await achievementService.getAchievementLeaderboard(limit);
    res.json(leaderboard);
  } catch (error) {
    console.error('Error fetching achievement leaderboard:', error);
    res.status(500).json({ error: 'Failed to fetch achievement leaderboard' });
  }
});

// Check and award milestone achievements for current user
router.post('/check-milestones', authenticate, async (req, res) => {
  try {
    const userId = req.user?.id;
    await achievementService.checkMilestoneAchievements(userId);
    res.json({ 
      success: true, 
      message: 'Milestone achievements checked' 
    });
  } catch (error) {
    console.error('Error checking milestone achievements:', error);
    res.status(500).json({ error: 'Failed to check milestone achievements' });
  }
});

export default router;