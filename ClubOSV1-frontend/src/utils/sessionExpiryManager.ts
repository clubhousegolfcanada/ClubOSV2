/**
 * Singleton manager to handle session expiry notifications
 * Ensures only one notification is shown regardless of how many 401s occur
 */
class SessionExpiryManager {
  private static instance: SessionExpiryManager;
  private hasShownNotification: boolean = false;
  private isHandlingExpiry: boolean = false;
  private notificationTimeout: NodeJS.Timeout | null = null;
  
  private constructor() {}
  
  static getInstance(): SessionExpiryManager {
    if (!SessionExpiryManager.instance) {
      SessionExpiryManager.instance = new SessionExpiryManager();
    }
    return SessionExpiryManager.instance;
  }
  
  /**
   * Check if we should show expiry notification
   */
  shouldShowNotification(): boolean {
    // Don't show if already shown or currently handling
    if (this.hasShownNotification || this.isHandlingExpiry) {
      return false;
    }
    
    // Don't show on login page
    if (typeof window !== 'undefined' && window.location.pathname === '/login') {
      return false;
    }
    
    return true;
  }
  
  /**
   * Mark that notification has been shown
   */
  markNotificationShown(): void {
    this.hasShownNotification = true;
    this.isHandlingExpiry = true;
    
    // Reset after 10 seconds to allow for future expiry if user logs in again
    if (this.notificationTimeout) {
      clearTimeout(this.notificationTimeout);
    }
    
    this.notificationTimeout = setTimeout(() => {
      this.reset();
    }, 10000);
  }
  
  /**
   * Reset the manager state (called after successful login)
   */
  reset(): void {
    this.hasShownNotification = false;
    this.isHandlingExpiry = false;
    
    if (this.notificationTimeout) {
      clearTimeout(this.notificationTimeout);
      this.notificationTimeout = null;
    }
  }
  
  /**
   * Check if currently handling expiry
   */
  isHandling(): boolean {
    return this.isHandlingExpiry;
  }
}

export const sessionExpiryManager = SessionExpiryManager.getInstance();