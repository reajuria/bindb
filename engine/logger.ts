/**
 * Unified logging system for BinDB
 * Provides structured, contextual logging with configurable output formats
 */

/**
 * Log levels in order of severity
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  SILENT = 4,
}

/**
 * Log entry structure for JSON output
 */
export interface LogEntry {
  timestamp: string;
  level: string;
  context: string;
  message: string;
  metadata?: Record<string, any>;
  error?: {
    message: string;
    stack?: string;
    code?: string;
  };
}

/**
 * Logger configuration options
 */
export interface LoggerConfig {
  minLevel?: LogLevel;
  format?: 'json' | 'text';
  includeTimestamp?: boolean;
  includeContext?: boolean;
}

/**
 * Logger class for structured, contextual logging
 */
export class Logger {
  private context: string;
  private minLevel: LogLevel;
  private format: 'json' | 'text';
  private includeTimestamp: boolean;
  private includeContext: boolean;

  constructor(context: string, config: LoggerConfig = {}) {
    this.context = context;
    this.minLevel = config.minLevel ?? this.getDefaultLogLevel();
    this.format = config.format ?? this.getDefaultFormat();
    this.includeTimestamp = config.includeTimestamp ?? true;
    this.includeContext = config.includeContext ?? true;
  }

  /**
   * Get default log level from environment
   */
  private getDefaultLogLevel(): LogLevel {
    const envLevel = process.env.LOG_LEVEL?.toUpperCase();
    switch (envLevel) {
      case 'DEBUG':
        return LogLevel.DEBUG;
      case 'INFO':
        return LogLevel.INFO;
      case 'WARN':
        return LogLevel.WARN;
      case 'ERROR':
        return LogLevel.ERROR;
      case 'SILENT':
        return LogLevel.SILENT;
      default:
        return process.env.NODE_ENV === 'production'
          ? LogLevel.INFO
          : LogLevel.DEBUG;
    }
  }

  /**
   * Get default format from environment
   */
  private getDefaultFormat(): 'json' | 'text' {
    const envFormat = process.env.LOG_FORMAT?.toLowerCase();
    if (envFormat === 'json' || envFormat === 'text') {
      return envFormat;
    }
    return process.env.NODE_ENV === 'production' ? 'json' : 'text';
  }

  /**
   * Log a debug message
   */
  debug(message: string, metadata?: Record<string, any>): void {
    this.log(LogLevel.DEBUG, message, metadata);
  }

  /**
   * Log an info message
   */
  info(message: string, metadata?: Record<string, any>): void {
    this.log(LogLevel.INFO, message, metadata);
  }

  /**
   * Log a warning message
   */
  warn(message: string, metadata?: Record<string, any>): void {
    this.log(LogLevel.WARN, message, metadata);
  }

  /**
   * Log an error message
   */
  error(
    message: string,
    error?: Error | unknown,
    metadata?: Record<string, any>
  ): void {
    const errorMetadata = this.extractErrorMetadata(error);
    this.log(LogLevel.ERROR, message, {
      ...metadata,
      ...errorMetadata,
    });
  }

  /**
   * Extract metadata from error object
   */
  private extractErrorMetadata(
    error?: Error | unknown
  ): { error?: { message: string; stack?: string; code?: string } } {
    if (!error) {
      return {};
    }

    if (error instanceof Error) {
      const errorObj: { message: string; stack?: string; code?: string } = {
        message: error.message,
      };

      if (error.stack) {
        errorObj.stack = error.stack;
      }

      if ('code' in error && error.code) {
        errorObj.code = String(error.code);
      }

      return { error: errorObj };
    }

    return {
      error: {
        message: String(error),
      },
    };
  }

  /**
   * Core logging method
   */
  private log(
    level: LogLevel,
    message: string,
    metadata?: Record<string, any>
  ): void {
    if (level < this.minLevel) {
      return;
    }

    if (this.format === 'json') {
      this.logJson(level, message, metadata);
    } else {
      this.logText(level, message, metadata);
    }
  }

  /**
   * Log in JSON format (for production)
   */
  private logJson(
    level: LogLevel,
    message: string,
    metadata?: Record<string, any>
  ): void {
    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: LogLevel[level],
      context: this.context,
      message,
    };

    if (metadata && Object.keys(metadata).length > 0) {
      // Separate error from other metadata
      if (metadata.error) {
        logEntry.error = metadata.error;
        const { error, ...rest } = metadata;
        if (Object.keys(rest).length > 0) {
          logEntry.metadata = rest;
        }
      } else {
        logEntry.metadata = metadata;
      }
    }

    const output = JSON.stringify(logEntry);
    this.write(level, output);
  }

  /**
   * Log in text format (for development)
   */
  private logText(
    level: LogLevel,
    message: string,
    metadata?: Record<string, any>
  ): void {
    const parts: string[] = [];

    if (this.includeTimestamp) {
      parts.push(`[${new Date().toISOString()}]`);
    }

    parts.push(`[${LogLevel[level]}]`);

    if (this.includeContext) {
      parts.push(`[${this.context}]`);
    }

    parts.push(message);

    if (metadata && Object.keys(metadata).length > 0) {
      if (metadata.error && metadata.error.stack) {
        // Pretty print error with stack
        parts.push(`\n  Error: ${metadata.error.message}`);
        if (metadata.error.code) {
          parts.push(`\n  Code: ${metadata.error.code}`);
        }
        if (metadata.error.stack) {
          parts.push(`\n  Stack:\n    ${metadata.error.stack.replace(/\n/g, '\n    ')}`);
        }
        const { error, ...rest } = metadata;
        if (Object.keys(rest).length > 0) {
          parts.push(`\n  Metadata: ${JSON.stringify(rest, null, 2)}`);
        }
      } else {
        parts.push(JSON.stringify(metadata));
      }
    }

    const output = parts.join(' ');
    this.write(level, output);
  }

  /**
   * Write to appropriate output stream
   */
  private write(level: LogLevel, output: string): void {
    if (level >= LogLevel.ERROR) {
      console.error(output);
    } else {
      console.log(output);
    }
  }

  /**
   * Create a child logger with additional context
   */
  child(childContext: string): Logger {
    return new Logger(`${this.context}:${childContext}`, {
      minLevel: this.minLevel,
      format: this.format,
      includeTimestamp: this.includeTimestamp,
      includeContext: this.includeContext,
    });
  }

  /**
   * Update logger configuration
   */
  configure(config: LoggerConfig): void {
    if (config.minLevel !== undefined) {
      this.minLevel = config.minLevel;
    }
    if (config.format !== undefined) {
      this.format = config.format;
    }
    if (config.includeTimestamp !== undefined) {
      this.includeTimestamp = config.includeTimestamp;
    }
    if (config.includeContext !== undefined) {
      this.includeContext = config.includeContext;
    }
  }

  /**
   * Get current log level
   */
  getLevel(): LogLevel {
    return this.minLevel;
  }

  /**
   * Set log level
   */
  setLevel(level: LogLevel): void {
    this.minLevel = level;
  }

  /**
   * Check if a log level is enabled
   */
  isLevelEnabled(level: LogLevel): boolean {
    return level >= this.minLevel;
  }
}

/**
 * Create a logger instance
 */
export function createLogger(
  context: string,
  config?: LoggerConfig
): Logger {
  return new Logger(context, config);
}

/**
 * Default logger instance for the application
 */
export const defaultLogger = createLogger('bindb');
