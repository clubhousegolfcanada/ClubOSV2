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
      
      // Use Redis if we have a valid URL
      if (redisUrl) {
        logger.info(`Attempting to connect to Redis at: ${redisUrl.replace(/:[^:@]*@/, ':****@')}`); // Log URL with password hidden
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
          logger.info('✅ Redis cache connected successfully');
        });

        this.redis.on('error', (err) => {
          // Don't log connection errors repeatedly
          if (err.message && !err.message.includes('ENOTFOUND')) {
            logger.error('Redis cache error:', err.message);
          }
          this.isConnected = false;
        });

        this.redis.on('close', () => {
          this.isConnected = false;
          logger.warn('Redis connection closed');
        });
        
        this.redis.on('ready', () => {
          this.isConnected = true;
          logger.info('✅ Redis is ready to accept commands');
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
   * Get or set pattern - fetch from cache or compute and cache
   * Alias for withCache for compatibility
   */
  async getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    return this.withCache(key, fetcher, options);
  }

  /**
   * Invalidate cache entries matching a pattern
   */
  async invalidatePattern(pattern: string): Promise<number> {
    let deleted = 0;
    try {
      if (this.redis && this.isConnected) {
        const keys = await this.redis.keys(pattern);
        if (keys.length > 0) {
          deleted = await this.redis.del(...keys);
        }
      }

      // Also clear from memory cache
      for (const key of this.fallbackCache.keys()) {
        if (key.includes(pattern.replace('*', ''))) {
          this.fallbackCache.delete(key);
          deleted++;
        }
      }

      logger.info(`Invalidated ${deleted} cache entries matching pattern: ${pattern}`);
      return deleted;
    } catch (error) {
      logger.error('Cache invalidate pattern error:', error);
      return 0;
    }
  }

  /**
   * Confirmation-specific methods for AI automation
   * These handle pending confirmations with automatic expiry
   */

  /**
   * Store a pending confirmation with TTL
   */
  async setConfirmation(phoneNumber: string, confirmation: any, ttl: number = 300): Promise<boolean> {
    const key = `confirmation:${phoneNumber}:${Date.now()}`;
    const confirmationData = {
      ...confirmation,
      createdAt: Date.now(),
      expiresAt: Date.now() + (ttl * 1000)
    };

    const success = await this.set(key, confirmationData, { ttl });
    if (success) {
      logger.info(`Stored confirmation for phone ${phoneNumber.slice(-4)} with ${ttl}s TTL`);
    }
    return success;
  }

  /**
   * Get all pending confirmations for a phone number
   */
  async getConfirmations(phoneNumber: string): Promise<any[]> {
    const confirmations: any[] = [];
    const pattern = `confirmation:${phoneNumber}:*`;

    try {
      if (this.redis && this.isConnected) {
        const keys = await this.redis.keys(pattern);
        for (const key of keys) {
          const value = await this.redis.get(key);
          if (value) {
            const confirmation = JSON.parse(value);
            // Check if not expired
            if (confirmation.expiresAt > Date.now()) {
              confirmations.push({ key, ...confirmation });
            } else {
              // Clean up expired confirmation
              await this.redis.del(key);
            }
          }
        }
      } else {
        // Fallback to memory cache
        for (const [key, item] of this.fallbackCache.entries()) {
          if (key.startsWith(`confirmation:${phoneNumber}:`)) {
            if (item.expiry > Date.now()) {
              confirmations.push({ key, ...item.value });
            } else {
              this.fallbackCache.delete(key);
            }
          }
        }
      }

      logger.debug(`Found ${confirmations.length} pending confirmations for ${phoneNumber.slice(-4)}`);
      return confirmations;
    } catch (error) {
      logger.error('Error getting confirmations:', error);
      return [];
    }
  }

  /**
   * Delete a specific confirmation
   */
  async deleteConfirmation(key: string): Promise<boolean> {
    return await this.delete(key);
  }

  /**
   * Clear all confirmations for a phone number
   */
  async clearConfirmations(phoneNumber: string): Promise<number> {
    return await this.clearPrefix(`confirmation:${phoneNumber}`);
  }

  /**
   * Clean up all expired confirmations (maintenance task)
   */
  async cleanupExpiredConfirmations(): Promise<number> {
    let cleaned = 0;
    const pattern = 'confirmation:*';

    try {
      if (this.redis && this.isConnected) {
        const keys = await this.redis.keys(pattern);
        for (const key of keys) {
          const value = await this.redis.get(key);
          if (value) {
            const confirmation = JSON.parse(value);
            if (confirmation.expiresAt && confirmation.expiresAt < Date.now()) {
              await this.redis.del(key);
              cleaned++;
            }
          }
        }
      }

      // Also clean memory cache
      for (const [key, item] of this.fallbackCache.entries()) {
        if (key.startsWith('confirmation:') && item.expiry < Date.now()) {
          this.fallbackCache.delete(key);
          cleaned++;
        }
      }

      if (cleaned > 0) {
        logger.info(`Cleaned up ${cleaned} expired confirmations`);
      }
      return cleaned;
    } catch (error) {
      logger.error('Error cleaning up confirmations:', error);
      return 0;
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

// Common cache keys and TTLs
export const CACHE_KEYS = {
  // User-related
  USER_BY_ID: (id: string) => `user:${id}`,
  USER_BY_EMAIL: (email: string) => `user:email:${email}`,
  USER_PERMISSIONS: (id: string) => `user:${id}:permissions`,

  // Tickets
  TICKETS_LIST: (filters: string) => `tickets:list:${filters}`,
  TICKET_BY_ID: (id: string) => `ticket:${id}`,
  TICKET_STATS: 'tickets:stats',

  // Patterns (V3-PLS)
  PATTERNS_ACTIVE: 'patterns:active',
  PATTERN_BY_ID: (id: string) => `pattern:${id}`,
  PATTERN_MATCHES: (text: string) => `pattern:match:${Buffer.from(text).toString('base64')}`,

  // Knowledge base
  KNOWLEDGE_CATEGORIES: 'knowledge:categories',
  KNOWLEDGE_BY_ID: (id: string) => `knowledge:${id}`,
  KNOWLEDGE_SEARCH: (query: string) => `knowledge:search:${Buffer.from(query).toString('base64')}`,

  // Checklists
  CHECKLIST_TEMPLATES: 'checklist:templates',
  CHECKLIST_BY_LOCATION: (location: string) => `checklist:location:${location}`,

  // Messages/Conversations
  CONVERSATION_BY_PHONE: (phone: string) => `conversation:${phone}`,
  CONVERSATIONS_RECENT: 'conversations:recent',

  // System
  SYSTEM_CONFIG: (key: string) => `config:${key}`,
  SYSTEM_STATS: 'system:stats',
};

export const CACHE_TTL = {
  SHORT: 60,        // 1 minute - for frequently changing data
  MEDIUM: 300,      // 5 minutes - default
  LONG: 900,        // 15 minutes - for stable data
  HOUR: 3600,       // 1 hour - for rarely changing data
  DAY: 86400,       // 24 hours - for static data
};