import { logger } from './logger';

interface RateLimiterOptions {
  maxRequestsPerSecond: number;
  retryAttempts: number;
  initialRetryDelay: number;
}

class OpenPhoneRateLimiter {
  private queue: Array<() => Promise<any>> = [];
  private processing = false;
  private lastRequestTime = 0;
  private requestCount = 0;
  private resetTime = 0;
  
  private options: RateLimiterOptions = {
    maxRequestsPerSecond: 10, // OpenPhone limit
    retryAttempts: 3,
    initialRetryDelay: 1000 // 1 second
  };

  constructor(options?: Partial<RateLimiterOptions>) {
    this.options = { ...this.options, ...options };
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await this.executeWithRetry(fn);
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
      
      this.processQueue();
    });
  }

  private async executeWithRetry<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: any;
    
    for (let attempt = 0; attempt < this.options.retryAttempts; attempt++) {
      try {
        // Wait for rate limit if needed
        await this.waitForRateLimit();
        
        // Execute the function
        const result = await fn();
        
        // Increment request count
        this.incrementRequestCount();
        
        return result;
      } catch (error: any) {
        lastError = error;
        
        // Check if it's a rate limit error
        if (error.response?.status === 429) {
          const retryDelay = this.calculateRetryDelay(attempt);
          logger.warn(`OpenPhone rate limit hit, retrying in ${retryDelay}ms`, {
            attempt: attempt + 1,
            maxAttempts: this.options.retryAttempts
          });
          
          await this.delay(retryDelay);
          continue;
        }
        
        // For other errors, throw immediately
        throw error;
      }
    }
    
    // If we've exhausted all retries, throw the last error
    throw lastError;
  }

  private async waitForRateLimit(): Promise<void> {
    const now = Date.now();
    
    // Reset counter if we're in a new second
    if (now > this.resetTime) {
      this.requestCount = 0;
      this.resetTime = now + 1000; // Reset every second
    }
    
    // If we've hit the rate limit, wait until the next second
    if (this.requestCount >= this.options.maxRequestsPerSecond) {
      const waitTime = this.resetTime - now;
      if (waitTime > 0) {
        logger.debug(`Rate limit reached, waiting ${waitTime}ms`);
        await this.delay(waitTime);
        // After waiting, reset the counter
        this.requestCount = 0;
        this.resetTime = Date.now() + 1000;
      }
    }
  }

  private incrementRequestCount(): void {
    this.requestCount++;
    this.lastRequestTime = Date.now();
  }

  private calculateRetryDelay(attempt: number): number {
    // Exponential backoff: 1s, 2s, 4s, 8s...
    return this.options.initialRetryDelay * Math.pow(2, attempt);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async processQueue(): Promise<void> {
    if (this.processing || this.queue.length === 0) {
      return;
    }
    
    this.processing = true;
    
    while (this.queue.length > 0) {
      const task = this.queue.shift();
      if (task) {
        await task();
      }
    }
    
    this.processing = false;
  }
}

// Export singleton instance
export const openPhoneRateLimiter = new OpenPhoneRateLimiter();