import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import { join } from 'path';

// Load environment variables FIRST
dotenv.config();

import { initSentry, sentryRequestHandler, sentryTracingHandler, sentryErrorHandler, setupSentryErrorHandler } from './utils/sentry';
import { logger } from './utils/logger';
import { db } from './utils/database';
import { validateEnvironmentSecurity } from './utils/env-security';

// Initialize Sentry before anything else
initSentry();

// Validate environment security on startup (skip in test environment)
if (process.env.NODE_ENV !== 'test') {
  try {
    validateEnvironmentSecurity();
  } catch (error) {
    logger.error('Environment security validation failed', error);
    if (process.env.NODE_ENV === 'production') {
      process.exit(1); // Exit in production if security checks fail
    }
  }
}
import authRoutes from './routes/auth';
import authGoogleRoutes from './routes/auth-google';
import bookingsRoutes from './routes/bookings';
import ticketsRoutes from './routes/tickets';
import tasksRoutes from './routes/tasks';
import feedbackRoutes from './routes/feedback';
import llmRoutes from './routes/llm';
import slackRoutes from './routes/slack';
import customerRoutes from './routes/customer';
import customerProfileRoutes from './routes/customerProfile';
import customerBookingsRoutes from './routes/customerBookings';
import userSettingsRoutes from './routes/userSettings';
import backupRoutes from './routes/backup';
import accessRoutes from './routes/access';
import historyRoutes from './routes/history';
// import testCorsRoutes from './routes/test-cors'; // Removed during cleanup
import systemConfigRoutes from './routes/system-config';
import analyticsRoutes from './routes/analytics';
// import checklistsRoutes from './routes/checklists'; // Old hardcoded version
// import checklistsRoutes from './routes/checklists-v2'; // Basic database version
import checklistsRoutes from './routes/checklists-v2-enhanced'; // Enhanced version with supplies & photos
import remoteActionsRoutes from './routes/remoteActions';
import ninjaoneSyncRoutes from './routes/ninjaone-sync';
import doorAccessRoutes from './routes/doorAccess';
// import debugRoutes from './routes/debug'; // File doesn't exist
import openphoneRoutes from './routes/openphone';
import openphoneV3Routes from './routes/openphone-v3';
import messagesRoutes from './routes/messages';
import notificationsRoutes from './routes/notifications';
import knowledgeRoutes from './routes/knowledge';
// import sopMonitoringRoutes from './routes/sop-monitoring'; // SOP disabled
// import adminKnowledgeRoutes from './routes/admin-knowledge'; // Disabled - not used
// import knowledgeDebugRoutes from './routes/knowledge-debug'; // Disabled - not used
import systemCheckRoutes from './routes/system-check';
import assistantRoutes from './routes/assistant';
import knowledgeStoreRoutes from './routes/knowledge-store'; // Used internally by knowledgeSearchService
// SOP routes disabled - using OpenAI Assistants directly
// import sopCheckRoutes from './routes/sop-check';
// import sopDebugRoutes from './routes/sop-debug';
// import sopDataCheckRoutes from './routes/sop-data-check';
// import intelligentSearchRoutes from './routes/intelligent-search';
// import knowledgeEnhanceRoutes from './routes/knowledge-enhance'; // Disabled - not used
import knowledgeRouterRoutes from './routes/knowledge-router'; // Used by KnowledgeRouterPanel
import adminRoutes from './routes/admin';
import publicRoutes from './routes/public';
import callTranscriptRoutes from './routes/call-transcripts';
import privacyRoutes from './routes/privacy';
import customerInteractionsRoutes from './routes/customer-interactions';
import promptTemplatesRoutes from './routes/promptTemplates';
import promptsRoutes from './routes/prompts';
import csrfRoutes from './routes/csrf';
import aiAutomationsRoutes from './routes/ai-automations';
import openphoneProcessingRoutes from './routes/openphone-processing';
import integrationsRoutes from './routes/integrations';
// Using consolidated enhanced patterns route only
import enhancedPatternsRouter from './routes/enhanced-patterns';
import unifiDoorsRoutes from './routes/unifi-doors';
import whiteLabelPlannerRoutes from './routes/white-label-planner';
import whiteLabelScannerRoutes from './routes/white-label-scanner';
import boxesRoutes from './routes/boxes';
import boxManagementRoutes from './routes/boxManagement';
import processKnowledgeRoutes from './routes/process-knowledge';
import friendsRoutes from './routes/friends';
import logsRoutes from './routes/logs';
// V2 architecture routes removed - no longer needed

