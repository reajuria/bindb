import type { CORSConfig, HttpResponse } from './types.js';
import type { IncomingHttpHeaders } from 'node:http';

/**
 * CORSHandler - Handles Cross-Origin Resource Sharing (CORS) logic
 */
export class CORSHandler {
  private config: Required<CORSConfig>;

  constructor(options: CORSConfig = {}) {
    this.config = {
      origin: options.origin || '*',
      methods: options.methods || ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
      allowedHeaders: options.allowedHeaders || [
        'Content-Type',
        'Authorization',
      ],
      exposedHeaders: options.exposedHeaders || [],
      credentials: options.credentials || false,
      maxAge: options.maxAge || 86400, // 24 hours
    };
  }

  /**
   * Check if request is a CORS preflight request
   */
  isPreflightRequest(method: string, headers: IncomingHttpHeaders): boolean {
    return (
      method === 'OPTIONS' &&
      !!(
        headers['access-control-request-method'] ||
        headers['Access-Control-Request-Method']
      )
    );
  }

  /**
   * Get origin from request headers
   */
  getOrigin(headers: IncomingHttpHeaders): string {
    return (headers['origin'] ||
      headers['Origin'] ||
      headers['sec-fetch-site'] ||
      '*') as string;
  }

  /**
   * Check if origin is allowed
   */
  isOriginAllowed(origin: string): boolean {
    if (this.config.origin === '*' || this.config.origin === true) {
      return true;
    }

    if (Array.isArray(this.config.origin)) {
      return this.config.origin.includes(origin);
    }

    if (typeof this.config.origin === 'string') {
      return this.config.origin === origin;
    }

    return false;
  }

  /**
   * Create preflight response
   */
  createPreflightResponse(
    origin?: string,
    _headers: IncomingHttpHeaders = {}
  ): HttpResponse {
    const responseHeaders: Record<string, string> = {};

    // Set allowed origin
    if (origin && this.isOriginAllowed(origin)) {
      responseHeaders['Access-Control-Allow-Origin'] = origin;
    } else if (this.config.origin === '*') {
      responseHeaders['Access-Control-Allow-Origin'] = '*';
    }

    // Set allowed methods
    const methods = Array.isArray(this.config.methods)
      ? this.config.methods.join(', ')
      : this.config.methods;
    responseHeaders['Access-Control-Allow-Methods'] = methods;

    // Set allowed headers
    const allowedHeaders = Array.isArray(this.config.allowedHeaders)
      ? this.config.allowedHeaders.join(', ')
      : this.config.allowedHeaders;
    responseHeaders['Access-Control-Allow-Headers'] = allowedHeaders;

    // Set max age
    responseHeaders['Access-Control-Max-Age'] = this.config.maxAge.toString();

    // Set credentials
    if (this.config.credentials) {
      responseHeaders['Access-Control-Allow-Credentials'] = 'true';
    }

    return {
      statusCode: 204,
      headers: responseHeaders,
      body: undefined,
    };
  }

  /**
   * Add CORS headers to response
   */
  addCORSHeaders(response: HttpResponse, origin?: string): HttpResponse {
    const headers = { ...response.headers };

    // Set allowed origin
    if (origin && this.isOriginAllowed(origin)) {
      headers['Access-Control-Allow-Origin'] = origin;
    } else if (this.config.origin === '*') {
      headers['Access-Control-Allow-Origin'] = '*';
    }

    // Set exposed headers
    if (this.config.exposedHeaders && this.config.exposedHeaders.length > 0) {
      const exposedHeaders = Array.isArray(this.config.exposedHeaders)
        ? this.config.exposedHeaders.join(', ')
        : this.config.exposedHeaders;
      headers['Access-Control-Expose-Headers'] = exposedHeaders;
    }

    // Set credentials
    if (this.config.credentials) {
      headers['Access-Control-Allow-Credentials'] = 'true';
    }

    return {
      ...response,
      headers,
    };
  }

  /**
   * Update CORS configuration
   */
  updateConfig(newConfig: CORSConfig): void {
    this.config = {
      ...this.config,
      ...newConfig,
    };
  }

  /**
   * Get current CORS configuration
   */
  getConfig(): CORSConfig {
    return { ...this.config };
  }
}
