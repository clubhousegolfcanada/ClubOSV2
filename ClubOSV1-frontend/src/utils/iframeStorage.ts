import logger from '@/services/logger';

/**
 * Storage utility that works in iframe contexts where localStorage might be blocked
 * Falls back to sessionStorage or memory storage if needed
 */

class IframeStorage {
  private memoryStorage: Map<string, string> = new Map();
  private isIframe: boolean = false;
  private storageAvailable: boolean = true;

  constructor() {
    if (typeof window !== 'undefined') {
      this.isIframe = window !== window.parent;
      this.testStorage();
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
        // Fall through to alternatives
      }
    }

    // Try sessionStorage as fallback
    try {
      sessionStorage.setItem(key, value);
    } catch (e) {
      // Use memory storage as last resort
      this.memoryStorage.set(key, value);
    }

    // If in iframe, also try posting to parent
    if (this.isIframe) {
      try {
        window.parent.postMessage({
          type: 'clubos-storage-set',
          key,
          value
        }, '*');
      } catch (e) {
        // Parent window not accessible
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
        // Fall through to alternatives
      }
    }

    // Try sessionStorage
    try {
      const value = sessionStorage.getItem(key);
      if (value !== null) return value;
    } catch (e) {
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
    } catch (e) {}
    
    try {
      sessionStorage.removeItem(key);
    } catch (e) {}
    
    this.memoryStorage.delete(key);

    // If in iframe, notify parent
    if (this.isIframe) {
      try {
        window.parent.postMessage({
          type: 'clubos-storage-remove',
          key
        }, '*');
      } catch (e) {}
    }
  }

  clear(): void {
    try {
      localStorage.clear();
    } catch (e) {}
    
    try {
      sessionStorage.clear();
    } catch (e) {}
    
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