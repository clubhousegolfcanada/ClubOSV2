import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import { createServer } from 'http';
import bookingRoutes from './routes/bookings';
import accessRoutes from './routes/access';
import llmRoutes from './routes/llm';
import slackRoutes from './routes/slack';
import historyRoutes from './routes/history';
import llmProviderRoutes from './routes/llmProviders';
import usageRoutes from './routes/usage';
import gptWebhookRoutes from './routes/gptWebhook';
import knowledgeRoutes from './routes/knowledge';
import toneRoutes from './routes/tone';
import authRoutes from './routes/auth';
import feedbackRoutes from './routes/feedback';
import ticketRoutes from './routes/tickets';
import debugRoutes from './routes/debug';
import backupRoutes from './routes/backup';
import setupRoutes from './routes/setup';
import userSettingsRoutes from './routes/userSettings';
import customerRoutes from './routes/customer';
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';
import { trackUsage, checkRateLimit } from './middleware/usageTracking';
import { applySecurityMiddleware } from './middleware/security';
import { initializeDataFiles } from './utils/fileUtils';
import { logger } from './utils/logger';
import { envValidator, config } from './utils/envValidator';
import { ensureAdminUser } from './utils/ensureAdmin';

// Validate environment variables before starting
envValidator.validate();

const app: Express = express();
const PORT = config.PORT;
const server = createServer(app);

// Initialize data directory and files
const initializeApp = async () => {
  try {
    await initializeDataFiles();
    logger.info('Data files initialized successfully');
    
    // Ensure admin user exists
    await ensureAdminUser();
    
    // Setup database if DATABASE_URL exists
    if (process.env.DATABASE_URL && process.env.RUN_DB_SETUP !== 'false') {
      try {
        logger.info('Database URL detected, attempting database setup...');
        const { setupDatabase } = require('./scripts/setupDatabase');
        await setupDatabase();
        logger.info('Database setup completed successfully');
      } catch (error) {
        logger.error('Database setup failed:', error);
        // Don't exit, just log the error
      }
    }
  } catch (error) {
    logger.error('Failed to initialize data files:', error);
    process.exit(1);
  }
};

// Manual CORS headers middleware - place before other middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  // Set CORS headers manually
  const origin = req.headers.origin;
  const allowedOrigins = [
    'https://club-osv-2-owqx.vercel.app',
    'http://localhost:3000',
    'http://localhost:3001'
  ];
  
  if (origin && (allowedOrigins.includes(origin) || origin.match(/^https:\/\/club-osv-2-.*\.vercel\.app$/))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-CSRF-Token, X-Session-Token, X-API-Key');
    res.setHeader('Access-Control-Expose-Headers', 'X-New-Token');
    res.setHeader('Access-Control-Max-Age', '86400');
  }
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Apply security middleware first
applySecurityMiddleware(app);

// CORS configuration (after helmet)
app.use(cors({
  origin: [
    config.FRONTEND_URL || 'http://localhost:3000',
    'https://club-osv-2-owqx.vercel.app',
    'https://club-osv-2-owqx-*.vercel.app',
    /^https:\/\/club-osv-2-.*\.vercel\.app$/
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'X-Session-Token', 'X-API-Key'],
  exposedHeaders: ['X-New-Token'],
  maxAge: 86400 // 24 hours
}));

// Explicit preflight handler for all routes
app.options('*', cors());

// Raw body capture for webhook signature verification
app.use('/api/slack/webhook', express.raw({ type: 'application/json' }));
app.use('/api/gpt-webhook', express.raw({ type: 'application/json' }));

// Body parsing middleware for other routes (after security headers)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging (after body parsing)
app.use(requestLogger);

// Usage tracking and rate limiting - TEMPORARILY DISABLED
// app.use(trackUsage);
// app.use('/api', checkRateLimit);

// Health check endpoint (public)
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: config.NODE_ENV
  });
});

// CORS test endpoint
app.get('/api/cors-test', (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'CORS is working!',
    origin: req.headers.origin,
    timestamp: new Date().toISOString()
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/debug', debugRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/access', accessRoutes);
app.use('/api/llm', llmRoutes);
app.use('/api/llm', llmProviderRoutes);
app.use('/api/slack', slackRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/usage', usageRoutes);
app.use('/api/gpt-webhook', gptWebhookRoutes);
app.use('/api/knowledge', knowledgeRoutes);
app.use('/api/tone', toneRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/backup', backupRoutes);
app.use('/api/setup', setupRoutes);
app.use('/api/user', userSettingsRoutes);
app.use('/api/customer', customerRoutes);

// Static file serving for Google Drive sync (protected)
app.use('/sync', express.static(path.join(__dirname, 'data', 'sync')));

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Cannot ${req.method} ${req.path}`,
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware (must be last)
app.use(errorHandler);

// Graceful shutdown
const gracefulShutdown = async () => {
  logger.info('Received shutdown signal, closing server gracefully...');
  
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });

  // Force shutdown after 10 seconds
  setTimeout(() => {
    logger.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Uncaught exception handler
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  gracefulShutdown();
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection:', { 
    reason: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined,
    promise: String(promise)
  });
  gracefulShutdown();
});

// Start server
const startServer = async () => {
  await initializeApp();
  
  server.listen(PORT, () => {
    logger.info(`⚡️ ClubOSV1 Backend is running on http://localhost:${PORT}`);
    logger.info(`📁 Data directory: ${path.join(__dirname, 'data')}`);
    logger.info(`🔄 Environment: ${config.NODE_ENV}`);
    logger.info(`🔒 Security: Enhanced security middleware active`);
  });
};

startServer().catch((error) => {
  logger.error('Failed to start server:', error);
  process.exit(1);
});

export default app;
