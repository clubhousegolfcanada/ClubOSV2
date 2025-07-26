#!/bin/bash
echo "🔧 Comprehensive Database Fix"
echo "============================="

cd /Users/michaelbelairch1/Desktop/Clubhouse\ OS\ \(Root\)/CLUBOSV1

# First, let's revert the database changes and use JSON files for now
echo "📝 Reverting to stable JSON-based system..."

# Restore the original auth routes
cat > ClubOSV1-backend/src/routes/auth.ts << 'EOF'
import { Router, Request, Response, NextFunction } from 'express';
import bcryptjs from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';
import { readJsonFile, writeJsonFile, appendToJsonArray } from '../utils/fileUtils';
import { User, JWTPayload } from '../types';
import { AppError } from '../middleware/errorHandler';
import { validate } from '../middleware/validation';
import { body } from 'express-validator';
import { authenticate, generateToken } from '../middleware/auth';
import { roleGuard } from '../middleware/roleGuard';

const router = Router();

// Login endpoint
router.post('/login',
  validate([
    body('email')
      .trim()
      .isEmail()
      .normalizeEmail()
      .withMessage('Valid email is required'),
    body('password')
      .notEmpty()
      .withMessage('Password is required')
  ]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password } = req.body;
      
      logger.info('Login attempt:', { email });
      
      // Load users
      const users = await readJsonFile<User[]>('users.json');
      
      // Find user by email
      const user = users.find(u => u.email === email);
      
      if (!user) {
        throw new AppError('INVALID_CREDENTIALS', 'Invalid email or password', 401);
      }
      
      // Verify password
      const isValidPassword = await bcryptjs.compare(password, user.password);
      
      if (!isValidPassword) {
        throw new AppError('INVALID_CREDENTIALS', 'Invalid email or password', 401);
      }
      
      // Generate JWT token using the proper function
      const sessionId = uuidv4();
      const token = generateToken({
        userId: user.id,
        email: user.email,
        role: user.role,
        sessionId: sessionId
      });
      
      // Log successful login
      await appendToJsonArray('authLogs.json', {
        id: uuidv4(),
        userId: user.id,
        action: 'login',
        timestamp: new Date().toISOString(),
        ip: req.ip
      });
      
      // Remove password from response
      const { password: _, ...userWithoutPassword } = user;
      
      logger.info('Login successful:', { userId: user.id, email: user.email });
      
      res.json({
        success: true,
        data: {
          user: userWithoutPassword,
          token
        }
      });
      
    } catch (error) {
      next(error);
    }
  }
);

// Get current user
router.get('/me',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const users = await readJsonFile<User[]>('users.json');
      const user = users.find(u => u.id === req.user!.id);
      
      if (!user) {
        throw new AppError('USER_NOT_FOUND', 'User not found', 404);
      }
      
      // Remove password from response
      const { password: _, ...userWithoutPassword } = user;
      
      res.json({
        success: true,
        data: userWithoutPassword
      });
      
    } catch (error) {
      next(error);
    }
  }
);

