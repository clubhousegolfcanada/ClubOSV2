import { db } from '../utils/database';
import { clubCoinService } from '../services/clubCoinService';
import { logger } from '../utils/logger';

export async function processBookingRewards() {
  logger.info('Starting booking rewards processing job');
  
  try {
    // Find all pending rewards that are due
    const pendingRewards = await db.query(`
      SELECT br.*, u.name as user_name, u.email as user_email
      FROM booking_rewards br
      JOIN users u ON u.id = br.user_id
      WHERE br.status = 'pending' 
      AND br.reward_date <= NOW()
      ORDER BY br.reward_date ASC
      LIMIT 100
    `);
    
    logger.info(`Found ${pendingRewards.rows.length} pending rewards to process`);
    
    let successCount = 0;
    let failCount = 0;
    
    for (const reward of pendingRewards.rows) {
      try {
        // Award the coins
        await clubCoinService.credit({
          userId: reward.user_id,
          type: 'booking_reward' as any, // Type will be added to enum
          amount: reward.cc_awarded,
          description: `Booking reward - Thank you for playing at ${reward.location}!`,
          metadata: { 
            hubspot_deal_id: reward.hubspot_deal_id,
            booking_date: reward.booking_date,
            location: reward.location,
            box_number: reward.box_number
          }
        });
        
        // Mark as awarded
        await db.query(`
          UPDATE booking_rewards 
          SET status = 'awarded', 
              awarded_at = NOW(),
              updated_at = NOW()
          WHERE id = $1
        `, [reward.id]);
        
        logger.info(`✅ Awarded ${reward.cc_awarded} CC to ${reward.user_name} for booking on ${reward.booking_date}`);
        successCount++;
        
      } catch (error: any) {
        logger.error(`Failed to award booking reward ${reward.id}:`, error);
        
        // Mark as failed with error message
        await db.query(`
          UPDATE booking_rewards 
          SET status = 'failed',
              error_message = $2,
              updated_at = NOW()
          WHERE id = $1
        `, [reward.id, error.message]);
        
        failCount++;
      }
    }
    
    logger.info(`Booking rewards job completed: ${successCount} awarded, ${failCount} failed`);
    
  } catch (error) {
    logger.error('Booking rewards job failed:', error);
    throw error;
  }
}

// Schedule the job to run every hour
let jobInterval: NodeJS.Timeout | null = null;

export function startBookingRewardsJob() {
  // Run immediately on startup
  processBookingRewards();
  
  // Then run every hour
  jobInterval = setInterval(() => {
    processBookingRewards();
  }, 60 * 60 * 1000); // 1 hour
  
  logger.info('Booking rewards job scheduled to run hourly');
}

export function stopBookingRewardsJob() {
  if (jobInterval) {
    clearInterval(jobInterval);
    jobInterval = null;
  }
}