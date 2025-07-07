/**
 * ResponseFormatter - Handles HTTP response formatting and serialization
 */
export class ResponseFormatter {
  
  /**
   * Format handler result into HTTP response structure
   * @param {any} result - Handler result
   * @param {string} origin - Request origin for CORS
   * @returns {object} Formatted response
   */
  formatResponse(result, origin = '*') {
    if (!result) {
      return this.createEmptyResponse();
    }

    if (typeof result === 'string') {
      return this.createTextResponse(result);
    }

    if (typeof result === 'object') {
      return this.createJsonResponse(result, origin);
    }

    // Fallback for other types
    return this.createTextResponse(String(result));
  }

  /**
   * Create empty response
   * @returns {object} Empty response structure
   */
  createEmptyResponse() {
    return {
      body: undefined,
      headers: {
        'Content-Length': '0'
      },
      statusCode: 200
    };
  }

  /**
   * Create text/HTML response
   * @param {string} content - Response content
   * @returns {object} Text response structure
   */
  createTextResponse(content) {
    return {
      body: content,
      headers: {
        'Content-Type': 'text/html',
        'Content-Length': Buffer.byteLength(content, 'utf8').toString()
      },
      statusCode: 200
    };
  }

  /**
   * Create JSON response with CORS headers
   * @param {object} data - Response data
   * @param {string} origin - Request origin
   * @returns {object} JSON response structure
   */
  createJsonResponse(data, origin = '*') {
    const body = JSON.stringify(data);
    
    return {
      body,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body, 'utf8').toString(),
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400'
      },
      statusCode: 200
    };
  }

  /**
   * Create error response
   * @param {string} message - Error message
   * @param {number} statusCode - HTTP status code
   * @param {string} contentType - Content type
   * @returns {object} Error response structure
   */
  createErrorResponse(message, statusCode = 500, contentType = 'text/plain') {
    const body = contentType === 'application/json' 
      ? JSON.stringify({ error: message, statusCode })
      : message;

    return {
      body,
      headers: {
        'Content-Type': contentType,
        'Content-Length': Buffer.byteLength(body, 'utf8').toString()
      },
      statusCode
    };
  }

  /**
   * Create not found response
   * @returns {object} 404 response structure
   */
  createNotFoundResponse() {
    return this.createErrorResponse('Not Found', 404);
  }

  /**
   * Create bad request response
   * @param {string} message - Error message
   * @returns {object} 400 response structure
   */
  createBadRequestResponse(message = 'Bad Request') {
    return this.createErrorResponse(message, 400);
  }

  /**
   * Create internal server error response
   * @param {string} message - Error message
   * @returns {object} 500 response structure
   */
  createInternalErrorResponse(message = 'Internal Server Error') {
    return this.createErrorResponse(message, 500);
  }

  /**
   * Add security headers to response
   * @param {object} response - Response object
   * @returns {object} Response with security headers
   */
  addSecurityHeaders(response) {
    return {
      ...response,
      headers: {
        ...response.headers,
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block'
      }
    };
  }

  /**
   * Add caching headers to response
   * @param {object} response - Response object
   * @param {number} maxAge - Cache max age in seconds
   * @returns {object} Response with caching headers
   */
  addCacheHeaders(response, maxAge = 3600) {
    return {
      ...response,
      headers: {
        ...response.headers,
        'Cache-Control': `public, max-age=${maxAge}`,
        'ETag': this.generateETag(response.body)
      }
    };
  }

  /**
   * Generate ETag for response body
   * @param {string} body - Response body
   * @returns {string} ETag value
   */
  generateETag(body) {
    if (!body) return '"empty"';
    
    // Simple hash-based ETag
    let hash = 0;
    for (let i = 0; i < body.length; i++) {
      const char = body.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return `"${hash.toString(16)}"`;
  }

  /**
   * Validate response structure
   * @param {object} response - Response to validate
   * @returns {object} Validation result
   */
  validateResponse(response) {
    const errors = [];
    
    if (!response || typeof response !== 'object') {
      errors.push('Response must be an object');
      return { isValid: false, errors };
    }

    if (response.statusCode && (typeof response.statusCode !== 'number' || response.statusCode < 100 || response.statusCode > 599)) {
      errors.push('Status code must be a number between 100 and 599');
    }

    if (response.headers && typeof response.headers !== 'object') {
      errors.push('Headers must be an object');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Get response size in bytes
   * @param {object} response - Response object
   * @returns {number} Response size in bytes
   */
  getResponseSize(response) {
    if (!response.body) return 0;
    return Buffer.byteLength(response.body, 'utf8');
  }

  /**
   * Compress response if beneficial
   * @param {object} response - Response object
   * @param {number} threshold - Minimum size to compress (bytes)
   * @returns {object} Potentially compressed response
   */
  compressIfBeneficial(response, threshold = 1024) {
    const size = this.getResponseSize(response);
    
    if (size < threshold) {
      return response; // Not worth compressing
    }

    // In a real implementation, you'd use gzip/deflate here
    // For now, just add the header indicating compression support
    return {
      ...response,
      headers: {
        ...response.headers,
        'Accept-Encoding': 'gzip, deflate'
      }
    };
  }

  /**
   * Create response from error object
   * @param {Error} error - Error object
   * @returns {object} Error response
   */
  formatError(error) {
    const statusCode = error.statusCode || 500;
    const message = error.message || 'Internal Server Error';
    
    // Don't expose stack traces in production
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    if (isDevelopment && error.stack) {
      return this.createErrorResponse(
        JSON.stringify({ 
          error: message, 
          stack: error.stack.split('\n') 
        }), 
        statusCode, 
        'application/json'
      );
    }

    return this.createErrorResponse(message, statusCode);
  }
}