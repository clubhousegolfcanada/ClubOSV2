// Simple in-memory cache for development
// Replace with Redis in production

interface CacheItem {
  value: any;
  expiry: number;
}

class SimpleCache {
  private cache: Map<string, CacheItem> = new Map();
  
  set(key: string, value: any, ttlSeconds: number = 3600): void {
    const expiry = Date.now() + (ttlSeconds * 1000);
    this.cache.set(key, { value, expiry });
  }
  
  get(key: string): any | null {
    const item = this.cache.get(key);
    if (!item) return null;
    
    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }
    
    return item.value;
  }
  
  delete(key: string): void {
    this.cache.delete(key);
  }
  
  clear(): void {
    this.cache.clear();
  }
  
  // Clean expired entries periodically
  startCleanup(intervalMs: number = 60000): void {
    setInterval(() => {
      const now = Date.now();
      for (const [key, item] of this.cache.entries()) {
        if (now > item.expiry) {
          this.cache.delete(key);
        }
      }
    }, intervalMs);
  }
}

export const cache = new SimpleCache();
cache.startCleanup();

// Helper for caching AI responses
export function getCacheKey(type: string, data: any): string {
  const str = JSON.stringify(data);
  const hash = require('crypto').createHash('md5').update(str).digest('hex');
  return `${type}:${hash}`;
}
