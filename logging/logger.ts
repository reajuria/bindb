/**
 * Centralized Logging System for BinDB
 *
 * Provides structured logging with:
 * - Multiple log levels (DEBUG, INFO, WARN, ERROR)
 * - JSON-formatted output for cloud environments
 * - Request correlation tracking
 * - Performance timing
 * - Context propagation
 * - Environment-aware configuration
 */

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  [LogLevel.DEBUG]: 0,
  [LogLevel.INFO]: 1,
  [LogLevel.WARN]: 2,
  [LogLevel.ERROR]: 3,
};

export interface LogContext {
  correlationId?: string;
  requestId?: string;
  userId?: string;
  operation?: string;
  tableName?: string;
  duration?: number;
  [key: string]: unknown;
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
    code?: string;
    metadata?: Record<string, unknown>;
  };
  performance?: {
    duration: number;
    unit: string;
  };
}

export interface LoggerConfig {
  minLevel: LogLevel;
  prettyPrint: boolean;
  includeStackTrace: boolean;
  maxMessageLength?: number;
}

class Logger {
  private config: LoggerConfig;
  private context: LogContext;

  constructor(config?: Partial<LoggerConfig>, context?: LogContext) {
    const nodeEnv = process.env.NODE_ENV || 'development';
    const isProduction = nodeEnv === 'production';

    this.config = {
      minLevel: this.parseLogLevel(process.env.LOG_LEVEL) || (isProduction ? LogLevel.INFO : LogLevel.DEBUG),
      prettyPrint: !isProduction,
      includeStackTrace: !isProduction,
      maxMessageLength: 10000,
      ...config,
    };

    this.context = context || {};
  }

  /**
   * Parse log level from string
   */
  private parseLogLevel(level?: string): LogLevel | undefined {
    if (!level) return undefined;
    const upper = level.toUpperCase();
    return Object.values(LogLevel).includes(upper as LogLevel) ? (upper as LogLevel) : undefined;
  }

  /**
   * Check if a log level should be logged based on configuration
   */
  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[this.config.minLevel];
  }

  /**
   * Create a child logger with additional context
   */
  child(context: LogContext): Logger {
    return new Logger(this.config, { ...this.context, ...context });
  }

  /**
   * Format and write log entry
   */
  private log(level: LogLevel, message: string, context?: LogContext, error?: Error): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message: this.truncateMessage(message),
      context: { ...this.context, ...context },
    };

    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        code: (error as any).code,
        metadata: (error as any).metadata,
      };

      if (this.config.includeStackTrace && error.stack) {
        entry.error.stack = error.stack;
      }
    }

    this.write(entry);
  }

  /**
   * Truncate message if too long
   */
  private truncateMessage(message: string): string {
    if (this.config.maxMessageLength && message.length > this.config.maxMessageLength) {
      return message.substring(0, this.config.maxMessageLength) + '... (truncated)';
    }
    return message;
  }

  /**
   * Write log entry to output
   */
  private write(entry: LogEntry): void {
    const output = this.config.prettyPrint ? this.prettyFormat(entry) : JSON.stringify(entry);

    // Use appropriate console method based on level
    switch (entry.level) {
      case LogLevel.ERROR:
        console.error(output);
        break;
      case LogLevel.WARN:
        console.warn(output);
        break;
      default:
        console.log(output);
    }
  }

  /**
   * Format log entry for human readability
   */
  private prettyFormat(entry: LogEntry): string {
    const parts: string[] = [
      `[${entry.timestamp}]`,
      `[${entry.level}]`,
    ];

    if (entry.context?.correlationId) {
      parts.push(`[${entry.context.correlationId}]`);
    }

    parts.push(entry.message);

    if (entry.context && Object.keys(entry.context).length > 0) {
      const contextCopy = { ...entry.context };
      delete contextCopy.correlationId; // Already displayed
      if (Object.keys(contextCopy).length > 0) {
        parts.push(JSON.stringify(contextCopy));
      }
    }

    if (entry.error) {
      parts.push(`\nError: ${entry.error.name}: ${entry.error.message}`);
      if (entry.error.stack) {
        parts.push(`\n${entry.error.stack}`);
      }
    }

    if (entry.performance) {
      parts.push(`(${entry.performance.duration}${entry.performance.unit})`);
    }

    return parts.join(' ');
  }

  /**
   * Log debug message
   */
  debug(message: string, context?: LogContext): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  /**
   * Log info message
   */
  info(message: string, context?: LogContext): void {
    this.log(LogLevel.INFO, message, context);
  }

  /**
   * Log warning message
   */
  warn(message: string, context?: LogContext, error?: Error): void {
    this.log(LogLevel.WARN, message, context, error);
  }

  /**
   * Log error message
   */
  error(message: string, context?: LogContext, error?: Error): void {
    this.log(LogLevel.ERROR, message, context, error);
  }

  /**
   * Log with performance timing
   */
  performance(message: string, duration: number, context?: LogContext): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: LogLevel.INFO,
      message: this.truncateMessage(message),
      context: { ...this.context, ...context, duration },
      performance: {
        duration,
        unit: 'ms',
      },
    };

    if (this.shouldLog(LogLevel.INFO)) {
      this.write(entry);
    }
  }

  /**
   * Create a timer for measuring operation duration
   */
  timer(operation: string): Timer {
    return new Timer(this, operation);
  }

  /**
   * Log HTTP request
   */
  logRequest(method: string, path: string, context?: LogContext): void {
    this.info(`${method} ${path}`, { ...context, requestMethod: method, requestPath: path });
  }

  /**
   * Log HTTP response
   */
  logResponse(method: string, path: string, statusCode: number, duration: number, context?: LogContext): void {
    const level = statusCode >= 500 ? LogLevel.ERROR : statusCode >= 400 ? LogLevel.WARN : LogLevel.INFO;
    const message = `${method} ${path} ${statusCode}`;

    const logContext = {
      ...context,
      requestMethod: method,
      requestPath: path,
      statusCode,
      duration,
    };

    if (level === LogLevel.ERROR || level === LogLevel.WARN) {
      this.log(level, message, logContext);
    } else {
      this.performance(message, duration, logContext);
    }
  }

  /**
   * Log database operation
   */
  logDatabaseOperation(operation: string, tableName: string, context?: LogContext): void {
    this.debug(`Database operation: ${operation}`, { ...context, operation, tableName });
  }

  /**
   * Log error with full context
   */
  logError(message: string, error: Error, context?: LogContext): void {
    this.error(message, context, error);
  }
}

/**
 * Timer for measuring operation duration
 */
export class Timer {
  private startTime: number;
  private logger: Logger;
  private operation: string;

  constructor(logger: Logger, operation: string) {
    this.logger = logger;
    this.operation = operation;
    this.startTime = Date.now();
  }

  /**
   * End timer and log performance
   */
  end(context?: LogContext): number {
    const duration = Date.now() - this.startTime;
    this.logger.performance(`${this.operation} completed`, duration, context);
    return duration;
  }

  /**
   * End timer with custom message
   */
  endWithMessage(message: string, context?: LogContext): number {
    const duration = Date.now() - this.startTime;
    this.logger.performance(message, duration, context);
    return duration;
  }

  /**
   * Get elapsed time without logging
   */
  elapsed(): number {
    return Date.now() - this.startTime;
  }
}

/**
 * Global logger instance
 */
export const logger = new Logger();

/**
 * Create a child logger with context
 */
export function createLogger(context?: LogContext, config?: Partial<LoggerConfig>): Logger {
  return new Logger(config, context);
}
