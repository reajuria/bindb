// Type definitions for the HTTP layer

/**
 * HTTP Method types
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'OPTIONS' | 'HEAD';

/**
 * Route parameters extracted from URL path
 */
export interface RouteParams {
  [key: string]: string;
}

/**
 * Parsed HTTP request object
 */
export interface ParsedRequest {
  method: HttpMethod;
  url: URL;
  headers: Record<string, string | string[] | undefined>;
  query: Record<string, string | string[]>;
  params: RouteParams;
  body?: any;
  origin?: string;
}

/**
 * HTTP response object
 */
export interface HttpResponse {
  statusCode: number;
  headers?: Record<string, string>;
  body?: string | Buffer | undefined;
}

/**
 * Route handler function type
 */
export type RouteHandler = (request: ParsedRequest) => Promise<any> | any;

/**
 * Route match result
 */
export interface RouteMatch {
  handler: RouteHandler;
  params: RouteParams;
}

/**
 * Route definition
 */
export interface Route {
  method: HttpMethod;
  path: string;
  pattern: RegExp;
  paramNames: string[];
  handler: RouteHandler;
}

/**
 * CORS configuration
 */
export interface CORSConfig {
  origin?: string | string[] | boolean;
  methods?: string | string[];
  allowedHeaders?: string | string[];
  exposedHeaders?: string | string[];
  credentials?: boolean;
  maxAge?: number;
}

/**
 * App options
 */
export interface AppOptions {
  cors?: CORSConfig;
}

/**
 * Route statistics
 */
export interface RouteStats {
  total: number;
  byMethod: Record<HttpMethod, number>;
}

/**
 * Server statistics  
 */
export interface ServerStats {
  listening: boolean;
  address: any;
}

/**
 * App statistics
 */
export interface AppStats {
  routes: RouteStats;
  cors: CORSConfig;
  server: ServerStats;
}