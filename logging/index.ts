/**
 * Centralized Logging System
 *
 * Export all logging functionality
 */

export {
  LogLevel,
  Timer,
  logger,
  createLogger,
} from './logger';

export type {
  LogContext,
  LogEntry,
  LoggerConfig,
} from './logger';

export {
  generateCorrelationId,
  generateRequestId,
  extractCorrelationId,
  extractClientIp,
  createRequestContext,
  runWithContext,
  getContext,
  getCorrelationId,
  getRequestId,
  getRequestStartTime,
  getRequestDuration,
  getLoggingContext,
} from './correlation-id';

export type {
  RequestContext,
} from './correlation-id';