import { requestLogger } from './middleware/requestLogger';
import { errorHandler } from './middleware/errorHandler';
import { rateLimiter, llmRateLimiter } from './middleware/rateLimiter';
import { trackUsage } from './middleware/usageTracking';
import { authLimiter } from './middleware/authLimiter';
import { sanitizeMiddleware } from './middleware/requestValidation';
import { performanceLogger, getPerformanceStats } from './middleware/performance';
import { authenticate } from './middleware/auth';
import { roleGuard } from './middleware/roleGuard';

export const app = express();
const PORT = process.env.PORT || 3001;

// CRITICAL: Health check must be the VERY FIRST route for Railway deployment
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    version: process.env.npm_package_version || '1.0.0',
    database: db.initialized ? 'connected' : 'initializing'
  });
});

// Trust proxy - required for proper IP detection on Railway
app.set('trust proxy', true);

// Sentry request handler must be first middleware after health check
app.use(sentryRequestHandler);
app.use(sentryTracingHandler);

// Middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// Configure CORS with explicit options
const corsOptions = {
  origin: function (origin: string | undefined, callback: any) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // List of allowed origins
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3001',
      'https://club-osv-2-owqx-2norv2e7j-clubosv2s-projects.vercel.app',
      'https://club-osv-2-owqx-5pi1k3899-clubosv2s-projects.vercel.app',
      'https://club-osv-2-owqx.vercel.app',
      'https://clubosv2.vercel.app',
      'https://clubos.vercel.app',
      'https://clubos-frontend.vercel.app',
      /\.vercel\.app$/,  // Allow any Vercel preview deployments
      /\.railway\.app$/  // Allow Railway deployments
    ];
    
    // Check if origin is allowed
    const isAllowed = allowedOrigins.some(allowed => {
      if (allowed instanceof RegExp) {
        return allowed.test(origin);
      }
      return allowed === origin;
    });
    
    if (isAllowed) {
      callback(null, true);
    } else {
      // In production, you might want to restrict this
      // For now, allow all origins but log them
      logger.warn('CORS request from unknown origin:', origin);
      callback(null, true);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'x-csrf-token'],
  exposedHeaders: ['Content-Disposition', 'X-New-Token'],
  maxAge: 86400 // Cache preflight for 24 hours
};

app.use(cors(corsOptions));

// Custom middleware to capture raw body for Slack signature verification
app.use('/api/slack/events', express.raw({ type: 'application/json' }), (req, res, next) => {
  req.rawBody = req.body;
  req.body = JSON.parse(req.body.toString());
  next();
});

// Custom middleware to capture raw body for OpenPhone signature verification
app.use('/api/openphone/webhook', express.raw({ type: 'application/json' }), (req, res, next) => {
  // Skip raw body processing for GET requests
  if (req.method === 'GET') {
    return next();
  }

  // For POST requests, capture raw body
  if (req.body && Buffer.isBuffer(req.body)) {
    req.rawBody = req.body;
    req.body = JSON.parse(req.body.toString());
  }
  next();
});

// Also handle OpenPhone v3 webhook
app.use('/api/openphone-v3/webhook-v3', express.raw({ type: 'application/json' }), (req, res, next) => {
  req.rawBody = req.body;
  req.body = JSON.parse(req.body.toString());
  next();
});

app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());
app.use(sanitizeMiddleware);
app.use(requestLogger);
app.use(performanceLogger);

// Handle preflight requests explicitly
app.options('*', cors(corsOptions));

// Ensure CORS headers are added even on errors
app.use((req: any, res: any, next: any) => {
  // Set CORS headers on all responses
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, x-csrf-token');
  }
  
  // Intercept response to ensure headers are always set
  const oldSend = res.send;
  res.send = function(data: any) {
    // Ensure CORS headers are set even if response was already started
    if (origin && !res.headersSent) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }
    return oldSend.apply(res, arguments);
  };
  
  next();
});

// Rate limiting
app.use('/api/', rateLimiter);
app.use('/api/auth', authLimiter);

// Public routes (no auth required)
app.use('/api/public', publicRoutes);

// API Routes - V1 (existing routes remain active)
app.use('/api/auth', authRoutes);
app.use('/api/auth', authGoogleRoutes); // Google OAuth routes

