import { Router, Request, Response } from 'express';
import { db } from '../../utils/database';
import { logger } from '../../utils/logger';
import crypto from 'crypto';

const router = Router();

// Verify HubSpot webhook signature
function verifyHubSpotSignature(req: Request): boolean {
  const signature = req.headers['x-hubspot-signature'] as string;
  const secret = process.env.HUBSPOT_WEBHOOK_SECRET;
  
  if (!signature || !secret) {
    return false;
  }
  
  const hash = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(req.body))
    .digest('hex');
  
  return signature === hash;
}

// Main webhook handler
router.post('/booking-completed', async (req: Request, res: Response) => {
  try {
    // Verify webhook signature (optional but recommended)
    if (process.env.NODE_ENV === 'production' && !verifyHubSpotSignature(req)) {
      logger.warn('Invalid HubSpot webhook signature');
      return res.status(401).json({ error: 'Invalid signature' });
    }
    
    // HubSpot sends an array of events
    const events = Array.isArray(req.body) ? req.body : [req.body];
    
    for (const event of events) {
      await processBookingEvent(event);
    }
    
    res.status(200).json({ success: true });
  } catch (error) {
    logger.error('Webhook processing error:', error);
    // Return 200 to prevent HubSpot retries for processing errors
    res.status(200).json({ error: 'Processing failed' });
  }
});

async function processBookingEvent(event: any) {
  try {
    // Extract deal information
    const dealId = event.objectId || event.dealId;
    const properties = event.properties || {};
    
    // Check if this is a completed booking
    const dealStage = properties.dealstage || properties.hs_deal_stage;
    if (dealStage !== 'closedwon' && dealStage !== 'completed') {
      logger.info(`Skipping deal ${dealId} with stage: ${dealStage}`);
      return;
    }
    
    // Extract booking details
    const bookingDate = properties.booking_date || 
                       properties.closedate || 
                       properties.hs_closedate;
    const location = properties.location || 'Unknown';
    const boxNumber = properties.box_number || properties.bay_number || '';
    
    // Find associated contact
    const contactId = properties.associatedContactId || 
                     properties.contact_id ||
                     event.associatedContactIds?.[0];
    
    if (!contactId || !bookingDate) {
      logger.warn(`Missing required fields for deal ${dealId}`);
      return;
    }
    
    // Find user by HubSpot contact ID
    const userResult = await db.query(`
      SELECT user_id FROM customer_profiles 
      WHERE hubspot_contact_id = $1
      LIMIT 1
    `, [contactId]);
    
    if (userResult.rows.length === 0) {
      // Try to find by phone number if contact ID doesn't match
      const phone = properties.contact_phone || properties.phone;
      if (phone) {
        const phoneResult = await db.query(`
          SELECT cp.user_id 
          FROM customer_profiles cp
          JOIN users u ON u.id = cp.user_id
          WHERE u.phone = $1
          LIMIT 1
        `, [phone]);
        
        if (phoneResult.rows.length > 0) {
          userResult.rows = phoneResult.rows;
          // Update the HubSpot contact ID for future use
          await db.query(`
            UPDATE customer_profiles 
            SET hubspot_contact_id = $1 
            WHERE user_id = $2
          `, [contactId, phoneResult.rows[0].user_id]);
        } else {
          logger.warn(`No user found for HubSpot contact ${contactId}`);
          return;
        }
      } else {
        logger.warn(`No user found for HubSpot contact ${contactId}`);
        return;
      }
    }
    
    const userId = userResult.rows[0].user_id;
    
    // Calculate reward date (7 days after booking)
    const rewardDate = new Date(bookingDate);
    rewardDate.setDate(rewardDate.getDate() + 7);
    
    // Queue the reward
    await db.query(`
      INSERT INTO booking_rewards (
        user_id, 
        hubspot_deal_id, 
        booking_date, 
        reward_date,
        location,
        box_number,
        cc_awarded,
        status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
      ON CONFLICT (hubspot_deal_id) 
      DO UPDATE SET 
        booking_date = EXCLUDED.booking_date,
        reward_date = EXCLUDED.reward_date,
        location = EXCLUDED.location,
        box_number = EXCLUDED.box_number,
        updated_at = NOW()
      WHERE booking_rewards.status = 'pending'
    `, [userId, dealId, bookingDate, rewardDate, location, boxNumber, 25]);
    
    logger.info(`Queued booking reward for user ${userId}, deal ${dealId}, due ${rewardDate.toISOString()}`);
  } catch (error) {
    logger.error(`Error processing booking event:`, error);
    throw error;
  }
}

// Webhook for deal updates (cancellations)
router.post('/booking-updated', async (req: Request, res: Response) => {
  try {
    const events = Array.isArray(req.body) ? req.body : [req.body];
    
    for (const event of events) {
      const dealId = event.objectId;
      const properties = event.properties || {};
      const dealStage = properties.dealstage || properties.hs_deal_stage;
      
      // If deal is cancelled or lost
      if (dealStage === 'closedlost' || dealStage === 'cancelled') {
        // Cancel any pending rewards
        await db.query(`
          UPDATE booking_rewards 
          SET status = 'cancelled', 
              updated_at = NOW() 
          WHERE hubspot_deal_id = $1 
          AND status = 'pending'
        `, [dealId]);
        
        logger.info(`Cancelled pending reward for deal ${dealId}`);
      }
    }
    
    res.status(200).json({ success: true });
  } catch (error) {
    logger.error('Webhook update error:', error);
    res.status(200).json({ error: 'Processing failed' });
  }
});

export default router;