/**
 * Logging utility for structured, environment-aware logging
 * Following Cloudflare Workers best practices
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export type LogLevelName = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

class Logger {
  private level: LogLevel;

  constructor() {
    // Default: WARN in production, DEBUG in development
    // Can be overridden via setLevel() after config is loaded
    this.level = process.env.NODE_ENV === 'production' ? LogLevel.WARN : LogLevel.DEBUG;
  }

  /**
   * Set log level dynamically (called after config loads LOG_LEVEL flag)
   */
  setLevel(levelName: LogLevelName): void {
    this.level = LogLevel[levelName];
  }

  private log(level: LogLevel, message: string, ...args: any[]) {
    if (level < this.level) {
      return;
    }

    const levelName = LogLevel[level];
    const timestamp = new Date().toISOString();

    // Structured logging for better observability
    const logEntry = {
      timestamp,
      level: levelName,
      message,
      ...(args.length > 0 && { data: args }),
    };

    // Use console methods for proper log level
    switch (level) {
      case LogLevel.DEBUG:
        console.debug(JSON.stringify(logEntry));
        break;
      case LogLevel.INFO:
        console.log(JSON.stringify(logEntry));
        break;
      case LogLevel.WARN:
        console.warn(JSON.stringify(logEntry));
        break;
      case LogLevel.ERROR:
        console.error(JSON.stringify(logEntry));
        break;
    }
  }

  debug(message: string, ...args: any[]) {
    this.log(LogLevel.DEBUG, message, ...args);
  }

  info(message: string, ...args: any[]) {
    this.log(LogLevel.INFO, message, ...args);
  }

  warn(message: string, ...args: any[]) {
    this.log(LogLevel.WARN, message, ...args);
  }

  error(message: string, ...args: any[]) {
    this.log(LogLevel.ERROR, message, ...args);
  }
}

// Export singleton instance
export const logger = new Logger();
