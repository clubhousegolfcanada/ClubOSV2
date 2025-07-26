import { promises as fs } from 'fs';
import { join } from 'path';
import { db } from '../src/utils/database';
import { logger } from '../src/utils/logger';
import dotenv from 'dotenv';

dotenv.config();

const DATA_DIR = join(process.cwd(), 'data');

async function fileExists(path: string): Promise<boolean> {
  try {
    await fs.access(path);
    return true;
  } catch {
    return false;
  }
}

async function migrateJsonToPostgres() {
  try {
    logger.info('Starting JSON to PostgreSQL migration...');
    
    // Initialize database
    await db.initialize();
    
    // Migrate users if JSON file exists
    const usersPath = join(DATA_DIR, 'users.json');
    if (await fileExists(usersPath)) {
      logger.info('Migrating users...');
      const usersData = JSON.parse(await fs.readFile(usersPath, 'utf-8'));
      let migratedUsers = 0;
      
      for (const user of usersData) {
        try {
          // Check if user already exists
          const existing = await db.findUserByEmail(user.email);
          if (!existing) {
            await db.createUser({
              email: user.email,
              password: user.password, // Already hashed
              name: user.name,
              role: user.role,
              phone: user.phone
            });
            migratedUsers++;
          }
        } catch (err) {
          logger.error(`Failed to migrate user ${user.email}:`, err);
        }
      }
      logger.info(`Migrated ${migratedUsers} users`);
    }
    
    // Migrate tickets if JSON file exists
    const ticketsPath = join(DATA_DIR, 'tickets.json');
    if (await fileExists(ticketsPath)) {
      logger.info('Migrating tickets...');
      const ticketsData = JSON.parse(await fs.readFile(ticketsPath, 'utf-8'));
      let migratedTickets = 0;
      
      for (const ticket of ticketsData) {
        try {
          await db.createTicket({
            title: ticket.title,
            description: ticket.description,
            category: ticket.category,
            status: ticket.status,
            priority: ticket.priority,
            location: ticket.location,
            created_by_id: ticket.createdBy.id,
            created_by_name: ticket.createdBy.name,
            created_by_email: ticket.createdBy.email,
            created_by_phone: ticket.createdBy.phone
          });
          migratedTickets++;
        } catch (err) {
          logger.error(`Failed to migrate ticket ${ticket.id}:`, err);
        }
      }
      logger.info(`Migrated ${migratedTickets} tickets`);
    }
    
    // Migrate bookings if JSON file exists
    const bookingsPath = join(DATA_DIR, 'bookings.json');
    if (await fileExists(bookingsPath)) {
      logger.info('Migrating bookings...');
      const bookingsData = JSON.parse(await fs.readFile(bookingsPath, 'utf-8'));
      let migratedBookings = 0;
      
      for (const booking of bookingsData) {
        try {
          await db.createBooking({
            user_id: booking.userId,
            simulator_id: booking.simulatorId,
            start_time: new Date(booking.startTime),
            duration: booking.duration,
            type: booking.type,
            recurring_days: booking.recurringDays,
            status: booking.status
          });
          migratedBookings++;
        } catch (err) {
          logger.error(`Failed to migrate booking ${booking.id}:`, err);
        }
      }
      logger.info(`Migrated ${migratedBookings} bookings`);
    }
    
    // Migrate feedback if JSON file exists
    const feedbackPath = join(DATA_DIR, 'feedback', 'not_useful.json');
    if (await fileExists(feedbackPath)) {
      logger.info('Migrating feedback...');
      const feedbackData = JSON.parse(await fs.readFile(feedbackPath, 'utf-8'));
      let migratedFeedback = 0;
      
      for (const entry of feedbackData) {
        try {
          await db.createFeedback({
            timestamp: new Date(entry.timestamp),
            user_id: entry.userId,
            user_email: entry.userEmail,
            request_description: entry.requestDescription,
            location: entry.location,
            route: entry.route,
            response: entry.response,
            confidence: entry.confidence,
            is_useful: entry.isUseful || false,
            feedback_type: entry.feedbackType,
            feedback_source: entry.feedbackSource || 'user'
          });
          migratedFeedback++;
        } catch (err) {
          logger.error(`Failed to migrate feedback entry:`, err);
        }
      }
      logger.info(`Migrated ${migratedFeedback} feedback entries`);
    }
    
    logger.info('✅ Migration completed successfully!');
    
    // Optionally backup old JSON files
    const backupDir = join(DATA_DIR, 'backup_' + new Date().toISOString().split('T')[0]);
    if (await fileExists(DATA_DIR)) {
      await fs.mkdir(backupDir, { recursive: true });
      logger.info(`Created backup directory: ${backupDir}`);
      logger.info('Old JSON files preserved in backup directory');
    }
    
  } catch (error) {
    logger.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration if called directly
if (require.main === module) {
  migrateJsonToPostgres().then(() => {
    process.exit(0);
  });
}

export { migrateJsonToPostgres };
