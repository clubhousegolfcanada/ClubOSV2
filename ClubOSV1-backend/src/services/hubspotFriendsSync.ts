import axios from 'axios';
import { logger } from '../utils/logger';
import { db } from '../utils/database';
import { v4 as uuidv4 } from 'uuid';

const HUBSPOT_API_KEY = process.env.HUBSPOT_API_KEY;
const HUBSPOT_API_URL = 'https://api.hubapi.com';

interface HubSpotContact {
  id?: string;
  properties: {
    email: string;
    firstname?: string;
    lastname?: string;
    phone?: string;
    clubos_user_id?: string;
    clubos_friend_count?: number;
    clubos_friend_ids?: string;
    clubcoin_balance?: number;
    clubcoin_lifetime_earned?: number;
    clubcoin_lifetime_wagered?: number;
    high_roller_tier?: 'none' | 'bronze' | 'silver' | 'gold' | 'platinum';
    preferred_location?: string;
    last_wager_date?: string;
    wager_win_rate?: number;
    total_wagers?: number;
    lifetime_value?: number;
  };
}

interface ClubCoinActivity {
  userId: string;
  balance: number;
  lifetimeEarned: number;
  lifetimeWagered: number;
  wagerWinRate: number;
  totalWagers: number;
  lastWagerDate?: Date;
  highRollerStatus: boolean;
}

export class HubSpotFriendsSync {
  private apiKey: string;
  private baseUrl: string;
  private syncInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.apiKey = HUBSPOT_API_KEY || '';
    this.baseUrl = HUBSPOT_API_URL;
    
