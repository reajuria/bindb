import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from 'node:http';
import {
  createRequestContext,
  getContext,
  getRequestDuration,
  logger,
  runWithContext,
} from '../logging/index';
import { CORSHandler } from './cors-handler';
import { RequestParser } from './request-parser';
import { ResponseFormatter } from './response-formatter';
import { RouteResolver } from './route-resolver';
import type {
  AppOptions,
  AppStats,
  CORSConfig,
  HttpResponse,
  Route,
  RouteHandler,
} from './types';

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
      // Create request context with correlation ID
      const requestContext = createRequestContext(req);

      // Run request handling within context
      await runWithContext(requestContext, async () => {
        try {
          // Log incoming request
          logger.info(
            `Incoming request: ${req.method} ${requestContext.path}`,
            {
              correlationId: requestContext.correlationId,
              requestId: requestContext.requestId,
              method: req.method,
              path: requestContext.path,
              clientIp: requestContext.clientIp,
            }
          );

          await this._handleRequest(req, res);
        } catch (_error) {
          this._handleError(_error as Error, res);
        }
      });
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
      logger.warn('Request parsing error', { errorName: _error.name }, _error);
      _errorResponse = this.responseFormatter.createBadRequestResponse(
        _error.message
      );
    } else {
      logger.error(
        'Internal server error during request processing',
        { errorName: _error.name },
        _error
      );
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

    // Log response with timing using context from AsyncLocalStorage
    const duration = getRequestDuration();
    const context = getContext();
    if (duration !== undefined && context) {
      logger.logResponse(context.method, context.path, statusCode, duration, {
        responseSize: response.body?.length || 0,
      });
    }

    res.writeHead(statusCode, headers);
    res.end(response.body);
  }

  /**
   * Start the server
   */
  listen(port: string | number, callback?: () => void): void {
    this.server.listen(port, () => {
      logger.info(`HTTP server listening on port ${port}`, { port });
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
   * Get current CORS configuration
   */
  getCORSConfig(): CORSConfig {
    return this.corsHandler.getConfig();
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
