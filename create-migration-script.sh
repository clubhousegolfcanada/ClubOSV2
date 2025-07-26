#!/bin/bash
echo "🔄 Migrating JSON Data to PostgreSQL"
echo "===================================="

cd /Users/michaelbelairch1/Desktop/Clubhouse\ OS\ \(Root\)/CLUBOSV1/ClubOSV1-backend

# Create migration script
cat > src/scripts/migrateToPostgres.ts << 'EOF'
import { readJsonFile } from '../utils/fileUtils';
import { db, pool } from '../utils/database';
import { logger } from '../utils/logger';
import { User, Ticket, FeedbackEntry } from '../types';

async function migrateData() {
  try {
    // Initialize database
    await db.initialize();
    logger.info('Database connection established');
    
    // Migrate users
    logger.info('Migrating users...');
    const users = await readJsonFile<User[]>('users.json');
    let userCount = 0;
    
    for (const user of users) {
      try {
        // Check if user already exists
        const existing = await db.findUserByEmail(user.email);
        if (!existing) {
          await pool.query(
            `INSERT INTO "Users" (id, email, password, name, role, phone, created_at, updated_at) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             ON CONFLICT (email) DO NOTHING`,
            [
              user.id,
              user.email,
              user.password,
              user.name,
              user.role,
              user.phone,
              new Date(user.createdAt),
              new Date(user.updatedAt)
            ]
          );
          userCount++;
        }
      } catch (error) {
        logger.error(`Failed to migrate user ${user.email}:`, error);
      }
    }
    logger.info(`Migrated ${userCount} users`);
    
    // Migrate tickets
    logger.info('Migrating tickets...');
    const tickets = await readJsonFile<Ticket[]>('tickets.json');
    let ticketCount = 0;
    
    for (const ticket of tickets) {
      try {
        await pool.query(
          `INSERT INTO tickets (
            id, title, description, category, status, priority, location,
            created_by_id, created_by_name, created_by_email, created_by_phone,
            assigned_to_id, assigned_to_name, assigned_to_email,
            created_at, updated_at, resolved_at, metadata
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
          ON CONFLICT (id) DO NOTHING`,
          [
            ticket.id,
            ticket.title,
            ticket.description,
            ticket.category,
            ticket.status,
            ticket.priority,
            ticket.location,
            ticket.createdBy.id,
            ticket.createdBy.name,
            ticket.createdBy.email,
            ticket.createdBy.phone,
            ticket.assignedTo?.id,
            ticket.assignedTo?.name,
            ticket.assignedTo?.email,
            new Date(ticket.createdAt),
            new Date(ticket.updatedAt),
            ticket.resolvedAt ? new Date(ticket.resolvedAt) : null,
            JSON.stringify({})
          ]
        );
        ticketCount++;
      } catch (error) {
        logger.error(`Failed to migrate ticket ${ticket.id}:`, error);
      }
    }
    logger.info(`Migrated ${ticketCount} tickets`);
    
    // Migrate feedback
    logger.info('Migrating feedback...');
    const feedback = await readJsonFile<FeedbackEntry[]>('feedback.json');
    let feedbackCount = 0;
    
    for (const entry of feedback) {
      try {
        await pool.query(
          `INSERT INTO feedback (
            id, timestamp, user_id, user_email, request_description, 
            location, route, response, confidence, is_useful, 
            feedback_type, feedback_source, slack_thread_ts, 
            slack_user_name, slack_user_id, slack_channel, 
            original_request_id, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
          ON CONFLICT (id) DO NOTHING`,
          [
            entry.id,
            new Date(entry.timestamp),
            entry.userId,
            entry.userEmail,
            entry.requestDescription,
            entry.location,
            entry.route,
            entry.response,
            entry.confidence,
            entry.isUseful,
            entry.feedbackType,
            entry.feedbackSource,
            entry.slackThreadTs,
            entry.slackUserName,
            entry.slackUserId,
            entry.slackChannel,
            entry.originalRequestId,
            new Date(entry.createdAt)
          ]
        );
        feedbackCount++;
      } catch (error) {
        logger.error(`Failed to migrate feedback ${entry.id}:`, error);
      }
    }
    logger.info(`Migrated ${feedbackCount} feedback entries`);
    
    logger.info('Migration complete!');
    process.exit(0);
  } catch (error) {
    logger.error('Migration failed:', error);
    process.exit(1);
  }
}

// Run migration
migrateData();
EOF

echo "📝 Migration script created"
echo ""
echo "To migrate your existing JSON data to PostgreSQL:"
echo "1. cd ClubOSV1-backend"
echo "2. npx tsx src/scripts/migrateToPostgres.ts"
echo ""
echo "This will copy all users, tickets, and feedback to PostgreSQL"
