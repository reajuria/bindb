import type {
  HttpMethod,
  Route,
  RouteHandler,
  RouteMatch,
  RouteStats,
} from './types';

/**
 * RouteResolver - Handles route matching and parameter extraction
 */
export class RouteResolver {
  private handlers: Map<string, RouteHandler> = new Map();
  private paths: Set<string> = new Set();

  /**
   * Register a route handler
   */
  addRoute(method: HttpMethod, path: string, handler: RouteHandler): void {
    const key = `${method.toUpperCase()}:${path}`;
    this.handlers.set(key, handler);
    this.paths.add(path);
  }

  /**
   * Find matching route handler for a request
   */
  resolveRoute(method: string, pathname: string): RouteMatch | null {
    // First try exact match
    const exactKey = `${method.toUpperCase()}:${pathname}`;
    const exactHandler = this.handlers.get(exactKey);

    if (exactHandler) {
      return {
        handler: exactHandler,
        params: {},
      };
    }

    // Try pattern matching for parameterized routes
    for (const [key, handler] of this.handlers.entries()) {
      const [routeMethod, routePath] = this.parseRouteKey(key);

      if (method.toUpperCase() === routeMethod) {
        const { match, params } = this.matchRoute(pathname, routePath);

        if (match) {
          return {
            handler,
            params,
          };
        }
      }
    }

    return null;
  }

  /**
   * Check if a path exists in registered routes
   */
  hasPath(pathname: string): boolean {
    return this.paths.has(pathname);
  }

  /**
   * Parse route key into method and path
   */
  private parseRouteKey(key: string): [string, string] {
    const colonIndex = key.indexOf(':');
    return [key.substring(0, colonIndex), key.substring(colonIndex + 1)];
  }

  /**
   * Match a URL path against a route pattern
   */
  private matchRoute(
    urlPath: string,
    routePath: string
  ): { match: boolean; params: Record<string, string> } {
    const urlSegments = urlPath.split('/');
    const routeSegments = routePath.split('/');
    const params: Record<string, string> = {};

    if (urlSegments.length !== routeSegments.length) {
      return { match: false, params: {} };
    }

    for (let i = 0; i < routeSegments.length; i++) {
      const routeSegment = routeSegments[i];
      const urlSegment = urlSegments[i];

      if (routeSegment.startsWith(':')) {
        // Parameter segment
        const paramName = routeSegment.substring(1);
        params[paramName] = urlSegment;
      } else if (routeSegment !== urlSegment) {
        // Exact match failed
        return { match: false, params: {} };
      }
    }

    return { match: true, params };
  }

  /**
   * Get route statistics
   */
  getStats(): RouteStats {
    const byMethod: Record<string, number> = {};
    let total = 0;

    for (const key of this.handlers.keys()) {
      const [method] = this.parseRouteKey(key);
      byMethod[method] = (byMethod[method] || 0) + 1;
      total++;
    }

    return {
      total,
      byMethod: byMethod as Record<HttpMethod, number>,
    };
  }

  /**
   * Get all registered routes
   */
  getRoutes(): Route[] {
    const routes: Route[] = [];

    for (const [key, handler] of this.handlers.entries()) {
      const [method, path] = this.parseRouteKey(key);
      routes.push({
        method: method as HttpMethod,
        path,
        pattern: new RegExp(path), // Simplified pattern
        paramNames: this.extractParamNames(path),
        handler,
      });
    }

    return routes;
  }

  /**
   * Extract parameter names from route path
   */
  private extractParamNames(path: string): string[] {
    const segments = path.split('/');
    return segments
      .filter(segment => segment.startsWith(':'))
      .map(segment => segment.substring(1));
  }

  /**
   * Clear all registered routes
   */
  clear(): void {
    this.handlers.clear();
    this.paths.clear();
  }
}
