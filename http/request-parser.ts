// import { randomUUID } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import type { ParsedRequest, RouteParams } from './types.js';

/**
 * Request parsing error
 */
export class RequestParseError extends Error {
  constructor(message: string, public statusCode: number = 400) {
    super(message);
    this.name = 'RequestParseError';
  }
}

/**
 * RequestParser - Handles HTTP request parsing and body extraction
 */
export class RequestParser {
  
  /**
   * Parse incoming HTTP request into structured format
   */
  async parseRequest(req: IncomingMessage, url: URL, params: RouteParams = {}): Promise<ParsedRequest> {
    const reqLocals: ParsedRequest = {
      method: req.method as any,
      url,
      headers: req.headers,
      params,
      query: Object.fromEntries(url.searchParams),
      body: undefined,
    };

    // Parse body for non-GET requests
    if (this.shouldParseBody(req.method)) {
      try {
        reqLocals.body = await this.parseBody(req);
      } catch (error) {
        throw new RequestParseError((error as Error).message, 400);
      }
    }

    return reqLocals;
  }

  /**
   * Parse request body as JSON
   */
  async parseBody(req: IncomingMessage): Promise<any> {
    return new Promise((resolve, reject) => {
      let body = '';
      
      req.on('data', (chunk) => {
        body += chunk.toString();
      });
      
      req.on('end', () => {
        try {
          if (body.trim() === '') {
            resolve({});
          } else {
            const parsed = JSON.parse(body);
            resolve(parsed);
          }
        } catch (error) {
          reject(new Error(`Invalid JSON in request body: ${(error as Error).message}`));
        }
      });
      
      req.on('error', reject);
    });
  }

  /**
   * Check if request method should have body parsed
   */
  shouldParseBody(method?: string): boolean {
    if (!method) return false;
    return ['POST', 'PUT', 'PATCH'].includes(method.toUpperCase());
  }

  /**
   * Get origin from request headers
   */
  getOrigin(req: IncomingMessage): string | undefined {
    return req.headers.origin as string || req.headers.referer as string;
  }

  /**
   * Get request size in bytes
   */
  getRequestSize(req: IncomingMessage): number {
    const contentLength = req.headers['content-length'];
    return contentLength ? parseInt(contentLength, 10) : 0;
  }

  /**
   * Validate content type
   */
  validateContentType(req: IncomingMessage, expectedType: string = 'application/json'): boolean {
    const contentType = req.headers['content-type'];
    return contentType ? contentType.includes(expectedType) : false;
  }

  /**
   * Get user agent from request
   */
  getUserAgent(req: IncomingMessage): string | undefined {
    return req.headers['user-agent'] as string;
  }
}