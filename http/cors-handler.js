/**
 * CORSHandler - Handles Cross-Origin Resource Sharing (CORS) logic
 */
export class CORSHandler {
  constructor(options = {}) {
    this.config = {
      allowedOrigins: options.allowedOrigins || ['*'],
      allowedMethods: options.allowedMethods || ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
      allowedHeaders: options.allowedHeaders || ['Content-Type', 'Authorization'],
      maxAge: options.maxAge || 86400, // 24 hours
      credentials: options.credentials || false,
      ...options
    };
  }

  /**
   * Check if request is a CORS preflight request
   * @param {string} method - HTTP method
   * @param {object} headers - Request headers
   * @returns {boolean} True if preflight request
   */
  isPreflightRequest(method, headers) {
    return method === 'OPTIONS' && 
           (headers['access-control-request-method'] || 
            headers['Access-Control-Request-Method']);
  }

  /**
   * Get origin from request headers
   * @param {object} headers - Request headers
   * @returns {string} Origin value
   */
  getOrigin(headers) {
    return headers['origin'] || 
           headers['Origin'] || 
           headers['sec-fetch-site'] || 
           '*';
  }

  /**
   * Check if origin is allowed
   * @param {string} origin - Request origin
   * @returns {boolean} True if origin is allowed
   */
  isOriginAllowed(origin) {
    if (this.config.allowedOrigins.includes('*')) {
      return true;
    }

    return this.config.allowedOrigins.includes(origin);
  }

  /**
   * Get CORS headers for a response
   * @param {string} origin - Request origin
   * @param {object} options - Additional options
   * @returns {object} CORS headers
   */
  getCORSHeaders(origin, options = {}) {
    const headers = {};

    // Set allowed origin
    if (this.isOriginAllowed(origin)) {
      headers['Access-Control-Allow-Origin'] = origin === '*' ? '*' : origin;
    }

    // Set allowed methods
    headers['Access-Control-Allow-Methods'] = this.config.allowedMethods.join(', ');

    // Set allowed headers
    headers['Access-Control-Allow-Headers'] = this.config.allowedHeaders.join(', ');

    // Set max age for preflight cache
    headers['Access-Control-Max-Age'] = this.config.maxAge.toString();

    // Set credentials if enabled
    if (this.config.credentials) {
      headers['Access-Control-Allow-Credentials'] = 'true';
    }

    // Add exposed headers if specified
    if (options.exposedHeaders && options.exposedHeaders.length > 0) {
      headers['Access-Control-Expose-Headers'] = options.exposedHeaders.join(', ');
    }

    return headers;
  }

  /**
   * Create preflight response
   * @param {string} origin - Request origin
   * @param {object} requestHeaders - Request headers
   * @returns {object} Preflight response
   */
  createPreflightResponse(origin, requestHeaders) {
    const requestMethod = requestHeaders['access-control-request-method'] ||
                         requestHeaders['Access-Control-Request-Method'];
    
    const requestHeadersList = requestHeaders['access-control-request-headers'] ||
                              requestHeaders['Access-Control-Request-Headers'];

    // Validate requested method
    if (requestMethod && !this.config.allowedMethods.includes(requestMethod)) {
      return {
        statusCode: 403,
        headers: {},
        body: 'Method not allowed by CORS policy'
      };
    }

    // Validate requested headers
    if (requestHeadersList) {
      const requestedHeaders = requestHeadersList.split(',').map(h => h.trim());
      const hasDisallowedHeaders = requestedHeaders.some(
        header => !this.config.allowedHeaders.includes(header)
      );

      if (hasDisallowedHeaders) {
        return {
          statusCode: 403,
          headers: {},
          body: 'Headers not allowed by CORS policy'
        };
      }
    }

    return {
      statusCode: 200,
      headers: this.getCORSHeaders(origin),
      body: ''
    };
  }

  /**
   * Add CORS headers to an existing response
   * @param {object} response - Existing response
   * @param {string} origin - Request origin
   * @param {object} options - Additional options
   * @returns {object} Response with CORS headers
   */
  addCORSHeaders(response, origin, options = {}) {
    const corsHeaders = this.getCORSHeaders(origin, options);
    
    return {
      ...response,
      headers: {
        ...response.headers,
        ...corsHeaders
      }
    };
  }

  /**
   * Validate CORS configuration
   * @returns {object} Validation result
   */
  validateConfig() {
    const errors = [];

    if (!Array.isArray(this.config.allowedOrigins)) {
      errors.push('allowedOrigins must be an array');
    }

    if (!Array.isArray(this.config.allowedMethods)) {
      errors.push('allowedMethods must be an array');
    }

    if (!Array.isArray(this.config.allowedHeaders)) {
      errors.push('allowedHeaders must be an array');
    }

    if (typeof this.config.maxAge !== 'number' || this.config.maxAge < 0) {
      errors.push('maxAge must be a non-negative number');
    }

    if (typeof this.config.credentials !== 'boolean') {
      errors.push('credentials must be a boolean');
    }

    // Check for wildcard origin with credentials
    if (this.config.credentials && this.config.allowedOrigins.includes('*')) {
      errors.push('Cannot use wildcard origin (*) with credentials enabled');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Update CORS configuration
   * @param {object} newConfig - New configuration options
   */
  updateConfig(newConfig) {
    this.config = {
      ...this.config,
      ...newConfig
    };
  }

  /**
   * Get current configuration
   * @returns {object} Current CORS configuration
   */
  getConfig() {
    return { ...this.config };
  }

  /**
   * Create middleware function for Express-like frameworks
   * @returns {Function} CORS middleware function
   */
  middleware() {
    return (req, res, next) => {
      const origin = this.getOrigin(req.headers);

      // Handle preflight request
      if (this.isPreflightRequest(req.method, req.headers)) {
        const preflightResponse = this.createPreflightResponse(origin, req.headers);
        
        res.statusCode = preflightResponse.statusCode;
        Object.entries(preflightResponse.headers).forEach(([key, value]) => {
          res.setHeader(key, value);
        });
        
        return res.end(preflightResponse.body);
      }

      // Add CORS headers to regular responses
      const corsHeaders = this.getCORSHeaders(origin);
      Object.entries(corsHeaders).forEach(([key, value]) => {
        res.setHeader(key, value);
      });

      if (next) next();
    };
  }

  /**
   * Log CORS information for debugging
   * @param {string} origin - Request origin
   * @param {string} method - Request method
   * @param {boolean} allowed - Whether request was allowed
   */
  logCORS(origin, method, allowed) {
    const timestamp = new Date().toISOString();
    const status = allowed ? 'ALLOWED' : 'BLOCKED';
    
    console.log(`[${timestamp}] CORS ${status}: ${method} from ${origin}`);
  }
}