// V2 Routes - Parallel deployment for gradual migration
// TODO: Uncomment when refactored routes are ready
// if (ROUTE_CONFIG.parallelMode) {
//   app.use('/api/v2/auth', authRefactoredRoutes);
//   app.use('/api/v2/health', healthRefactoredRoutes);
//   app.use('/api/v2/users', authenticate, usersRefactoredRoutes);
  
//   logger.info('🚀 Refactored routes mounted on /api/v2/* in parallel mode');
//   logger.info(`Migration config:`, {
//     parallelMode: ROUTE_CONFIG.parallelMode,
//     useRefactoredAuth: ROUTE_CONFIG.useRefactoredAuth,
//     useRefactoredHealth: ROUTE_CONFIG.useRefactoredHealth,
//     useRefactoredUsers: ROUTE_CONFIG.useRefactoredUsers
//   });
// }

// Version discovery endpoint
app.get('/api/version', (req, res) => {
  res.json({
    current: 'v1',
    available: ['v1'],
    message: 'V2 routes preparation in progress'
  });
});

app.use('/api', csrfRoutes);
app.use('/api/bookings', bookingsRoutes);
app.use('/api/tickets', ticketsRoutes);
app.use('/api/tasks', tasksRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/llm', llmRateLimiter, trackUsage, llmRoutes);
app.use('/api/slack', slackRoutes);
// Legacy customer routes (if any)
// app.use('/api/customer', customerRoutes);

// New Clubhouse customer app API v2
app.use('/api/v2/customer', customerRoutes);
app.use('/api/customer-profile', customerProfileRoutes);
app.use('/api/profile', require('./routes/profileStats').default);
app.use('/api/customer-bookings', customerBookingsRoutes);
app.use('/api/friends', friendsRoutes);
app.use('/api/challenges', require('./routes/challenges').default);
app.use('/api/boxes', boxesRoutes);
app.use('/api/boxes', boxManagementRoutes); // Management endpoints
app.use('/api/leaderboard', require('./routes/leaderboard').default);
app.use('/api/seasons', require('./routes/seasons').default);
app.use('/api/badges', require('./routes/badges').default);
app.use('/api/achievements', require('./routes/achievements').default);
app.use('/api/trackman', require('./routes/trackman').default);
app.use('/api/admin/cc-adjustments', require('./routes/admin/ccAdjustments').default);
app.use('/api/admin/contractors', require('./routes/admin/contractors').default);
app.use('/api/admin/performance', require('./routes/performance-monitor').default);
app.use('/api/user-settings', userSettingsRoutes);
app.use('/api/backup', backupRoutes);
app.use('/api/access', accessRoutes);
app.use('/api/history', historyRoutes);
// app.use('/api/test-cors', testCorsRoutes); // Removed during cleanup
app.use('/api/system-config', systemConfigRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/checklists', checklistsRoutes); // Keep old path for backward compatibility
app.use('/api/checklists-v2', checklistsRoutes); // New path for v2 frontend
app.use('/api/remote-actions', remoteActionsRoutes);
app.use('/api/door-access', doorAccessRoutes);
app.use('/api/ninjaone-remote', require('./routes/ninjaone-remote').default);
app.use('/api/ninjaone', ninjaoneSyncRoutes);
// app.use('/api/debug', debugRoutes); // File doesn't exist
app.use('/api/openphone', openphoneRoutes);
app.use('/api/openphone-v3', openphoneV3Routes);
app.use('/api/openphone-processing', openphoneProcessingRoutes);
app.use('/api/contacts', require('./routes/contacts').default);
app.use('/api/messages', messagesRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/knowledge', knowledgeRoutes);
// app.use('/api/sop-monitoring', sopMonitoringRoutes); // SOP disabled

// Knowledge routes - only knowledge-router and knowledge-store are actively used
app.use('/api/knowledge-router', knowledgeRouterRoutes); // Used by KnowledgeRouterPanel in Operations
app.use('/api/knowledge-store', knowledgeStoreRoutes); // Used internally by knowledgeSearchService

// Disabled knowledge routes - not actively used in frontend
// app.use('/api/admin-knowledge', adminKnowledgeRoutes);
// app.use('/api/knowledge-debug', knowledgeDebugRoutes);
// app.use('/api/knowledge-enhance', knowledgeEnhanceRoutes);

app.use('/api/system', systemCheckRoutes);
app.use('/api/assistant', assistantRoutes);

// SOP routes disabled - using OpenAI Assistants directly
// app.use('/api/sop-check', sopCheckRoutes);
// app.use('/api/sop-debug', sopDebugRoutes);
// app.use('/api/sop-data-check', sopDataCheckRoutes);
// app.use('/api/intelligent-search', intelligentSearchRoutes);
app.use('/api/admin', adminRoutes);

// Performance monitoring endpoint (admin only)
app.get('/api/admin/performance', authenticate, roleGuard(['admin']), getPerformanceStats);
app.use('/api/call-transcripts', callTranscriptRoutes);
app.use('/api/privacy', privacyRoutes);
app.use('/api/customer-interactions', customerInteractionsRoutes);
app.use('/api/prompt-templates', promptTemplatesRoutes);
app.use('/api/prompts', promptsRoutes);
app.use('/api/ai-automations', aiAutomationsRoutes);
app.use('/api/integrations', integrationsRoutes);
// Use consolidated enhanced patterns route for all pattern endpoints
app.use('/api/patterns', enhancedPatternsRouter);
app.use('/api/unifi-doors', unifiDoorsRoutes);
app.use('/api/white-label-planner', whiteLabelPlannerRoutes);
app.use('/api/white-label-scanner', whiteLabelScannerRoutes);
app.use('/api/system-status', require('./routes/system-status').default);
app.use('/api/system-settings', require('./routes/systemSettings').default);
app.use('/api/logs', logsRoutes);
app.use('/api/process-knowledge', processKnowledgeRoutes);

// Architecture v2 routes (testing)
// TODO: Move these imports to top of file
// import authRefactoredRoutes from './routes/auth-refactored';
// import usersRefactoredRoutes from './routes/users-refactored';
// app.use('/api/v2/auth', authRefactoredRoutes);
// app.use('/api/v2/users', usersRefactoredRoutes);

// HubSpot webhook routes
// TODO: Move this import to top of file
// import hubspotBookingWebhook from './routes/webhooks/hubspotBookings';
// app.use('/api/webhooks/hubspot', hubspotBookingWebhook);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'ClubOS API',
    version: process.env.npm_package_version || '1.0.0',
    status: 'running',
    database: 'postgresql'
  });
});

