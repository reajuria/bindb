/**
 * Centralized Logging System
 *
 * Export all logging functionality
 */

export { LogLevel, Timer, createLogger, logger } from './logger';

export type { LogContext, LogEntry, LoggerConfig } from './logger';

export {
  createRequestContext,
  extractClientIp,
  extractCorrelationId,
  generateCorrelationId,
  generateRequestId,
  getContext,
  getCorrelationId,
  getLoggingContext,
  getRequestDuration,
  getRequestId,
  getRequestStartTime,
  runWithContext,
} from './correlation-id';

export type { RequestContext } from './correlation-id';
