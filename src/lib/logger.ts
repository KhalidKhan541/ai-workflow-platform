/**
 * Logger Module
 * 
 * Centralized logging utility for the application.
 * Provides structured logging with different levels and contexts.
 * 
 * @module lib/logger
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: Date;
  context?: string;
  metadata?: Record<string, unknown>;
  error?: Error;
}

export interface LoggerConfig {
  level: LogLevel;
  format: 'json' | 'text';
  enableConsole: boolean;
  enableFile: boolean;
  filePath?: string;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/**
 * Simple logger implementation.
 * In production, replace with a proper logging library like Winston or Pino.
 */
class Logger {
  private config: LoggerConfig;
  private context?: string;

  constructor(config: Partial<LoggerConfig> = {}, context?: string) {
    this.config = {
      level: 'info',
      format: 'json',
      enableConsole: true,
      enableFile: false,
      ...config,
    };
    this.context = context;
  }

  /**
   * Create a child logger with context.
   */
  child(context: string): Logger {
    return new Logger(this.config, context);
  }

  /**
   * Log a debug message.
   */
  debug(message: string, metadata?: Record<string, unknown>): void {
    this.log('debug', message, metadata);
  }

  /**
   * Log an info message.
   */
  info(message: string, metadata?: Record<string, unknown>): void {
    this.log('info', message, metadata);
  }

  /**
   * Log a warning message.
   */
  warn(message: string, metadata?: Record<string, unknown>): void {
    this.log('warn', message, metadata);
  }

  /**
   * Log an error message.
   */
  error(message: string, metadata?: Record<string, unknown>): void {
    this.log('error', message, metadata);
  }

  private log(level: LogLevel, message: string, metadata?: Record<string, unknown>): void {
    if (LOG_LEVELS[level] < LOG_LEVELS[this.config.level]) {
      return;
    }

    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date(),
      context: this.context,
      metadata,
    };

    if (this.config.enableConsole) {
      this.outputToConsole(entry);
    }
  }

  private outputToConsole(entry: LogEntry): void {
    const timestamp = entry.timestamp.toISOString();
    const context = entry.context ? `[${entry.context}]` : '';
    const prefix = `${timestamp} ${entry.level.toUpperCase()} ${context}`;

    switch (entry.level) {
      case 'debug':
        console.debug(prefix, entry.message, entry.metadata || '');
        break;
      case 'info':
        console.info(prefix, entry.message, entry.metadata || '');
        break;
      case 'warn':
        console.warn(prefix, entry.message, entry.metadata || '');
        break;
      case 'error':
        console.error(prefix, entry.message, entry.metadata || '');
        break;
    }
  }
}

/**
 * Default logger instance.
 */
export const logger = new Logger({
  level: (process.env.LOG_LEVEL as LogLevel) || 'info',
  format: 'json',
  enableConsole: true,
});

/**
 * Create a logger with context.
 */
export function createLogger(context: string): Logger {
  return logger.child(context);
}

export default logger;
