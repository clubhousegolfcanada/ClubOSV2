import logger from '@/services/logger';

/**
 * Storage utility that works in iframe contexts where localStorage might be blocked
 * Falls back to sessionStorage or memory storage if needed
 */

// Define allowed origins for postMessage (update with your production domain)
const ALLOWED_ORIGINS = [
  'https://club-osv-2-owqx.vercel.app',
  'https://clubhouse247golf.com',
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002'
];

class IframeStorage {
  private memoryStorage: Map<string, string> = new Map();
  private isIframe: boolean = false;
  private storageAvailable: boolean = true;
  private parentOrigin: string = '*';

  constructor() {
    if (typeof window !== 'undefined') {
      this.isIframe = window !== window.parent;
      this.testStorage();

      // Determine parent origin for secure postMessage
      if (this.isIframe && document.referrer) {
        try {
          const parentUrl = new URL(document.referrer);
          const parentOrigin = parentUrl.origin;

          // Only use specific origin if it's in our allowed list
          if (ALLOWED_ORIGINS.includes(parentOrigin)) {
            this.parentOrigin = parentOrigin;
          } else {
            // For unknown origins, don't send messages at all for security
            logger.warn('Iframe parent origin not in allowed list', { parentOrigin });
            this.parentOrigin = '';
          }
        } catch (e) {
          logger.warn('Could not determine parent origin', { error: e });
          this.parentOrigin = '';
        }
      }
    }
  }

  private testStorage(): void {
    try {
      const testKey = '__test__';
      localStorage.setItem(testKey, 'test');
      localStorage.removeItem(testKey);
      this.storageAvailable = true;
    } catch (e) {
      logger.warn('localStorage not available, using fallback storage');
      this.storageAvailable = false;
    }
  }

  setItem(key: string, value: string): void {
    // Try localStorage first
    if (this.storageAvailable) {
      try {
        localStorage.setItem(key, value);
        return;
      } catch (e) {
        logger.debug('localStorage.setItem failed, falling back to alternatives', { key, error: e });
        // Fall through to alternatives
      }
    }

    // Try sessionStorage as fallback
    try {
      sessionStorage.setItem(key, value);
    } catch (e) {
      logger.debug('sessionStorage.setItem failed, using memory storage', { key, error: e });
      // Use memory storage as last resort
      this.memoryStorage.set(key, value);
    }

    // If in iframe, also try posting to parent
    if (this.isIframe && this.parentOrigin) {
      try {
        window.parent.postMessage({
          type: 'clubos-storage-set',
          key,
          value
        }, this.parentOrigin);
      } catch (e) {
        logger.debug('postMessage to parent failed - parent window not accessible', { error: e });
      }
    }
  }

  getItem(key: string): string | null {
    // Try localStorage first
    if (this.storageAvailable) {
      try {
        const value = localStorage.getItem(key);
        if (value !== null) return value;
      } catch (e) {
        logger.debug('localStorage.getItem failed, falling back to alternatives', { key, error: e });
        // Fall through to alternatives
      }
    }

    // Try sessionStorage
    try {
      const value = sessionStorage.getItem(key);
      if (value !== null) return value;
    } catch (e) {
      logger.debug('sessionStorage.getItem failed', { key, error: e });
      // Fall through
    }

    // Check memory storage
    const memValue = this.memoryStorage.get(key);
    if (memValue !== undefined) return memValue;

    return null;
  }

  removeItem(key: string): void {
    // Remove from all storages
    try {
      localStorage.removeItem(key);
    } catch (e) {
      logger.debug('localStorage.removeItem failed', { key, error: e });
    }

    try {
      sessionStorage.removeItem(key);
    } catch (e) {
      logger.debug('sessionStorage.removeItem failed', { key, error: e });
    }

    this.memoryStorage.delete(key);

    // If in iframe, notify parent
    if (this.isIframe && this.parentOrigin) {
      try {
        window.parent.postMessage({
          type: 'clubos-storage-remove',
          key
        }, this.parentOrigin);
      } catch (e) {
        logger.debug('postMessage to parent for removal failed', { key, error: e });
      }
    }
  }

  clear(): void {
    try {
      localStorage.clear();
    } catch (e) {
      logger.debug('localStorage.clear failed', { error: e });
    }

    try {
      sessionStorage.clear();
    } catch (e) {
      logger.debug('sessionStorage.clear failed', { error: e });
    }

    this.memoryStorage.clear();
  }
}

export const iframeStorage = new IframeStorage();

// Helper functions that match localStorage API
export const getStorageItem = (key: string): string | null => {
  return iframeStorage.getItem(key);
};

export const setStorageItem = (key: string, value: string): void => {
  iframeStorage.setItem(key, value);
};

export const removeStorageItem = (key: string): void => {
  iframeStorage.removeItem(key);
};

export const clearStorage = (): void => {
  iframeStorage.clear();
};