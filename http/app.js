import { createServer } from 'node:http';
import { RequestParser } from './request-parser.js';
import { RouteResolver } from './route-resolver.js';
import { ResponseFormatter } from './response-formatter.js';
import { CORSHandler } from './cors-handler.js';

/**
 * App - HTTP server framework with routing capabilities
 */
export class App {
  constructor(options = {}) {
    // Initialize specialized components
    this.requestParser = new RequestParser();
    this.routeResolver = new RouteResolver();
    this.responseFormatter = new ResponseFormatter();
    this.corsHandler = new CORSHandler(options.cors || {});
    
    /** @type {import('node:http').Server} */
    this.server = undefined;

    this._createServer();
  }

  /**
   * Create and configure the HTTP server
   * @private
   */
  _createServer() {
    this.server = createServer();

    this.server.on('request', async (req, res) => {
      try {
        await this._handleRequest(req, res);
      } catch (error) {
        this._handleError(error, res);
      }
    });
  }

  /**
   * Handle incoming HTTP request
   * @param {import('node:http').IncomingMessage} req - HTTP request
   * @param {import('node:http').ServerResponse} res - HTTP response
   * @private
   */
  async _handleRequest(req, res) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const origin = this.requestParser.getOrigin(req);

    // Handle CORS preflight requests
    if (this.corsHandler.isPreflightRequest(req.method, req.headers)) {
      const preflightResponse = this.corsHandler.createPreflightResponse(origin, req.headers);
      return this._sendResponse(res, preflightResponse);
    }

    // Resolve route
    const routeMatch = this.routeResolver.resolveRoute(req.method, url.pathname);
    
    if (!routeMatch) {
      // Check if path exists for OPTIONS handling
      if (req.method === 'OPTIONS' && this.routeResolver.hasPath(url.pathname)) {
        const optionsResponse = this.corsHandler.createPreflightResponse(origin, req.headers);
        return this._sendResponse(res, optionsResponse);
      }

      const notFoundResponse = this.responseFormatter.createNotFoundResponse();
      return this._sendResponse(res, notFoundResponse);
    }

    // Parse request
    const parsedRequest = await this.requestParser.parseRequest(req, url, routeMatch.params);
    
    // Call route handler
    const handlerResult = await routeMatch.handler(parsedRequest);
    
    // Format response
    let response = this.responseFormatter.formatResponse(handlerResult, origin);
    
    // Add CORS headers
    response = this.corsHandler.addCORSHeaders(response, origin);
    
    // Send response
    this._sendResponse(res, response);
  }

  /**
   * Handle request processing errors
   * @param {Error} error - Error that occurred
   * @param {import('node:http').ServerResponse} res - HTTP response
   * @private
   */
  _handleError(error, res) {
    let errorResponse;

    if (error.name === 'RequestParseError') {
      errorResponse = this.responseFormatter.createBadRequestResponse(error.message);
    } else {
      console.error(`Error occurred: ${error.message}`);
      errorResponse = this.responseFormatter.createInternalErrorResponse();
    }

    this._sendResponse(res, errorResponse);
  }

  /**
   * Send HTTP response
   * @param {import('node:http').ServerResponse} res - HTTP response
   * @param {object} response - Response object
   * @private
   */
  _sendResponse(res, response) {
    const statusCode = response.statusCode || 200;
    const headers = response.headers || {};
    
    res.writeHead(statusCode, headers);
    res.end(response.body);
  }

  /**
   * Start the server
   * @param {number} port - Port to listen on
   * @param {Function} callback - Optional callback
   */
  listen(port, callback) {
    this.server.listen(port, () => {
      console.log(`Server listening on port ${port}`);
      if (callback) callback();
    });
  }

  /**
   * Stop the server
   * @param {Function} callback - Optional callback
   */
  close(callback) {
    if (this.server) {
      this.server.close(callback);
    }
  }

  /**
   * Add a POST route handler
   * @param {string} path - Route path
   * @param {Function} handler - Route handler
   */
  post(path, handler) {
    this.routeResolver.addRoute('POST', path, handler);
  }

  /**
   * Add a GET route handler
   * @param {string} path - Route path
   * @param {Function} handler - Route handler
   */
  get(path, handler) {
    this.routeResolver.addRoute('GET', path, handler);
  }

  /**
   * Add a PUT route handler
   * @param {string} path - Route path
   * @param {Function} handler - Route handler
   */
  put(path, handler) {
    this.routeResolver.addRoute('PUT', path, handler);
  }

  /**
   * Add a DELETE route handler
   * @param {string} path - Route path
   * @param {Function} handler - Route handler
   */
  delete(path, handler) {
    this.routeResolver.addRoute('DELETE', path, handler);
  }

  /**
   * Add a PATCH route handler
   * @param {string} path - Route path
   * @param {Function} handler - Route handler
   */
  patch(path, handler) {
    this.routeResolver.addRoute('PATCH', path, handler);
  }

  /**
   * Get application statistics
   * @returns {object} Application statistics
   */
  getStats() {
    return {
      routes: this.routeResolver.getStats(),
      cors: this.corsHandler.getConfig(),
      server: {
        listening: this.server?.listening || false,
        address: this.server?.address() || null
      }
    };
  }

  /**
   * Update CORS configuration
   * @param {object} corsConfig - New CORS configuration
   */
  updateCORSConfig(corsConfig) {
    this.corsHandler.updateConfig(corsConfig);
  }

  /**
   * Get all registered routes
   * @returns {Array<object>} List of routes
   */
  getRoutes() {
    return this.routeResolver.getRoutes();
  }

  /**
   * Clear all registered routes
   */
  clearRoutes() {
    this.routeResolver.clear();
  }
}