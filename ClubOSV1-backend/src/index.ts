import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { join } from 'path';

// Load environment variables FIRST
dotenv.config();

import { initSentry, sentryRequestHandler, sentryTracingHandler, sentryErrorHandler, setupSentryErrorHandler } from './utils/sentry';
import { logger } from './utils/logger';
import { db } from './utils/database';

// Initialize Sentry before anything else
initSentry();
import authRoutes from './routes/auth';
import bookingsRoutes from './routes/bookings';
import ticketsRoutes from './routes/tickets';
import feedbackRoutes from './routes/feedback';
import llmRoutes from './routes/llm';
import slackRoutes from './routes/slack';
import customerRoutes from './routes/customer';
import userSettingsRoutes from './routes/userSettings';
import backupRoutes from './routes/backup';
import accessRoutes from './routes/access';
import historyRoutes from './routes/history';
// import testCorsRoutes from './routes/test-cors'; // Removed during cleanup
import systemConfigRoutes from './routes/system-config';
import analyticsRoutes from './routes/analytics';
import checklistsRoutes from './routes/checklists';
import remoteActionsRoutes from './routes/remoteActions';
import debugRoutes from './routes/debug';
import { requestLogger } from './middleware/requestLogger';
import { errorHandler } from './middleware/errorHandler';
import { rateLimiter, llmRateLimiter } from './middleware/rateLimiter';
import { trackUsage } from './middleware/usageTracking';
import { authLimiter } from './middleware/authLimiter';
import { sanitizeMiddleware } from './middleware/requestValidation';

const app = express();
const PORT = process.env.PORT || 3001;

// Trust proxy - required for proper IP detection on Railway
app.set('trust proxy', true);

// Sentry request handler must be first middleware
app.use(sentryRequestHandler);
app.use(sentryTracingHandler);

// Middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// Configure CORS with explicit options
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Allow all origins in production for now
    // You can restrict this later to specific domains
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Disposition']
}));

// Custom middleware to capture raw body for Slack signature verification
app.use('/api/slack/events', express.raw({ type: 'application/json' }), (req, res, next) => {
  req.rawBody = req.body;
  req.body = JSON.parse(req.body.toString());
  next();
});

app.use(express.json({ limit: '10mb' }));
app.use(sanitizeMiddleware);
app.use(requestLogger);

// Handle preflight requests
app.options('*', cors());

// Rate limiting
app.use('/api/', rateLimiter);
app.use('/api/auth', authLimiter);

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/bookings', bookingsRoutes);
app.use('/api/tickets', ticketsRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/llm', llmRateLimiter, trackUsage, llmRoutes);
app.use('/api/slack', slackRoutes);
app.use('/api/customer', customerRoutes);
app.use('/api/user-settings', userSettingsRoutes);
app.use('/api/backup', backupRoutes);
app.use('/api/access', accessRoutes);
app.use('/api/history', historyRoutes);
// app.use('/api/test-cors', testCorsRoutes); // Removed during cleanup
app.use('/api/system-config', systemConfigRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/checklists', checklistsRoutes);
app.use('/api/remote-actions', remoteActionsRoutes);
app.use('/api/debug', debugRoutes);

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    // Basic health response
    const health: any = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      version: process.env.npm_package_version || '1.0.0'
    };

    // Check database connection if initialized
    if (db.initialized) {
      try {
        await db.query('SELECT 1');
        health.database = 'connected';
      } catch (error) {
        health.database = 'error';
        health.status = 'degraded';
      }
    } else {
      health.database = 'not initialized';
    }

    res.status(health.status === 'ok' ? 200 : 503).json(health);
  } catch (error) {
    res.status(503).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: 'Health check failed'
    });
  }
});

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
    // Initialize database
    await db.initialize();
    logger.info('✅ Database initialized successfully');
    
    // Initialize system configurations
    const { initializeSystemConfigs } = await import('./routes/system-config');
    await initializeSystemConfigs();
    logger.info('✅ System configurations initialized');
    
    // Run database migrations - ensure checklist_submissions table exists
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
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `);
      
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
  }
  
  // Start server regardless in development
  const server = app.listen(PORT, () => {
    logger.info(`🚀 Server running on port ${PORT}`);
    logger.info(`📊 Database: ${db.initialized ? 'PostgreSQL' : 'Not connected'}`);
    logger.info(`🔐 Environment: ${process.env.NODE_ENV || 'development'}`);
    logger.info(`🛡️ Sentry: ${process.env.SENTRY_DSN ? 'Enabled' : 'Disabled'}`);
  });

  // Enable keep-alive with a longer timeout
  server.keepAliveTimeout = 65000; // 65 seconds
  server.headersTimeout = 66000; // 66 seconds

  // Store server instance for graceful shutdown
  app.set('server', server);
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
