/**
 * Frontend Logging Service
 * 
 * Provides structured logging for the frontend application with:
 * - Different log levels (debug, info, warn, error)
 * - Environment-aware logging (no debug logs in production)
 * - Remote logging capability for errors
 * - Performance tracking
 * - User context
 */

import axios from 'axios';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: Date;
  data?: any;
  error?: Error;
  context?: {
    userId?: string;
    sessionId?: string;
    url?: string;
    userAgent?: string;
  };
}

class Logger {
  private logs: LogEntry[] = [];
  private maxLogs = 100;
  private isDevelopment = process.env.NODE_ENV === 'development';
  private remoteLoggingEnabled = false;
  private sessionId: string;

  constructor() {
    this.sessionId = this.generateSessionId();
    
    // Setup remote logging for production errors
    if (!this.isDevelopment) {
      this.remoteLoggingEnabled = true;
    }
    
    // Override console methods in production
    if (!this.isDevelopment) {
      this.overrideConsoleMethods();
    }
  }

  private generateSessionId(): string {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }

  private getUserContext() {
    const user = typeof window !== 'undefined' ? 
      JSON.parse(localStorage.getItem('clubos_user') || '{}') : {};
    
    return {
      userId: user.id,
      sessionId: this.sessionId,
      url: typeof window !== 'undefined' ? window.location.href : '',
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : ''
    };
  }

  private log(level: LogLevel, message: string, data?: any, error?: Error) {
    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date(),
      data,
      error,
      context: this.getUserContext()
    };

    // Store log entry
    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // Console output based on environment
    if (this.isDevelopment || level === 'error' || level === 'warn') {
      const style = this.getConsoleStyle(level);
      const prefix = `[${level.toUpperCase()}] ${new Date().toISOString()}`;
      
      if (error) {
        console.error(`%c${prefix} ${message}`, style, data || '', error);
      } else if (level === 'error') {
        console.error(`%c${prefix} ${message}`, style, data || '');
      } else if (level === 'warn') {
        console.warn(`%c${prefix} ${message}`, style, data || '');
      } else {
        console.log(`%c${prefix} ${message}`, style, data || '');
      }
    }

    // Send errors to remote logging
    if (this.remoteLoggingEnabled && level === 'error') {
      this.sendToRemote(entry);
    }
  }

  private getConsoleStyle(level: LogLevel): string {
    const styles = {
      debug: 'color: #gray',
      info: 'color: #0066cc',
      warn: 'color: #ff9800',
      error: 'color: #f44336; font-weight: bold'
    };
    return styles[level];
  }

  private async sendToRemote(entry: LogEntry) {
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      await axios.post(`${API_URL}/api/logs/frontend`, {
        ...entry,
        error: entry.error ? {
          message: entry.error.message,
          stack: entry.error.stack,
          name: entry.error.name
        } : undefined
      });
    } catch (err) {
      // Silently fail - we don't want logging to break the app
    }
  }

  private overrideConsoleMethods() {
    const originalLog = console.log;
    const originalWarn = console.warn;
    const originalError = console.error;

    console.log = (...args: any[]) => {
      this.info('Console log', args);
    };

    console.warn = (...args: any[]) => {
      this.warn('Console warning', args);
    };

    console.error = (...args: any[]) => {
      this.error('Console error', args);
    };

    // Restore originals for internal use
    this._console = {
      log: originalLog,
      warn: originalWarn,
      error: originalError
    };
  }

  private _console = {
    log: console.log,
    warn: console.warn,
    error: console.error
  };

  // Public logging methods
  debug(message: string, data?: any) {
    this.log('debug', message, data);
  }

  info(message: string, data?: any) {
    this.log('info', message, data);
  }

  warn(message: string, data?: any) {
    this.log('warn', message, data);
  }

  error(message: string, data?: any, error?: Error) {
    this.log('error', message, data, error);
  }

  // Performance tracking
  time(label: string) {
    if (this.isDevelopment) {
      console.time(label);
    }
  }

  timeEnd(label: string) {
    if (this.isDevelopment) {
      console.timeEnd(label);
    }
  }

  // Get recent logs
  getRecentLogs(count: number = 20): LogEntry[] {
    return this.logs.slice(-count);
  }

  // Clear logs
  clear() {
    this.logs = [];
  }

  // Export logs for debugging
  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }
}

// Create singleton instance
const logger = new Logger();

// Export for use throughout the app
export default logger;

// Also export as named exports for convenience
export const { debug, info, warn, error, time, timeEnd } = {
  debug: logger.debug.bind(logger),
  info: logger.info.bind(logger),
  warn: logger.warn.bind(logger),
  error: logger.error.bind(logger),
  time: logger.time.bind(logger),
  timeEnd: logger.timeEnd.bind(logger)
};