/**
 * Frontend Logger Utility
 *
 * This logger ensures that sensitive data is never exposed in production.
 * In development, it provides full logging for debugging.
 * In production, it sanitizes or blocks logs to prevent data leakage.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LoggerConfig {
  enableInProduction: boolean;
  sanitizeData: boolean;
  logToService: boolean; // Future: send to error tracking service
}

class Logger {
  private isDevelopment: boolean;
  private config: LoggerConfig;

  constructor(config?: Partial<LoggerConfig>) {
    this.isDevelopment = process.env.NODE_ENV === 'development';
    this.config = {
      enableInProduction: false,
      sanitizeData: true,
      logToService: false,
      ...config
    };
  }

  /**
   * Sanitize sensitive data from objects
   */
  private sanitize(data: any): any {
    if (!this.config.sanitizeData) return data;

    if (typeof data !== 'object' || data === null) return data;

    const sensitiveKeys = [
      'password', 'token', 'email', 'phone', 'phoneNumber',
      'startTime', 'endTime', 'price', 'totalPrice', 'customerTier',
      'spaceId', 'spaceName', 'bayNumber', 'conversationId'
    ];

    const sanitized = Array.isArray(data) ? [...data] : { ...data };

    for (const key in sanitized) {
      if (sensitiveKeys.some(k => key.toLowerCase().includes(k.toLowerCase()))) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof sanitized[key] === 'object') {
        sanitized[key] = this.sanitize(sanitized[key]);
      }
    }

    return sanitized;
  }

  /**
   * Format the log message with timestamp
   */
  private formatMessage(level: LogLevel, message: string): string {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${level.toUpperCase()}] ${message}`;
  }

  /**
   * Core logging method
   */
  private log(level: LogLevel, message: string, data?: any): void {
    // In production, only log errors unless explicitly enabled
    if (!this.isDevelopment && !this.config.enableInProduction) {
      if (level !== 'error') return;
    }

    const formattedMessage = this.formatMessage(level, message);
    const sanitizedData = this.isDevelopment ? data : this.sanitize(data);

    switch (level) {
      case 'debug':
        if (this.isDevelopment) {
          console.log(formattedMessage, sanitizedData || '');
        }
        break;
      case 'info':
        if (this.isDevelopment) {
          console.info(formattedMessage, sanitizedData || '');
        }
        break;
      case 'warn':
        console.warn(formattedMessage, sanitizedData || '');
        break;
      case 'error':
        console.error(formattedMessage, sanitizedData || '');
        // In production, send to error tracking service
        if (!this.isDevelopment && this.config.logToService) {
          this.sendToErrorService(message, sanitizedData);
        }
        break;
    }
  }

  /**
   * Send errors to tracking service (Sentry, etc.)
   */
  private sendToErrorService(message: string, data?: any): void {
    // Future implementation: Send to Sentry or similar service
    // For now, this is a placeholder
    try {
      if (typeof window !== 'undefined' && (window as any).Sentry) {
        (window as any).Sentry.captureMessage(message, {
          level: 'error',
          extra: data
        });
      }
    } catch (error) {
      // Silently fail if error tracking is not configured
    }
  }

  /**
   * Public logging methods
   */
  debug(message: string, data?: any): void {
    this.log('debug', message, data);
  }

  info(message: string, data?: any): void {
    this.log('info', message, data);
  }

  warn(message: string, data?: any): void {
    this.log('warn', message, data);
  }

  error(message: string, error?: any): void {
    this.log('error', message, error);
  }

  /**
   * Group logging for better organization in dev tools
   */
  group(label: string): void {
    if (this.isDevelopment && console.group) {
      console.group(label);
    }
  }

  groupEnd(): void {
    if (this.isDevelopment && console.groupEnd) {
      console.groupEnd();
    }
  }

  /**
   * Table logging for structured data
   */
  table(data: any): void {
    if (this.isDevelopment && console.table) {
      console.table(this.sanitize(data));
    }
  }

  /**
   * Performance timing
   */
  time(label: string): void {
    if (this.isDevelopment && console.time) {
      console.time(label);
    }
  }

  timeEnd(label: string): void {
    if (this.isDevelopment && console.timeEnd) {
      console.timeEnd(label);
    }
  }
}

// Export singleton instance for consistent logging across the app
const logger = new Logger();

// Export the class for custom configurations if needed
export { Logger, LoggerConfig };

// Export the singleton as default
export default logger;