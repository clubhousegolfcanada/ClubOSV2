import { Router } from 'express';
import authRoutes from './auth';
import profileRoutes from './profile';
import socialRoutes from './social';
import bookingsRoutes from './bookings';
import eventsRoutes from './events';
import statsRoutes from './stats';
import { authenticateCustomer } from '../../middleware/customerAuth';
import { customerApiLimiter } from '../../middleware/customerRateLimit';

const router = Router();

// Public routes (no auth required)
router.use('/auth', authRoutes);

// Apply rate limiting to all customer API endpoints
router.use(customerApiLimiter);

// Protected routes (auth required)
router.use('/profile', authenticateCustomer, profileRoutes);
router.use('/social', authenticateCustomer, socialRoutes);
router.use('/bookings', authenticateCustomer, bookingsRoutes);
router.use('/events', authenticateCustomer, eventsRoutes);
router.use('/stats', authenticateCustomer, statsRoutes);

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

export default router;