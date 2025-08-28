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
import bookingsRoutes from './routes/bookings';
import ticketsRoutes from './routes/tickets';
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
import checklistsRoutes from './routes/checklists';
import remoteActionsRoutes from './routes/remoteActions';
import doorAccessRoutes from './routes/doorAccess';
import debugRoutes from './routes/debug';
import openphoneRoutes from './routes/openphone';
import openphoneV3Routes from './routes/openphone-v3';
import messagesRoutes from './routes/messages';
import notificationsRoutes from './routes/notifications';
import knowledgeRoutes from './routes/knowledge';
import debugOpenphoneRoutes from './routes/debug-openphone';
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
import unifiDoorsRoutes from './routes/unifi-doors';
import boxesRoutes from './routes/boxes';
import debugCacheRoutes from './routes/debug-cache';
import testKnowledgeRoutes from './routes/test-knowledge';
import processKnowledgeRoutes from './routes/process-knowledge';
import friendsRoutes from './routes/friends';
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
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
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
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
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

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api', csrfRoutes);
app.use('/api/bookings', bookingsRoutes);
app.use('/api/tickets', ticketsRoutes);
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
app.use('/api/leaderboard', require('./routes/leaderboard').default);
app.use('/api/seasons', require('./routes/seasons').default);
app.use('/api/badges', require('./routes/badges').default);
app.use('/api/achievements', require('./routes/achievements').default);
app.use('/api/trackman', require('./routes/trackman').default);
app.use('/api/admin/cc-adjustments', require('./routes/admin/ccAdjustments').default);
app.use('/api/user-settings', userSettingsRoutes);
app.use('/api/backup', backupRoutes);
app.use('/api/access', accessRoutes);
app.use('/api/history', historyRoutes);
// app.use('/api/test-cors', testCorsRoutes); // Removed during cleanup
app.use('/api/system-config', systemConfigRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/checklists', checklistsRoutes);
app.use('/api/remote-actions', remoteActionsRoutes);
app.use('/api/door-access', doorAccessRoutes);
app.use('/api/ninjaone-remote', require('./routes/ninjaone-remote').default);
app.use('/api/debug', debugRoutes);
app.use('/api/openphone', openphoneRoutes);
app.use('/api/openphone-v3', openphoneV3Routes);
app.use('/api/openphone-processing', openphoneProcessingRoutes);
app.use('/api/contacts', require('./routes/contacts').default);
app.use('/api/messages', messagesRoutes);
app.use('/api/debug-openphone', debugOpenphoneRoutes);
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
app.use('/api/unifi-doors', unifiDoorsRoutes);
app.use('/api/debug', debugCacheRoutes);
app.use('/api/debug', require('./routes/debug-flow').default);
app.use('/api/system-status', require('./routes/system-status').default);
app.use('/api/system-settings', require('./routes/systemSettings').default);
app.use('/api', testKnowledgeRoutes);
app.use('/api/process-knowledge', processKnowledgeRoutes);

// HubSpot webhook routes
import hubspotBookingWebhook from './routes/webhooks/hubspotBookings';
app.use('/api/webhooks/hubspot', hubspotBookingWebhook);

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
    
    // Initialize database
    logger.info('🔄 Initializing database connection...');
    await db.initialize();
    logger.info('✅ Database initialized successfully');
    
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
