import Redis from 'ioredis';
import { createHash } from 'crypto';
import { logger } from '../utils/logger';

interface CacheOptions {
  ttl?: number; // Time to live in seconds
  prefix?: string; // Key prefix for namespacing
}

interface CacheStats {
  hits: number;
  misses: number;
  errors: number;
  hitRate: number;
}

class CacheService {
  private static instance: CacheService;
  private redis: Redis | null = null;
  private fallbackCache: Map<string, { value: any; expiry: number }> = new Map();
  private stats = { hits: 0, misses: 0, errors: 0 };
  private isConnected = false;

  private constructor() {
    this.initializeRedis();
  }

  static getInstance(): CacheService {
    if (!CacheService.instance) {
      CacheService.instance = new CacheService();
    }
    return CacheService.instance;
  }

  private initializeRedis() {
    try {
      // Use Redis if available, otherwise use in-memory cache
      const redisUrl = process.env.REDIS_URL || process.env.REDIS_TLS_URL;
      
      // Skip Redis if URL contains railway.internal (not accessible)
      if (redisUrl && !redisUrl.includes('railway.internal')) {
        this.redis = new Redis(redisUrl, {
          maxRetriesPerRequest: 3,
          retryStrategy: (times) => {
            if (times > 3) {
              logger.warn('Redis connection failed, falling back to in-memory cache');
              this.redis = null;
              return null;
            }
            return Math.min(times * 50, 2000);
          },
          reconnectOnError: (err) => {
            const targetError = 'READONLY';
            if (err.message.includes(targetError)) {
              return true;
            }
            return false;
          }
        });

        this.redis.on('connect', () => {
          this.isConnected = true;
          logger.info('Redis cache connected');
        });

        this.redis.on('error', (err) => {
          logger.error('Redis cache error:', err);
          this.isConnected = false;
        });

        this.redis.on('close', () => {
          this.isConnected = false;
          logger.warn('Redis connection closed');
        });
      } else {
        logger.info('No Redis URL found, using in-memory cache');
      }
    } catch (error) {
      logger.error('Failed to initialize Redis:', error);
      this.redis = null;
    }
  }

  /**
   * Generate a cache key from request parameters
   */
  generateKey(prefix: string, params: any): string {
    const hash = createHash('md5')
      .update(JSON.stringify(params))
      .digest('hex');
    return `${prefix}:${hash}`;
  }

  /**
   * Get a value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      if (this.redis && this.isConnected) {
        const value = await this.redis.get(key);
        if (value) {
          this.stats.hits++;
          logger.debug(`Cache hit for key: ${key}`);
          return JSON.parse(value);
        }
      } else {
        // Fallback to in-memory cache
        const cached = this.fallbackCache.get(key);
        if (cached && cached.expiry > Date.now()) {
          this.stats.hits++;
          logger.debug(`Memory cache hit for key: ${key}`);
          return cached.value;
        }
        // Clean up expired entries
        if (cached) {
          this.fallbackCache.delete(key);
        }
      }
      
      this.stats.misses++;
      logger.debug(`Cache miss for key: ${key}`);
      return null;
    } catch (error) {
      this.stats.errors++;
      logger.error('Cache get error:', error);
      return null;
    }
  }

  /**
   * Set a value in cache
   */
  async set(key: string, value: any, options: CacheOptions = {}): Promise<boolean> {
    const ttl = options.ttl || 3600; // Default 1 hour
    const prefixedKey = options.prefix ? `${options.prefix}:${key}` : key;

    try {
      if (this.redis && this.isConnected) {
        await this.redis.setex(prefixedKey, ttl, JSON.stringify(value));
        logger.debug(`Cached key: ${prefixedKey} for ${ttl}s`);
        return true;
      } else {
        // Fallback to in-memory cache
        this.fallbackCache.set(prefixedKey, {
          value,
          expiry: Date.now() + (ttl * 1000)
        });
        
        // Limit memory cache size
        if (this.fallbackCache.size > 1000) {
          const firstKey = this.fallbackCache.keys().next().value;
          this.fallbackCache.delete(firstKey);
        }
        
        logger.debug(`Memory cached key: ${prefixedKey} for ${ttl}s`);
        return true;
      }
    } catch (error) {
      this.stats.errors++;
      logger.error('Cache set error:', error);
      return false;
    }
  }

  /**
   * Delete a value from cache
   */
  async delete(key: string): Promise<boolean> {
    try {
      if (this.redis && this.isConnected) {
        await this.redis.del(key);
      }
      this.fallbackCache.delete(key);
      logger.debug(`Deleted cache key: ${key}`);
      return true;
    } catch (error) {
      logger.error('Cache delete error:', error);
      return false;
    }
  }

  /**
   * Clear all cache entries with a given prefix
   */
  async clearPrefix(prefix: string): Promise<number> {
    let deleted = 0;
    try {
      if (this.redis && this.isConnected) {
        const keys = await this.redis.keys(`${prefix}:*`);
        if (keys.length > 0) {
          deleted = await this.redis.del(...keys);
        }
      }
      
      // Also clear from memory cache
      for (const key of this.fallbackCache.keys()) {
        if (key.startsWith(`${prefix}:`)) {
          this.fallbackCache.delete(key);
          deleted++;
        }
      }
      
      logger.info(`Cleared ${deleted} cache entries with prefix: ${prefix}`);
      return deleted;
    } catch (error) {
      logger.error('Cache clear error:', error);
      return 0;
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses;
    const hitRate = total > 0 ? (this.stats.hits / total) * 100 : 0;
    
    return {
      ...this.stats,
      hitRate: Math.round(hitRate * 100) / 100
    };
  }

  /**
   * Reset cache statistics
   */
  resetStats(): void {
    this.stats = { hits: 0, misses: 0, errors: 0 };
  }

  /**
   * Check if cache is available
   */
  isAvailable(): boolean {
    return this.isConnected || this.fallbackCache.size >= 0;
  }

  /**
   * Wrapper for caching async functions
   */
  async withCache<T>(
    key: string,
    fn: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    // Try to get from cache first
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Execute function and cache result
    try {
      const result = await fn();
      await this.set(key, result, options);
      return result;
    } catch (error) {
      logger.error('Error in cached function:', error);
      throw error;
    }
  }

  /**
   * Cache decorator for class methods
   */
  cache(options: CacheOptions = {}) {
    return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
      const originalMethod = descriptor.value;

      descriptor.value = async function (...args: any[]) {
        const cacheKey = `${target.constructor.name}:${propertyKey}:${JSON.stringify(args)}`;
        const cache = CacheService.getInstance();
        
        return cache.withCache(
          cacheKey,
          () => originalMethod.apply(this, args),
          options
        );
      };

      return descriptor;
    };
  }
}

// Export singleton instance
export const cacheService = CacheService.getInstance();

// Export cache decorator
export const cache = (options?: CacheOptions) => cacheService.cache(options);

// Export types
export { CacheOptions, CacheStats };