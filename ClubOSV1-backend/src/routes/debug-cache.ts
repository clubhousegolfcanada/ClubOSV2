import { Router } from 'express';
import { cacheService } from '../services/cacheService';
import { logger } from '../utils/logger';

const router = Router();

// Debug endpoint to check cache status
router.get('/cache-status', async (req, res) => {
  try {
    // Test Redis connection
    const testKey = 'test:ping';
    const testValue = { test: true, timestamp: Date.now() };
    
    // Try to set a value
    const setResult = await cacheService.set(testKey, testValue, { ttl: 60 });
    
    // Try to get it back
    const getResult = await cacheService.get(testKey);
    
    // Get cache stats
    const stats = cacheService.getStats();
    
    // Check Redis URL
    const redisUrl = process.env.REDIS_URL;
    const hasRedisUrl = !!redisUrl;
    const redisHost = redisUrl ? new URL(redisUrl.replace('redis://', 'http://')).hostname : 'none';
    
    res.json({
      redis: {
        configured: hasRedisUrl,
        host: redisHost,
        connected: cacheService.isAvailable(),
        testWrite: setResult,
        testRead: !!getResult,
        testValue: getResult
      },
      stats,
      environment: {
        REDIS_URL: hasRedisUrl ? 'SET (hidden)' : 'NOT SET',
        NODE_ENV: process.env.NODE_ENV,
        ENABLE_CACHING: process.env.ENABLE_CACHING !== 'false'
      }
    });
  } catch (error) {
    logger.error('Cache status check failed:', error);
    res.status(500).json({
      error: 'Cache status check failed',
      message: error.message
    });
  }
});

// Test cache performance
router.post('/cache-test', async (req, res) => {
  const { testData = 'default test data' } = req.body;
  const cacheKey = `test:performance:${testData}`;
  
  // First try - should miss cache
  const start1 = Date.now();
  let result1 = await cacheService.get(cacheKey);
  const time1 = Date.now() - start1;
  
  if (!result1) {
    // Simulate expensive operation
    await new Promise(resolve => setTimeout(resolve, 1000));
    result1 = { data: testData, timestamp: Date.now() };
    await cacheService.set(cacheKey, result1, { ttl: 300 });
  }
  
  // Second try - should hit cache
  const start2 = Date.now();
  const result2 = await cacheService.get(cacheKey);
  const time2 = Date.now() - start2;
  
  res.json({
    firstAttempt: {
      cached: false,
      time: time1
    },
    secondAttempt: {
      cached: !!result2,
      time: time2
    },
    improvement: time1 > 0 ? Math.round(((time1 - time2) / time1) * 100) : 0,
    cacheWorking: !!result2 && time2 < 50
  });
});

export default router;