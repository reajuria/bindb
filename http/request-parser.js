import { randomUUID } from 'node:crypto';

/**
 * RequestParser - Handles HTTP request parsing and body extraction
 */
export class RequestParser {
  
  /**
   * Parse incoming HTTP request into structured format
   * @param {import('node:http').IncomingMessage} req - HTTP request
   * @param {URL} url - Parsed URL
   * @param {object} params - Route parameters
   * @returns {Promise<object>} Parsed request object
   */
  async parseRequest(req, url, params = {}) {
    const reqLocals = {
      reqId: randomUUID(),
      method: req.method,
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
        throw new RequestParseError(error.message, 400);
      }
    }

    return reqLocals;
  }

  /**
   * Parse request body as JSON
   * @param {import('node:http').IncomingMessage} req - HTTP request
   * @returns {Promise<object>} Parsed body
   */
  async parseBody(req) {
    return new Promise((resolve, reject) => {
      let body = '';
      
      req.on('data', (chunk) => {
        body += chunk.toString();
      });
      
      req.on('end', () => {
        try {
          resolve(JSON.parse(body || '{}'));
        } catch (error) {
          reject(new Error('Invalid JSON'));
        }
      });
      
      req.on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * Check if request method should have body parsed
   * @param {string} method - HTTP method
   * @returns {boolean} True if body should be parsed
   */
  shouldParseBody(method) {
    return method !== 'GET' && 
           method !== 'HEAD' && 
           method !== 'OPTIONS';
  }

  /**
   * Extract headers from request
   * @param {import('node:http').IncomingMessage} req - HTTP request
   * @returns {object} Request headers
   */
  extractHeaders(req) {
    return { ...req.headers };
  }

  /**
   * Extract query parameters from URL
   * @param {URL} url - Parsed URL
   * @returns {object} Query parameters
   */
  extractQuery(url) {
    return Object.fromEntries(url.searchParams);
  }

  /**
   * Get origin header for CORS
   * @param {import('node:http').IncomingMessage} req - HTTP request
   * @returns {string} Origin header or default
   */
  getOrigin(req) {
    return req.headers['origin'] || req.headers['Origin'] || '*';
  }

  /**
   * Validate request structure
   * @param {object} parsedRequest - Parsed request object
   * @returns {object} Validation result
   */
  validateRequest(parsedRequest) {
    const errors = [];
    
    if (!parsedRequest.reqId) {
      errors.push('Request ID is missing');
    }
    
    if (!parsedRequest.method) {
      errors.push('HTTP method is missing');
    }
    
    if (!parsedRequest.url) {
      errors.push('URL is missing');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Create request context with additional metadata
   * @param {object} parsedRequest - Parsed request
   * @param {object} metadata - Additional metadata
   * @returns {object} Enhanced request context
   */
  createRequestContext(parsedRequest, metadata = {}) {
    return {
      ...parsedRequest,
      timestamp: Date.now(),
      userAgent: parsedRequest.headers['user-agent'] || 'unknown',
      contentType: parsedRequest.headers['content-type'] || 'application/json',
      contentLength: parsedRequest.headers['content-length'] || 0,
      ...metadata
    };
  }
}

/**
 * Custom error class for request parsing errors
 */
export class RequestParseError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = 'RequestParseError';
    this.statusCode = statusCode;
  }
}