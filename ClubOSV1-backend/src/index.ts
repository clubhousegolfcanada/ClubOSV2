import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { join } from 'path';

// Load environment variables FIRST
dotenv.config();

import { logger } from './utils/logger';
import { db } from './utils/database';
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
import testCorsRoutes from './routes/test-cors';
import systemConfigRoutes from './routes/system-config';
import { requestLogger } from './middleware/requestLogger';
import { errorHandler } from './middleware/errorHandler';
import { rateLimiter } from './middleware/rateLimiter';
import { trackUsage } from './middleware/usageTracking';
import { authLimiter } from './middleware/authLimiter';

const app = express();
const PORT = process.env.PORT || 3001;

// Trust proxy - required for proper IP detection on Railway
app.set('trust proxy', true);

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
app.use('/api/llm', trackUsage, llmRoutes);
app.use('/api/slack', slackRoutes);
app.use('/api/customer', customerRoutes);
app.use('/api/user-settings', userSettingsRoutes);
app.use('/api/backup', backupRoutes);
app.use('/api/access', accessRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/test-cors', testCorsRoutes);
app.use('/api/system-config', systemConfigRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    database: 'postgresql',
    version: process.env.npm_package_version || '1.0.0'
  });
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
  } catch (error) {
    logger.error('❌ Database initialization failed:', error);
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    } else {
      logger.warn('⚠️  Running without database in development mode');
    }
  }
  
  // Start server regardless in development
  app.listen(PORT, () => {
    logger.info(`🚀 Server running on port ${PORT}`);
    logger.info(`📊 Database: ${db.initialized ? 'PostgreSQL' : 'Not connected'}`);
    logger.info(`🔐 Environment: ${process.env.NODE_ENV || 'development'}`);
  });
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully...');
  process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  // Don't exit in production - try to recover
  if (process.env.NODE_ENV === 'production') {
    logger.warn('Attempting to continue despite uncaught exception...');
  } else {
    process.exit(1);
  }
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit in production - try to recover
  if (process.env.NODE_ENV === 'production') {
    logger.warn('Attempting to continue despite unhandled rejection...');
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
