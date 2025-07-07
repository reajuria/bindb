/**
 * RouteResolver - Handles route matching and parameter extraction
 */
export class RouteResolver {
  constructor() {
    /** @type {Map<string, Function>} */
    this.handlers = new Map();
    this.paths = new Set();
  }

  /**
   * Register a route handler
   * @param {string} method - HTTP method
   * @param {string} path - Route path (may contain parameters like :id)
   * @param {Function} handler - Route handler function
   */
  addRoute(method, path, handler) {
    const key = `${method.toUpperCase()}:${path}`;
    this.handlers.set(key, handler);
    this.paths.add(path);
  }

  /**
   * Find matching route handler for a request
   * @param {string} method - HTTP method
   * @param {string} pathname - URL pathname
   * @returns {object|null} Route match result
   */
  resolveRoute(method, pathname) {
    // First try exact match
    const exactKey = `${method.toUpperCase()}:${pathname}`;
    const exactHandler = this.handlers.get(exactKey);
    
    if (exactHandler) {
      return {
        handler: exactHandler,
        params: {},
        path: pathname
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
            path: routePath
          };
        }
      }
    }

    return null;
  }

  /**
   * Match a URL path against a route pattern
   * @param {string} urlPath - URL path to match
   * @param {string} routePath - Route pattern (may contain :param)
   * @returns {object} Match result with parameters
   */
  matchRoute(urlPath, routePath) {
    const urlSegments = urlPath.split('/');
    const routeSegments = routePath.split('/');
    const params = {};

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
        // Literal segment doesn't match
        return { match: false, params: {} };
      }
    }

    return { match: true, params };
  }

  /**
   * Parse route key into method and path
   * @param {string} key - Route key (METHOD:path)
   * @returns {Array<string>} [method, path]
   */
  parseRouteKey(key) {
    const colonIndex = key.indexOf(':');
    return [
      key.substring(0, colonIndex),
      key.substring(colonIndex + 1)
    ];
  }

  /**
   * Check if a path is registered (for OPTIONS handling)
   * @param {string} pathname - URL pathname
   * @returns {boolean} True if path is registered
   */
  hasPath(pathname) {
    // Check exact path
    if (this.paths.has(pathname)) {
      return true;
    }

    // Check if any registered path pattern matches
    for (const registeredPath of this.paths) {
      const { match } = this.matchRoute(pathname, registeredPath);
      if (match) {
        return true;
      }
    }

    return false;
  }

  /**
   * Get all registered routes
   * @returns {Array<object>} List of registered routes
   */
  getRoutes() {
    const routes = [];
    
    for (const [key] of this.handlers) {
      const [method, path] = this.parseRouteKey(key);
      routes.push({ method, path });
    }

    return routes;
  }

  /**
   * Get route statistics
   * @returns {object} Route statistics
   */
  getStats() {
    const routesByMethod = {};
    let totalRoutes = 0;

    for (const [key] of this.handlers) {
      const [method] = this.parseRouteKey(key);
      routesByMethod[method] = (routesByMethod[method] || 0) + 1;
      totalRoutes++;
    }

    return {
      totalRoutes,
      routesByMethod,
      uniquePaths: this.paths.size
    };
  }

  /**
   * Validate route pattern
   * @param {string} path - Route path to validate
   * @returns {object} Validation result
   */
  validateRoute(path) {
    const errors = [];
    
    if (!path || typeof path !== 'string') {
      errors.push('Route path must be a non-empty string');
      return { isValid: false, errors };
    }

    if (!path.startsWith('/')) {
      errors.push('Route path must start with "/"');
    }

    // Check for valid parameter syntax
    const segments = path.split('/');
    for (const segment of segments) {
      if (segment.startsWith(':')) {
        const paramName = segment.substring(1);
        if (!paramName || !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(paramName)) {
          errors.push(`Invalid parameter name: ${segment}`);
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Extract parameter names from route pattern
   * @param {string} path - Route path
   * @returns {Array<string>} Parameter names
   */
  extractParameterNames(path) {
    const segments = path.split('/');
    const paramNames = [];

    for (const segment of segments) {
      if (segment.startsWith(':')) {
        paramNames.push(segment.substring(1));
      }
    }

    return paramNames;
  }

  /**
   * Clear all registered routes
   */
  clear() {
    this.handlers.clear();
    this.paths.clear();
  }
}