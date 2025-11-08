/**
 * Request Correlation ID Management
 *
 * Provides unique correlation IDs for tracking requests through the system.
 * Uses AsyncLocalStorage for context propagation without passing IDs explicitly.
 */

import { AsyncLocalStorage } from 'async_hooks';
import { randomBytes } from 'crypto';
import { IncomingMessage } from 'http';

/**
 * Request context stored in async local storage
 */
export interface RequestContext {
  correlationId: string;
  requestId: string;
  startTime: number;
  method: string;
  path: string;
  clientIp?: string;
}

/**
 * Async local storage for request context
 */
const asyncLocalStorage = new AsyncLocalStorage<RequestContext>();

/**
 * Generate a unique correlation ID
 */
export function generateCorrelationId(): string {
  return randomBytes(16).toString('hex');
}

/**
 * Generate a shorter request ID
 */
export function generateRequestId(): string {
  return randomBytes(8).toString('hex');
}

/**
 * Extract correlation ID from request headers or generate new one
 */
export function extractCorrelationId(req: IncomingMessage): string {
  // Check for existing correlation ID in headers
  const headerValue = req.headers['x-correlation-id'] || req.headers['x-request-id'];

  if (typeof headerValue === 'string' && headerValue.length > 0) {
    return headerValue;
  }

  // Generate new correlation ID
  return generateCorrelationId();
}

/**
 * Extract client IP from request
 */
export function extractClientIp(req: IncomingMessage): string | undefined {
  // Check X-Forwarded-For header (common in cloud environments)
  const forwardedFor = req.headers['x-forwarded-for'];
  if (typeof forwardedFor === 'string') {
    return forwardedFor.split(',')[0].trim();
  }

  // Check X-Real-IP header
  const realIp = req.headers['x-real-ip'];
  if (typeof realIp === 'string') {
    return realIp;
  }

  // Use socket remote address
  return req.socket.remoteAddress;
}

/**
 * Create request context from HTTP request
 */
export function createRequestContext(req: IncomingMessage): RequestContext {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const clientIp = extractClientIp(req);

  const context: RequestContext = {
    correlationId: extractCorrelationId(req),
    requestId: generateRequestId(),
    startTime: Date.now(),
    method: req.method || 'UNKNOWN',
    path: url.pathname,
  };

  if (clientIp) {
    context.clientIp = clientIp;
  }

  return context;
}

/**
 * Run function with request context
 */
export function runWithContext<T>(context: RequestContext, fn: () => T): T {
  return asyncLocalStorage.run(context, fn);
}

/**
 * Get current request context
 */
export function getContext(): RequestContext | undefined {
  return asyncLocalStorage.getStore();
}

/**
 * Get current correlation ID
 */
export function getCorrelationId(): string | undefined {
  return getContext()?.correlationId;
}

/**
 * Get current request ID
 */
export function getRequestId(): string | undefined {
  return getContext()?.requestId;
}

/**
 * Get current request start time
 */
export function getRequestStartTime(): number | undefined {
  return getContext()?.startTime;
}

/**
 * Get current request duration in milliseconds
 */
export function getRequestDuration(): number | undefined {
  const startTime = getRequestStartTime();
  return startTime ? Date.now() - startTime : undefined;
}

/**
 * Get context for logging
 */
export function getLoggingContext(): {
  correlationId?: string;
  requestId?: string;
  duration?: number;
} {
  const context = getContext();
  if (!context) {
    return {};
  }

  return {
    correlationId: context.correlationId,
    requestId: context.requestId,
    duration: Date.now() - context.startTime,
  };
}