    if (!this.apiKey) {
      logger.warn('HubSpot API key not configured - sync disabled');
    }
  }

  /**
   * Initialize sync service with periodic updates
   */
  public initialize(): void {
    if (!this.apiKey) return;

    // Initial sync
    this.syncAllUsers().catch(err => {
      logger.error('Initial HubSpot sync failed:', err);
    });

    // Set up periodic sync (every 30 minutes)
    this.syncInterval = setInterval(() => {
      this.syncAllUsers().catch(err => {
        logger.error('Periodic HubSpot sync failed:', err);
      });
    }, 30 * 60 * 1000);

    logger.info('HubSpot friends sync service initialized');
  }

  /**
   * Sync all customer users to HubSpot
   */
  private async syncAllUsers(): Promise<void> {
    try {
      const users = await db.query(
        `SELECT 
          u.id, u.email, u.name, u.phone,
          cp.home_location, cp.display_name,
          COUNT(DISTINCT f.id) as friend_count
        FROM users u
        LEFT JOIN customer_profiles cp ON cp.user_id = u.id
        LEFT JOIN friendships f ON 
          (f.user_id = u.id OR f.friend_id = u.id) 
          AND f.status = 'accepted'
        WHERE u.role = 'customer'
        GROUP BY u.id, u.email, u.name, u.phone, cp.home_location, cp.display_name`
      );

      for (const user of users.rows) {
        await this.syncUserToHubSpot(user);
      }

      logger.info(`Synced ${users.rows.length} users to HubSpot`);
    } catch (error) {
      logger.error('Error syncing users to HubSpot:', error);
    }
  }

  /**
   * Sync individual user to HubSpot
   */
  public async syncUserToHubSpot(userData: any): Promise<void> {
    if (!this.apiKey) return;

    try {
      // Get friend IDs
      const friendsResult = await db.query(
        `SELECT 
          CASE 
            WHEN user_id = $1 THEN friend_id 
            ELSE user_id 
          END as friend_id
        FROM friendships 
        WHERE (user_id = $1 OR friend_id = $1) 
          AND status = 'accepted'`,
        [userData.id]
      );

      const friendIds = friendsResult.rows.map(r => r.friend_id).join(',');

      // Get ClubCoin data (future implementation)
      const clubCoinData = await this.getClubCoinActivity(userData.id);

      // Parse name into first and last
      const nameParts = (userData.display_name || userData.name || '').split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';

      const contact: HubSpotContact = {
        properties: {
          email: userData.email,
          firstname: firstName,
          lastname: lastName,
          phone: userData.phone,
          clubos_user_id: userData.id,
          clubos_friend_count: userData.friend_count || 0,
          clubos_friend_ids: friendIds,
          clubcoin_balance: clubCoinData.balance,
          clubcoin_lifetime_earned: clubCoinData.lifetimeEarned,
          clubcoin_lifetime_wagered: clubCoinData.lifetimeWagered,
          high_roller_tier: clubCoinData.highRollerStatus ? 'gold' : 'none',
          preferred_location: userData.home_location,
          last_wager_date: clubCoinData.lastWagerDate?.toISOString(),
          wager_win_rate: clubCoinData.wagerWinRate,
          total_wagers: clubCoinData.totalWagers
        }
      };

      // Check if contact exists
      const existingContact = await this.findContactByEmail(userData.email);
      
      if (existingContact) {
        // Update existing contact
        await this.updateContact(existingContact.id, contact);
      } else {
        // Create new contact
        await this.createContact(contact);
      }

    } catch (error) {
      logger.error(`Error syncing user ${userData.id} to HubSpot:`, error);
    }
  }

  /**
   * Get ClubCoin activity for a user (placeholder for future implementation)
   */
  private async getClubCoinActivity(userId: string): Promise<ClubCoinActivity> {
    try {
      // Future: Query wallet and wager tables
      // For now, return mock data
      const result = await db.query(
        `SELECT 
          COUNT(DISTINCT f.id) as total_wagers,
          SUM(f.clubcoin_wagers_total) as lifetime_wagered,
          MAX(f.last_wager_date) as last_wager_date
        FROM friendships f
        WHERE (f.user_id = $1 OR f.friend_id = $1)`,
        [userId]
      );

      const data = result.rows[0];

      return {
        userId,
        balance: 0, // Will come from wallet table
        lifetimeEarned: 0, // Will come from wallet_ledger
        lifetimeWagered: parseFloat(data.lifetime_wagered) || 0,
        wagerWinRate: 0, // Will be calculated from wager results
        totalWagers: parseInt(data.total_wagers) || 0,
        lastWagerDate: data.last_wager_date,
        highRollerStatus: false // Will be determined by criteria
      };
    } catch (error) {
      logger.error('Error getting ClubCoin activity:', error);
      return {
        userId,
        balance: 0,
        lifetimeEarned: 0,
        lifetimeWagered: 0,
        wagerWinRate: 0,
        totalWagers: 0,
        highRollerStatus: false
      };
    }
  }

  /**
   * Find HubSpot contact by email
   */
  private async findContactByEmail(email: string): Promise<any> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/crm/v3/objects/contacts`,
        {
          params: {
            filterGroups: JSON.stringify([{
              filters: [{
                propertyName: 'email',
                operator: 'EQ',
                value: email
              }]
            }])
          },
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data.results[0] || null;
    } catch (error) {
      logger.error('Error finding HubSpot contact:', error);
      return null;
    }
  }

  /**
   * Create new HubSpot contact
   */
  private async createContact(contact: HubSpotContact): Promise<void> {
    try {
      await axios.post(
        `${this.baseUrl}/crm/v3/objects/contacts`,
        contact,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      logger.info(`Created HubSpot contact for ${contact.properties.email}`);
    } catch (error: any) {
      if (error.response?.status === 409) {
        // Contact already exists, try to update
        const existing = await this.findContactByEmail(contact.properties.email);
        if (existing) {
          await this.updateContact(existing.id, contact);
        }
      } else {
        logger.error('Error creating HubSpot contact:', error.response?.data || error);
      }
    }
  }

  /**
   * Update existing HubSpot contact
   */
  private async updateContact(contactId: string, contact: HubSpotContact): Promise<void> {
    try {
      await axios.patch(
        `${this.baseUrl}/crm/v3/objects/contacts/${contactId}`,
        contact,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      logger.debug(`Updated HubSpot contact ${contactId}`);
    } catch (error) {
      logger.error(`Error updating HubSpot contact ${contactId}:`, error);
    }
  }

  /**
   * Handle friend connection event
   */
  public async handleFriendConnection(userId1: string, userId2: string): Promise<void> {
    if (!this.apiKey) return;

    try {
      // Sync both users
      const users = await db.query(
        `SELECT 
          u.id, u.email, u.name, u.phone,
          cp.home_location, cp.display_name,
          COUNT(DISTINCT f.id) as friend_count
        FROM users u
        LEFT JOIN customer_profiles cp ON cp.user_id = u.id
        LEFT JOIN friendships f ON 
          (f.user_id = u.id OR f.friend_id = u.id) 
          AND f.status = 'accepted'
        WHERE u.id IN ($1, $2)
        GROUP BY u.id, u.email, u.name, u.phone, cp.home_location, cp.display_name`,
        [userId1, userId2]
      );

      for (const user of users.rows) {
        await this.syncUserToHubSpot(user);
      }
    } catch (error) {
      logger.error('Error handling friend connection:', error);
    }
  }

  /**
   * Handle ClubCoin activity update
   */
  public async handleClubCoinActivity(userId: string, activity: Partial<ClubCoinActivity>): Promise<void> {
    if (!this.apiKey) return;

    try {
      const user = await db.query(
        `SELECT email FROM users WHERE id = $1`,
        [userId]
      );

      if (user.rows.length === 0) return;

      const contact = await this.findContactByEmail(user.rows[0].email);
      if (!contact) return;

      const updateData: any = {
        properties: {}
      };

      if (activity.balance !== undefined) {
        updateData.properties.clubcoin_balance = activity.balance;
      }
      if (activity.lifetimeWagered !== undefined) {
        updateData.properties.clubcoin_lifetime_wagered = activity.lifetimeWagered;
      }
      if (activity.lastWagerDate) {
        updateData.properties.last_wager_date = activity.lastWagerDate.toISOString();
      }
      if (activity.highRollerStatus !== undefined) {
        updateData.properties.high_roller_tier = activity.highRollerStatus ? 'gold' : 'none';
      }

      await this.updateContact(contact.id, updateData);
    } catch (error) {
      logger.error('Error handling ClubCoin activity:', error);
    }
  }

  /**
   * Create HubSpot webhook subscription
   */
  public async setupWebhook(webhookUrl: string): Promise<void> {
    if (!this.apiKey) return;

    try {
      // Subscribe to contact property changes
      await axios.post(
        `${this.baseUrl}/webhooks/v3/subscriptions`,
        {
          eventType: 'contact.propertyChange',
          propertyName: 'email',
          active: true,
          url: webhookUrl
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      logger.info('HubSpot webhook subscription created');
    } catch (error) {
      logger.error('Error setting up HubSpot webhook:', error);
    }
  }

  /**
   * Handle incoming HubSpot webhook
   */
  public async handleWebhook(data: any): Promise<void> {
    try {
      // Process webhook data
      if (data.eventType === 'contact.propertyChange') {
        // Handle property changes if needed
        logger.debug('HubSpot contact property changed:', data);
      }
    } catch (error) {
      logger.error('Error handling HubSpot webhook:', error);
    }
  }

  /**
   * Cleanup and stop sync service
   */
  public stop(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    logger.info('HubSpot friends sync service stopped');
  }
}

// Export singleton instance
export const hubspotFriendsSync = new HubSpotFriendsSync();