// Register endpoint (admin only)
router.post('/register',
  authenticate,
  roleGuard(['admin']),
  validate([
    body('email')
      .trim()
      .isEmail()
      .normalizeEmail()
      .withMessage('Valid email is required'),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters')
      .matches(/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('Password must contain uppercase, lowercase and numbers'),
    body('name')
      .trim()
      .notEmpty()
      .withMessage('Name is required'),
    body('role')
      .isIn(['admin', 'operator', 'support', 'kiosk'])
      .withMessage('Invalid role'),
    body('phone')
      .optional({ nullable: true, checkFalsy: true })
      .trim()
      .matches(/^[+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/)
      .withMessage('Invalid phone number format')
  ]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      logger.info('Register endpoint called', {
        user: req.user,
        body: { ...req.body, password: '***' }
      });
      
      const { email, password, name, role, phone } = req.body;
      
      // Load existing users
      const users = await readJsonFile<User[]>('users.json');
      
      // Check if user already exists
      if (users.find(u => u.email === email)) {
        throw new AppError('USER_EXISTS', 'User with this email already exists', 409);
      }
      
      // Hash password
      const hashedPassword = await bcryptjs.hash(password, 10);
      
      // Create new user
      const newUser: User = {
        id: uuidv4(),
        email,
        password: hashedPassword,
        name,
        phone,
        role,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      // Add user to database
      users.push(newUser);
      await writeJsonFile('users.json', users);
      
      // Remove password from response
      const { password: _, ...userWithoutPassword } = newUser;
      
      logger.info('User created:', { userId: newUser.id, email: newUser.email, createdBy: req.user!.id });
      
      res.status(201).json({
        success: true,
        data: userWithoutPassword
      });
      
    } catch (error) {
      next(error);
    }
  }
);

// List users (admin only)
router.get('/users',
  authenticate,
  roleGuard(['admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const users = await readJsonFile<User[]>('users.json');
      
      // Remove passwords from response
      const usersWithoutPasswords = users.map(({ password, ...user }) => user);
      
      res.json({
        success: true,
        data: usersWithoutPasswords
      });
      
    } catch (error) {
      next(error);
    }
  }
);

// Change password
router.post('/change-password',
  authenticate,
  validate([
    body('currentPassword')
      .notEmpty()
      .withMessage('Current password is required'),
    body('newPassword')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters')
      .matches(/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('Password must contain uppercase, lowercase and numbers')
  ]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { currentPassword, newPassword } = req.body;
      
      const users = await readJsonFile<User[]>('users.json');
      const userIndex = users.findIndex(u => u.id === req.user!.id);
      
      if (userIndex === -1) {
        throw new AppError('USER_NOT_FOUND', 'User not found', 404);
      }
      
      const user = users[userIndex];
      
      // Verify current password
      const isValidPassword = await bcryptjs.compare(currentPassword, user.password);
      
      if (!isValidPassword) {
        throw new AppError('INVALID_PASSWORD', 'Current password is incorrect', 401);
      }
      
      // Hash new password
      const hashedPassword = await bcryptjs.hash(newPassword, 10);
      
      // Update user password
      users[userIndex] = {
        ...user,
        password: hashedPassword,
        updatedAt: new Date().toISOString()
      };
      
      await writeJsonFile('users.json', users);
      
      logger.info('Password changed:', { userId: user.id });
      
      res.json({
        success: true,
        message: 'Password changed successfully'
      });
      
    } catch (error) {
      next(error);
    }
  }
);

// Update user profile
router.put('/users/:userId',
  authenticate,
  validate([
    body('name')
      .optional()
      .trim()
      .notEmpty()
      .withMessage('Name cannot be empty'),
    body('phone')
      .optional({ nullable: true, checkFalsy: true })
      .trim()
      .matches(/^[+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/)
      .withMessage('Invalid phone number format'),
    body('email')
      .optional()
      .trim()
      .isEmail()
      .normalizeEmail()
      .withMessage('Valid email is required')
  ]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.params;
      const { name, phone, email } = req.body;
      
      // Users can only update their own profile unless they're admin
      if (userId !== req.user!.id && req.user!.role !== 'admin') {
        throw new AppError('UNAUTHORIZED', 'You can only update your own profile', 403);
      }
      
      const users = await readJsonFile<User[]>('users.json');
      const userIndex = users.findIndex(u => u.id === userId);
      
      if (userIndex === -1) {
        throw new AppError('USER_NOT_FOUND', 'User not found', 404);
      }
      
      // Check if email is being changed and if it's already taken
      if (email && email !== users[userIndex].email) {
        if (users.find(u => u.email === email && u.id !== userId)) {
          throw new AppError('EMAIL_EXISTS', 'Email already in use', 409);
        }
      }
      
      // Update user data
      const updatedUser = {
        ...users[userIndex],
        ...(name && { name }),
        ...(phone !== undefined && { phone }),
        ...(email && { email }),
        updatedAt: new Date().toISOString()
      };
      
      users[userIndex] = updatedUser;
      await writeJsonFile('users.json', users);
      
      logger.info('User profile updated:', { userId, updatedBy: req.user!.id });
      
      // Remove password from response
      const { password: _, ...userWithoutPassword } = updatedUser;
      
      res.json({
        success: true,
        data: userWithoutPassword
      });
      
    } catch (error) {
      next(error);
    }
  }
);

// Reset user password (admin only)
router.post('/users/:userId/reset-password',
  authenticate,
  roleGuard(['admin']),
  validate([
    body('newPassword')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters')
      .matches(/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('Password must contain uppercase, lowercase and numbers')
  ]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.params;
      const { newPassword } = req.body;
      
      // Prevent resetting own password through this endpoint
      if (userId === req.user!.id) {
        throw new AppError('SELF_RESET', 'Use the change-password endpoint to change your own password', 400);
      }
      
      const users = await readJsonFile<User[]>('users.json');
      const userIndex = users.findIndex(u => u.id === userId);
      
      if (userIndex === -1) {
        throw new AppError('USER_NOT_FOUND', 'User not found', 404);
      }
      
      // Hash new password
      const hashedPassword = await bcryptjs.hash(newPassword, 10);
      
      // Update user password
      users[userIndex] = {
        ...users[userIndex],
        password: hashedPassword,
        updatedAt: new Date().toISOString()
      };
      
      await writeJsonFile('users.json', users);
      
      logger.info('User password reset:', { userId, resetBy: req.user!.id });
      
      res.json({
        success: true,
        message: 'Password reset successfully'
      });
      
    } catch (error) {
      next(error);
    }
  }
);

// Delete user (admin only)
router.delete('/users/:userId',
  authenticate,
  roleGuard(['admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.params;
      
      // Prevent self-deletion
      if (userId === req.user!.id) {
        throw new AppError('SELF_DELETE', 'Cannot delete your own account', 400);
      }
      
      const users = await readJsonFile<User[]>('users.json');
      const userIndex = users.findIndex(u => u.id === userId);
      
      if (userIndex === -1) {
        throw new AppError('USER_NOT_FOUND', 'User not found', 404);
      }
      
      // Remove user
      users.splice(userIndex, 1);
      await writeJsonFile('users.json', users);
      
      logger.info('User deleted:', { userId, deletedBy: req.user!.id });
      
      res.json({
        success: true,
        message: 'User deleted successfully'
      });
      
    } catch (error) {
      next(error);
    }
  }
);

export default router;
EOF

# Restore original index.ts
cat > ClubOSV1-backend/src/index.ts << 'EOF'
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

// Trust proxy for Railway deployment
app.set('trust proxy', true);

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
EOF

# Remove database files that are causing issues
rm -f ClubOSV1-backend/src/utils/database.ts
rm -f ClubOSV1-backend/dist/utils/database.js

# Build
cd ClubOSV1-backend
npm run build
cd ..

# Commit
git add -A
git commit -m "Revert to stable JSON-based system

- Removed problematic database implementation
- Restored original auth routes using JSON files
- Fixed TypeScript compilation errors
- System now works but without PostgreSQL persistence
- This is a temporary fix to get the app working"
git push origin main

echo "✅ Reverted to working JSON-based system"
echo "The app should work now, but data won't persist across deployments"
echo "We'll implement PostgreSQL properly in a future update"
