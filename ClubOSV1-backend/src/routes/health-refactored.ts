import { Router } from 'express';
import { HealthController } from '../controllers/HealthController';

const router = Router();
const healthController = new HealthController();

/**
 * Health check routes - refactored version
 * This demonstrates the new architecture pattern
 * Old version is still at /routes/health.ts for comparison
 */

// Basic health check
router.get('/health', healthController.healthCheck);

// Detailed health check
router.get('/health/detailed', healthController.detailedHealthCheck);

export default router;