// Setup Sentry error handler for Express
setupSentryErrorHandler(app);

// Error handling middleware (must be last)
app.use(errorHandler);

// Initialize database and start server
async function startServer() {
  try {
    logger.info('🚀 Starting ClubOS Backend...');
    logger.info(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
    logger.info(`📍 Port: ${PORT}`);
    
    // Start server immediately to respond to health checks
    const server = app.listen(PORT, () => {
      logger.info(`🚀 Server running on port ${PORT} (health check available)`);
    });
    
    // Enable keep-alive with a longer timeout
    server.keepAliveTimeout = 65000; // 65 seconds
    server.headersTimeout = 66000; // 66 seconds
    
    // Store server instance for graceful shutdown
    app.set('server', server);
    
    // Perform startup checks
    const { performStartupChecks } = await import('./utils/startup-check');
    await performStartupChecks();
    
    // Run critical migrations
    try {
      // Fix missing rank_tier column
      const { runRankTierMigration } = await import('./scripts/run-rank-tier-migration');
      await runRankTierMigration();
      
      // Fix contractor role constraint
      try {
        logger.info('Checking contractor role constraint...');
        await db.query(`ALTER TABLE users DROP CONSTRAINT IF EXISTS valid_role`);
        await db.query(`ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check`);
        await db.query(`
          ALTER TABLE users ADD CONSTRAINT valid_role 
          CHECK (role IN ('admin', 'operator', 'support', 'kiosk', 'customer', 'contractor'))
        `);
        
        // Create contractor tables
        await db.query(`
          CREATE TABLE IF NOT EXISTS contractor_permissions (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            location VARCHAR(100) NOT NULL,
            can_unlock_doors BOOLEAN DEFAULT true,
            can_submit_checklists BOOLEAN DEFAULT true,
            can_view_history BOOLEAN DEFAULT false,
            active_from TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            active_until TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            created_by UUID REFERENCES users(id),
            UNIQUE(user_id, location)
          )
        `);
        
        await db.query(`
          CREATE TABLE IF NOT EXISTS contractor_checklist_submissions (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            contractor_id UUID NOT NULL REFERENCES users(id),
            checklist_submission_id UUID REFERENCES checklist_submissions(id),
            location VARCHAR(100) NOT NULL,
            door_unlocks JSONB DEFAULT '[]',
            start_time TIMESTAMP NOT NULL,
            end_time TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `);
        
        logger.info('✅ Contractor role constraint and tables updated');
      } catch (contractorError) {
        logger.debug('Contractor role migration:', contractorError);
      }
      
      // Run white label migration and populate data
      const { runMigration } = await import('./scripts/run-white-label-migration');
      await runMigration();
      logger.info('✅ White label tables initialized');
      
      // Populate with initial data if empty
      const { initializeWhiteLabelData } = await import('./scripts/initialize-white-label-data');
      await initializeWhiteLabelData();
      
      // DISABLED: Pattern cleanup was too aggressive, deleting active patterns
      // To re-enable: Set CLEANUP_PATTERNS_ON_STARTUP=true in environment
      if (process.env.CLEANUP_PATTERNS_ON_STARTUP === 'true') {
        logger.info('🧹 Running pattern cleanup...');
        const { cleanupPatterns } = await import('./scripts/cleanup-patterns');
        await cleanupPatterns();
        logger.info('✅ Pattern cleanup completed');
      } else {
        logger.info('⏸️ Pattern cleanup DISABLED to preserve active patterns');
      }
    } catch (error) {
      logger.error('Failed to run startup migrations:', error);
      // Don't fail startup, just log the error
    }
    
    // Initialize database
    logger.info('🔄 Initializing database connection...');
    await db.initialize();
    logger.info('✅ Database initialized successfully');

    // Run ticket photo migration - critical for ticket creation
    try {
      logger.info('🔄 Running ticket photo migration...');
      await db.query(`
        ALTER TABLE tickets
        ADD COLUMN IF NOT EXISTS photo_urls TEXT[] DEFAULT '{}'
      `);

      await db.query(`
        CREATE INDEX IF NOT EXISTS idx_tickets_has_photos
        ON tickets ((array_length(photo_urls, 1) > 0))
      `);

      logger.info('✅ Ticket photo migration completed');
    } catch (error) {
      logger.error('Failed to run ticket photo migration:', error);
      // Don't fail startup - log and continue
    }

    // Enable V3-PLS if not already enabled
    try {
      const { enableV3PLSOnStartup } = await import('./scripts/enable-v3pls-startup');
      await enableV3PLSOnStartup();
    } catch (error) {
      logger.error('V3-PLS enablement error:', error);
      // Continue - don't fail startup
    }
    
    // Ensure critical tables exist
    const { ensureCriticalTables } = await import('./utils/ensure-critical-tables');
    await ensureCriticalTables();
    
    // Initialize system configurations
    const { initializeSystemConfigs } = await import('./routes/system-config');
    await initializeSystemConfigs();
    logger.info('✅ System configurations initialized');
    
    // Start customer name sync service
    const { customerNameSyncService } = await import('./services/syncCustomerNames');
    customerNameSyncService.start();
    logger.info('✅ Customer name sync service started');
    
    // Start challenge expiry job
    const challengeExpiryJob = await import('./jobs/challengeExpiry');
    challengeExpiryJob.default.start();
    logger.info('✅ Challenge expiry job started');
    
    // Start rank calculation job
    const rankCalculationJob = await import('./jobs/rankCalculation');
    rankCalculationJob.default.start();
    logger.info('✅ Rank calculation job started');
    
    // Start seasonal reset job
    const seasonalResetJob = await import('./jobs/seasonalReset');
    seasonalResetJob.default.start();
    logger.info('✅ Seasonal reset job started');
    
    // Start challenge agreement processor
    const { startChallengeAgreementProcessor } = await import('./jobs/challengeAgreementProcessor');
    startChallengeAgreementProcessor();
    logger.info('✅ Challenge agreement processor started');
    
    // Start booking rewards job
    const { startBookingRewardsJob } = await import('./jobs/bookingRewards');
    startBookingRewardsJob();
    logger.info('✅ Booking rewards job started');
    
    // Start token cleanup job
    const { tokenCleanupJob } = await import('./jobs/tokenCleanup');
    tokenCleanupJob.start();
    logger.info('✅ Token cleanup job started');
    
    // SOP module disabled - using OpenAI Assistants directly
    logger.info('✅ Using OpenAI Assistants for AI responses');
    
    // Run database migrations - ensure all tables exist
    try {
      // Run SOP system migrations
      logger.info('Running SOP system migrations...');
      await db.query(`
        -- OpenPhone conversations table
        CREATE TABLE IF NOT EXISTS openphone_conversations (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          conversation_id VARCHAR(255) UNIQUE,
          phone_number VARCHAR(20),
          customer_name VARCHAR(255),
          employee_name VARCHAR(255),
          messages JSONB NOT NULL DEFAULT '[]',
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW(),
          processed BOOLEAN DEFAULT FALSE,
          metadata JSONB DEFAULT '{}'
        );

        -- Extracted knowledge table
        CREATE TABLE IF NOT EXISTS extracted_knowledge (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          source_id UUID,
          source_type VARCHAR(20),
          category VARCHAR(50),
          problem TEXT NOT NULL,
          solution TEXT NOT NULL,
          confidence FLOAT,
          applied_to_sop BOOLEAN DEFAULT FALSE,
          sop_file VARCHAR(255),
          created_at TIMESTAMP DEFAULT NOW()
        );

        -- Shadow mode comparison table
        CREATE TABLE IF NOT EXISTS sop_shadow_comparisons (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          query TEXT NOT NULL,
          route VARCHAR(50) NOT NULL,
          assistant_response TEXT,
          sop_response TEXT,
          sop_confidence FLOAT,
          assistant_time_ms INTEGER,
          sop_time_ms INTEGER,
          created_at TIMESTAMP DEFAULT NOW()
        );

        -- SOP embeddings table
        CREATE TABLE IF NOT EXISTS sop_embeddings (
          id VARCHAR(255) PRIMARY KEY,
          assistant VARCHAR(50) NOT NULL,
          title VARCHAR(255) NOT NULL,
          content TEXT NOT NULL,
          embedding TEXT NOT NULL,
          metadata JSONB DEFAULT '{}',
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );

        -- SOP metrics table
        CREATE TABLE IF NOT EXISTS sop_metrics (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          date DATE DEFAULT CURRENT_DATE,
          total_requests INTEGER DEFAULT 0,
          sop_used INTEGER DEFAULT 0,
          assistant_used INTEGER DEFAULT 0,
          sop_avg_confidence FLOAT,
          sop_avg_response_time_ms FLOAT,
          assistant_avg_response_time_ms FLOAT
        );
      `);
      
      // Create indexes
      await db.query(`
        CREATE INDEX IF NOT EXISTS idx_openphone_conversations_processed 
          ON openphone_conversations(processed);
        CREATE INDEX IF NOT EXISTS idx_extracted_knowledge_category 
          ON extracted_knowledge(category);
        CREATE INDEX IF NOT EXISTS idx_extracted_knowledge_applied 
          ON extracted_knowledge(applied_to_sop);
        CREATE INDEX IF NOT EXISTS idx_sop_embeddings_assistant 
          ON sop_embeddings(assistant);
      `);
      
      logger.info('✅ SOP system migrations completed');
    } catch (migrationError) {
      logger.error('SOP migration error:', migrationError);
      // Continue - don't fail startup
    }
    
    // Create token blacklist table for logout functionality
    try {
      logger.info('Creating token blacklist table...');
      await db.query(`
        CREATE TABLE IF NOT EXISTS blacklisted_tokens (
          id SERIAL PRIMARY KEY,
          token_hash VARCHAR(255) NOT NULL UNIQUE,
          user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          session_id VARCHAR(255),
          expires_at TIMESTAMP NOT NULL,
          blacklisted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          reason VARCHAR(50) DEFAULT 'user_logout',
          ip_address VARCHAR(45),
          user_agent TEXT
        );
        
        CREATE INDEX IF NOT EXISTS idx_blacklisted_tokens_hash ON blacklisted_tokens(token_hash);
        CREATE INDEX IF NOT EXISTS idx_blacklisted_tokens_expires_at ON blacklisted_tokens(expires_at);
        CREATE INDEX IF NOT EXISTS idx_blacklisted_tokens_user_id ON blacklisted_tokens(user_id);
        CREATE INDEX IF NOT EXISTS idx_blacklisted_tokens_session_id ON blacklisted_tokens(session_id);
      `);
      
      // Create cleanup function
      await db.query(`
        CREATE OR REPLACE FUNCTION cleanup_expired_blacklisted_tokens()
        RETURNS INTEGER AS $$
        DECLARE
          deleted_count INTEGER;
        BEGIN
          DELETE FROM blacklisted_tokens 
          WHERE expires_at < CURRENT_TIMESTAMP;
          
          GET DIAGNOSTICS deleted_count = ROW_COUNT;
          RETURN deleted_count;
        END;
        $$ LANGUAGE plpgsql;
      `);
      
      logger.info('✅ Token blacklist table created');
    } catch (blacklistError: any) {
      if (blacklistError.code === '42P07') {
        logger.info('Token blacklist table already exists');
      } else {
        logger.error('Failed to create token blacklist table:', blacklistError);
      }
    }
    
    // Create Slack tables for message tracking
    try {
      logger.info('Creating Slack tables...');
      
      // Create slack_messages table first (parent table)
      await db.query(`
        CREATE TABLE IF NOT EXISTS slack_messages (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          slack_thread_ts VARCHAR(255) UNIQUE,
          request_id VARCHAR(255),
          user_name VARCHAR(255),
          user_email VARCHAR(255),
          location VARCHAR(255),
          request_text TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE INDEX IF NOT EXISTS idx_slack_messages_thread_ts ON slack_messages(slack_thread_ts);
        CREATE INDEX IF NOT EXISTS idx_slack_messages_created_at ON slack_messages(created_at DESC);
      `);
      
      // Create slack_replies table (child table)
      await db.query(`
        CREATE TABLE IF NOT EXISTS slack_replies (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          thread_ts VARCHAR(255) NOT NULL,
          user_name VARCHAR(255),
          user_id VARCHAR(255) NOT NULL,
          text TEXT NOT NULL,
          timestamp TIMESTAMP NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE INDEX IF NOT EXISTS idx_slack_replies_thread_ts ON slack_replies(thread_ts);
        CREATE INDEX IF NOT EXISTS idx_slack_replies_user_id ON slack_replies(user_id);
        CREATE INDEX IF NOT EXISTS idx_slack_replies_timestamp ON slack_replies(timestamp DESC);
      `);
      
      logger.info('✅ Slack tables created successfully');
    } catch (slackError: any) {
      if (slackError.code === '42P07') {
        logger.info('Slack tables already exist');
      } else {
        logger.error('Failed to create Slack tables:', slackError);
      }
    }
    
    // Create AI automation settings table
    try {
      logger.info('Creating AI automation settings table...');
      await db.query(`
        CREATE TABLE IF NOT EXISTS ai_automation_settings (
          id INTEGER PRIMARY KEY DEFAULT 1,
          gift_card_inquiries BOOLEAN DEFAULT true,
          llm_initial_analysis BOOLEAN DEFAULT true,
          trackman_reset BOOLEAN DEFAULT false,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      
      logger.info('✅ AI automation settings table created successfully');
    } catch (aiError: any) {
      if (aiError.code === '42P07') {
        logger.info('AI automation settings table already exists');
      } else {
        logger.error('Failed to create AI automation settings table:', aiError);
      }
    }
    
    // Add updated_at column to openphone_conversations if missing
    try {
      logger.info('Checking openphone_conversations columns...');
      await db.query(`
        ALTER TABLE openphone_conversations
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()
      `);
      
      // Update existing rows
      await db.query(`
        UPDATE openphone_conversations
        SET updated_at = COALESCE(created_at, NOW())
        WHERE updated_at IS NULL
      `);
      
      logger.info('✅ OpenPhone updated_at column verified');
    } catch (error) {
      logger.error('Failed to add updated_at column:', error);
    }
    
    // Run other migrations
    try {
      // First, try to create the table if it doesn't exist
      await db.query(`
        CREATE TABLE IF NOT EXISTS checklist_submissions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          category VARCHAR(50) NOT NULL CHECK (category IN ('cleaning', 'tech')),
          type VARCHAR(50) NOT NULL CHECK (type IN ('daily', 'weekly', 'quarterly')),
          location VARCHAR(100) NOT NULL,
          completed_tasks JSONB NOT NULL DEFAULT '[]',
          total_tasks INTEGER NOT NULL,
          completion_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          comments TEXT,
          ticket_created BOOLEAN DEFAULT FALSE,
          ticket_id UUID
        )
      `);
      
      // Add new columns if they don't exist
      await db.query(`
        ALTER TABLE checklist_submissions 
        ADD COLUMN IF NOT EXISTS comments TEXT
      `).catch(() => {});
      
      await db.query(`
        ALTER TABLE checklist_submissions 
        ADD COLUMN IF NOT EXISTS ticket_created BOOLEAN DEFAULT FALSE
      `).catch(() => {});
      
      await db.query(`
        ALTER TABLE checklist_submissions 
        ADD COLUMN IF NOT EXISTS ticket_id UUID
      `).catch(() => {});
      
      // Create indexes if they don't exist
      await db.query(`CREATE INDEX IF NOT EXISTS idx_checklist_submissions_user_id ON checklist_submissions(user_id)`);
      await db.query(`CREATE INDEX IF NOT EXISTS idx_checklist_submissions_category ON checklist_submissions(category)`);
      await db.query(`CREATE INDEX IF NOT EXISTS idx_checklist_submissions_type ON checklist_submissions(type)`);
      await db.query(`CREATE INDEX IF NOT EXISTS idx_checklist_submissions_location ON checklist_submissions(location)`);
      await db.query(`CREATE INDEX IF NOT EXISTS idx_checklist_submissions_completion_time ON checklist_submissions(completion_time DESC)`);
      
      logger.info('✅ Checklist submissions table and indexes verified');
      
      // Verify the table exists and is accessible
      const tableCheck = await db.query(`
        SELECT COUNT(*) as count FROM information_schema.tables 
        WHERE table_name = 'checklist_submissions'
      `);
      
      if (tableCheck.rows[0].count > 0) {
        const rowCount = await db.query('SELECT COUNT(*) as total FROM checklist_submissions');
        logger.info(`✅ Checklist submissions table confirmed: ${rowCount.rows[0].total} records`);
      } else {
        logger.error('❌ Checklist submissions table creation failed');
      }
    } catch (migrationError: any) {
      logger.error('❌ Checklist submissions migration error:', migrationError);
      
      // Try a more basic creation without foreign key constraint
      try {
        await db.query(`
          CREATE TABLE IF NOT EXISTS checklist_submissions (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL,
            category VARCHAR(50) NOT NULL,
            type VARCHAR(50) NOT NULL,
            location VARCHAR(100) NOT NULL,
            completed_tasks TEXT NOT NULL DEFAULT '[]',
            total_tasks INTEGER NOT NULL,
            completion_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          )
        `);
        logger.info('✅ Created checklist submissions table without constraints');
      } catch (fallbackError: any) {
        logger.error('❌ Failed to create checklist submissions table:', fallbackError);
      }
    }
  } catch (error) {
    logger.error('❌ Database initialization failed:', error);
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    } else {
      logger.warn('⚠️  Running without database in development mode');
    }
    
    // After database initialization, log final status
    logger.info(`📊 Database: ${db.initialized ? 'PostgreSQL Connected' : 'Not connected'}`);
    logger.info(`🔐 Environment: ${process.env.NODE_ENV || 'development'}`);
    logger.info(`🛡️ Sentry: ${process.env.SENTRY_DSN ? 'Enabled' : 'Disabled'}`);
  }
}

// Graceful shutdown handler
async function gracefulShutdown(signal: string) {
  logger.info(`${signal} received, starting graceful shutdown...`);
  
  const server = app.get('server');
  if (server) {
    // Stop accepting new connections
    server.close(async () => {
      logger.info('HTTP server closed');
      
      try {
        // Close database connections
        if (db.initialized) {
          await db.end();
          logger.info('Database connections closed');
        }
        
        // Flush Sentry events
        const Sentry = await import('@sentry/node');
        await Sentry.close(2000);
        logger.info('Sentry flushed');
        
        logger.info('Graceful shutdown completed');
        process.exit(0);
      } catch (error) {
        logger.error('Error during shutdown:', error);
        process.exit(1);
      }
    });
    
    // Force shutdown after 30 seconds
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 30000);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  
  // Send to Sentry
  import('@sentry/node').then(Sentry => {
    Sentry.captureException(error);
  });
  
  // In production, attempt graceful shutdown
  if (process.env.NODE_ENV === 'production') {
    logger.error('Attempting graceful shutdown after uncaught exception...');
    gracefulShutdown('UNCAUGHT_EXCEPTION');
  } else {
    process.exit(1);
  }
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  
  // Send to Sentry
  import('@sentry/node').then(Sentry => {
    Sentry.captureException(reason instanceof Error ? reason : new Error(String(reason)));
  });
  
  // In production, log but don't exit
  if (process.env.NODE_ENV === 'production') {
    logger.warn('Continuing despite unhandled rejection...');
  } else {
    process.exit(1);
  }
});

// Start the server
startServer().catch(error => {
  logger.error('Failed to start server:', error);
  if (process.env.NODE_ENV !== 'production') {
    process.exit(1);
  }
});
// Force deployment Mon  1 Sep 2025 10:51:07 ADT
