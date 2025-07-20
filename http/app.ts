import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from 'node:http';
import { CORSHandler } from './cors-handler.js';
import { RequestParser } from './request-parser.js';
import { ResponseFormatter } from './response-formatter.js';
import { RouteResolver } from './route-resolver.js';
import type {
  AppOptions,
  AppStats,
  CORSConfig,
  HttpResponse,
  Route,
  RouteHandler,
} from './types.js';

/**
 * App - HTTP server framework with routing capabilities
 */
export class App {
  private requestParser: RequestParser;
  private routeResolver: RouteResolver;
  private responseFormatter: ResponseFormatter;
  private corsHandler: CORSHandler;
  private server: Server;

  constructor(options: AppOptions = {}) {
    // Initialize specialized components
    this.requestParser = new RequestParser();
    this.routeResolver = new RouteResolver();
    this.responseFormatter = new ResponseFormatter();
    this.corsHandler = new CORSHandler(options.cors || {});

    this.server = this._createServer();
  }

  /**
   * Create and configure the HTTP server
   * @private
   */
  private _createServer(): Server {
    const server = createServer();

    server.on('request', async (req: IncomingMessage, res: ServerResponse) => {
      try {
        await this._handleRequest(req, res);
      } catch (_error) {
        this._handleError(_error as Error, res);
      }
    });

    return server;
  }

  /**
   * Handle incoming HTTP request
   * @private
   */
  private async _handleRequest(
    req: IncomingMessage,
    res: ServerResponse
  ): Promise<void> {
    const url = new URL(req.url!, `http://${req.headers.host}`);
    const origin = this.requestParser.getOrigin(req);

    // Handle CORS preflight requests
    if (this.corsHandler.isPreflightRequest(req.method!, req.headers)) {
      const preflightResponse = this.corsHandler.createPreflightResponse(
        origin,
        req.headers
      );
      return this._sendResponse(res, preflightResponse);
    }

    // Resolve route
    const routeMatch = this.routeResolver.resolveRoute(
      req.method!,
      url.pathname
    );

    if (!routeMatch) {
      // Check if path exists for OPTIONS handling
      if (
        req.method === 'OPTIONS' &&
        this.routeResolver.hasPath(url.pathname)
      ) {
        const optionsResponse = this.corsHandler.createPreflightResponse(
          origin,
          req.headers
        );
        return this._sendResponse(res, optionsResponse);
      }

      const notFoundResponse = this.responseFormatter.createNotFoundResponse();
      return this._sendResponse(res, notFoundResponse);
    }

    // Parse request
    const parsedRequest = await this.requestParser.parseRequest(
      req,
      url,
      routeMatch.params
    );

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
   * Handle request processing _errors
   * @private
   */
  private _handleError(_error: Error, res: ServerResponse): void {
    let _errorResponse: HttpResponse;

    if (_error.name === 'RequestParseError') {
      _errorResponse = this.responseFormatter.createBadRequestResponse(
        _error.message
      );
    } else {
      console.error(`Error occurred: ${_error.message}`);
      _errorResponse = this.responseFormatter.createInternalErrorResponse();
    }

    this._sendResponse(res, _errorResponse);
  }

  /**
   * Send HTTP response
   * @private
   */
  private _sendResponse(res: ServerResponse, response: HttpResponse): void {
    const statusCode = response.statusCode || 200;
    const headers = response.headers || {};

    res.writeHead(statusCode, headers);
    res.end(response.body);
  }

  /**
   * Start the server
   */
  listen(port: string | number, callback?: () => void): void {
    this.server.listen(port, () => {
      console.log(`Server listening on port ${port}`);
      if (callback) callback();
    });
  }

  /**
   * Stop the server
   */
  close(callback?: (_err?: Error) => void): void {
    if (this.server) {
      this.server.close(callback);
    }
  }

  /**
   * Add a POST route handler
   */
  post(path: string, handler: RouteHandler): void {
    this.routeResolver.addRoute('POST', path, handler);
  }

  /**
   * Add a GET route handler
   */
  get(path: string, handler: RouteHandler): void {
    this.routeResolver.addRoute('GET', path, handler);
  }

  /**
   * Add a PUT route handler
   */
  put(path: string, handler: RouteHandler): void {
    this.routeResolver.addRoute('PUT', path, handler);
  }

  /**
   * Add a DELETE route handler
   */
  delete(path: string, handler: RouteHandler): void {
    this.routeResolver.addRoute('DELETE', path, handler);
  }

  /**
   * Add a PATCH route handler
   */
  patch(path: string, handler: RouteHandler): void {
    this.routeResolver.addRoute('PATCH', path, handler);
  }

  /**
   * Get application statistics
   */
  getStats(): AppStats {
    return {
      routes: this.routeResolver.getStats(),
      cors: this.corsHandler.getConfig(),
      server: {
        listening: this.server?.listening || false,
        address: this.server?.address() || null,
      },
    };
  }

  /**
   * Update CORS configuration
   */
  updateCORSConfig(corsConfig: CORSConfig): void {
    this.corsHandler.updateConfig(corsConfig);
  }

  /**
   * Get all registered routes
   */
  getRoutes(): Route[] {
    return this.routeResolver.getRoutes();
  }

  /**
   * Clear all registered routes
   */
  clearRoutes(): void {
    this.routeResolver.clear();
  }
}
