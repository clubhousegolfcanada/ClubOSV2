import { pool } from '../utils/database';
import { logger } from '../utils/logger';
import { challengeService } from '../services/challengeService';

/**
 * Process challenges where both players have agreed on the winner
 */
export async function processChallengeAgreements() {
  const client = await pool.connect();
  
  try {
    // Find challenges marked as ready_resolve from player agreement
    const query = `
      SELECT DISTINCT
        c.id as challenge_id,
        ws.selected_winner_id as agreed_winner_id
      FROM challenges c
      INNER JOIN (
        SELECT 
          challenge_id,
          selected_winner_id,
          COUNT(DISTINCT user_id) as selection_count,
          COUNT(DISTINCT selected_winner_id) as unique_selections
        FROM challenge_winner_selections
        GROUP BY challenge_id, selected_winner_id
        HAVING COUNT(DISTINCT user_id) = 2 
        AND COUNT(DISTINCT selected_winner_id) = 1
      ) ws ON ws.challenge_id = c.id
      WHERE c.status = 'ready_resolve'
      AND NOT EXISTS (
        SELECT 1 FROM challenge_results cr 
        WHERE cr.challenge_id = c.id
      )
      LIMIT 10
    `;
    
    const result = await client.query(query);
    
    for (const row of result.rows) {
      try {
        logger.info(`Processing agreed challenge resolution: ${row.challenge_id}`);
        
        // Resolve the challenge with the agreed winner
        await challengeService.resolveChallengeByAgreement(
          row.challenge_id,
          row.agreed_winner_id
        );
        
        logger.info(`Successfully resolved challenge ${row.challenge_id} by player agreement`);
      } catch (error) {
        logger.error(`Failed to resolve challenge ${row.challenge_id}:`, error);
        
        // Mark challenge as needing manual review
        await client.query(
          `UPDATE challenges 
           SET status = 'dispute_pending', 
               updated_at = CURRENT_TIMESTAMP 
           WHERE id = $1`,
          [row.challenge_id]
        );
      }
    }
    
    return result.rows.length;
  } catch (error) {
    logger.error('Error processing challenge agreements:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Run every minute
export function startChallengeAgreementProcessor() {
  setInterval(async () => {
    try {
      const processed = await processChallengeAgreements();
      if (processed > 0) {
        logger.info(`Processed ${processed} agreed challenges`);
      }
    } catch (error) {
      logger.error('Challenge agreement processor error:', error);
    }
  }, 60000); // Run every minute
  
  // Run once on startup
  processChallengeAgreements().catch(error => {
    logger.error('Initial challenge agreement processing failed:', error);
  });
}