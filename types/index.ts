/**
 * BinDB TypeScript Global Type Definitions
 * Advanced type patterns and utility types for the entire database system
 */

// ===== UTILITY TYPES =====

/**
 * Make specified properties required
 */
export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

/**
 * Make specified properties optional
 */
export type OptionalFields<T, K extends keyof T> = Omit<T, K> &
  Partial<Pick<T, K>>;

/**
 * Deep readonly type
 */
export type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends (infer U)[]
    ? ReadonlyArray<DeepReadonly<U>>
    : T[P] extends object
      ? DeepReadonly<T[P]>
      : T[P];
};

/**
 * Async version of any function type
 */
export type AsyncFunction<T extends (...args: any[]) => any> = (
  ...args: Parameters<T>
) => Promise<ReturnType<T>>;

/**
 * Extract array element type
 */
export type ArrayElement<T> = T extends readonly (infer U)[] ? U : never;

/**
 * Result type for operations that can fail
 */
export type Result<T, E = Error> =
  | { success: true; data: T; error?: never }
  | { success: false; data?: never; error: E };

/**
 * Branded types for type safety
 */
export type Brand<T, B> = T & { __brand: B };

// ===== BRANDED ID TYPES =====

export type DatabaseId = Brand<string, 'DatabaseId'>;
export type TableId = Brand<string, 'TableId'>;
export type RecordId = Brand<string, 'RecordId'>;
export type SchemaId = Brand<string, 'SchemaId'>;
export type SlotId = Brand<number, 'SlotId'>;

// ===== CORE DATA TYPES =====

/**
 * Supported column data types
 */
export enum DataType {
  Text = 'text',
  Number = 'number',
  Boolean = 'boolean',
  Date = 'date',
  Coordinates = 'coordinates',
  Buffer = 'buffer',
}

/**
 * Coordinate system type
 */
export interface Coordinates {
  lat: number;
  lng: number;
}

/**
 * Supported value types in the database
 */
export type DatabaseValue =
  | string
  | number
  | boolean
  | Date
  | Coordinates
  | Buffer
  | null;

/**
 * Generic record type with branded ID
 */
export interface DatabaseRecord extends Record<string, DatabaseValue> {
  id: RecordId;
}

/**
 * Column definition with advanced constraints
 */
export interface ColumnDefinition {
  name: string;
  type: DataType;
  length?: number;
  nullable?: boolean;
  defaultValue?: DatabaseValue;
  unique?: boolean;
  indexed?: boolean;
}

/**
 * Schema definition with metadata
 */
export interface SchemaDefinition {
  id: SchemaId;
  database: DatabaseId;
  table: TableId;
  columns: ColumnDefinition[];
  version: number;
  created: Date;
  modified: Date;
}

// ===== OPERATION TYPES =====

/**
 * CRUD operation types
 */
export enum OperationType {
  Create = 'create',
  Read = 'read',
  Update = 'update',
  Delete = 'delete',
  BulkInsert = 'bulk_insert',
  BulkUpdate = 'bulk_update',
  BulkDelete = 'bulk_delete',
}

/**
 * Query operators for filtering
 */
export enum QueryOperator {
  Equal = 'eq',
  NotEqual = 'ne',
  GreaterThan = 'gt',
  GreaterThanOrEqual = 'gte',
  LessThan = 'lt',
  LessThanOrEqual = 'lte',
  In = 'in',
  NotIn = 'nin',
  Like = 'like',
  NotLike = 'nlike',
}

/**
 * Filter condition for queries
 */
export interface FilterCondition {
  field: string;
  operator: QueryOperator;
  value: DatabaseValue | DatabaseValue[];
}

/**
 * Advanced query options
 */
export interface QueryOptions {
  filters?: FilterCondition[];
  sort?: Array<{ field: string; direction: 'asc' | 'desc' }>;
  limit?: number;
  offset?: number;
  includeDeleted?: boolean;
}

/**
 * Operation metadata
 */
export interface OperationMetadata {
  operation: OperationType;
  timestamp: Date;
  duration: number;
  recordCount: number;
  cacheHit?: boolean;
  diskIO?: boolean;
}

/**
 * Generic operation result
 */
export interface OperationResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  metadata: OperationMetadata;
}

// ===== PERFORMANCE & MONITORING TYPES =====

/**
 * Cache statistics
 */
export interface CacheStats {
  size: number;
  maxSize: number;
  hitCount: number;
  missCount: number;
  hitRate: number;
  utilization: string;
  memoryUsage: number;
}

/**
 * Buffer statistics
 */
export interface BufferStats {
  recordCount: number;
  bufferSize: number;
  maxBufferRecords: number;
  maxBufferSize: number;
  recordUtilization: string;
  flushCount: number;
  autoFlushes: number;
}

/**
 * Table performance metrics
 */
export interface TableStats {
  records: number;
  size: number;
  cache: CacheStats;
  writeBuffer: BufferStats;
  operations: {
    inserts: number;
    updates: number;
    deletes: number;
    reads: number;
  };
  performance: {
    avgInsertTime: number;
    avgReadTime: number;
    avgUpdateTime: number;
    avgDeleteTime: number;
  };
}

/**
 * Database-wide statistics
 */
export interface DatabaseStats {
  tables: Record<TableId, TableStats>;
  totalRecords: number;
  totalSize: number;
  uptime: number;
  memoryUsage: NodeJS.MemoryUsage;
  cacheEfficiency: number;
}

// ===== API TYPES =====

/**
 * HTTP response wrapper
 */
export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
  requestId: string;
  metadata?: {
    pagination?: {
      page: number;
      limit: number;
      total: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
    performance?: {
      duration: number;
      cacheHit: boolean;
    };
  };
}

/**
 * Pagination parameters
 */
export interface PaginationParams {
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

/**
 * Health check response
 */
export interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version: string;
  services: {
    database: 'up' | 'down';
    cache: 'up' | 'down';
    api: 'up' | 'down';
  };
  metrics: {
    memoryUsage: number;
    cpuUsage: number;
    requestCount: number;
    errorRate: number;
  };
}

// ===== CONFIGURATION TYPES =====

/**
 * Database configuration
 */
export interface DatabaseConfig {
  name: DatabaseId;
  path: string;
  options: {
    cacheSize?: number;
    bufferSize?: number;
    autoFlush?: boolean;
    strictMode?: boolean;
    backupEnabled?: boolean;
  };
}

/**
 * Server configuration
 */
export interface ServerConfig {
  port: number;
  host: string;
  cors: {
    enabled: boolean;
    origins: string[];
    methods: string[];
    headers: string[];
  };
  rateLimit: {
    enabled: boolean;
    requests: number;
    window: number;
  };
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
    file?: string;
    console: boolean;
  };
}

/**
 * Complete application configuration
 */
export interface AppConfig {
  database: DatabaseConfig;
  server: ServerConfig;
  features: {
    metrics: boolean;
    debugging: boolean;
    benchmarking: boolean;
    monitoring: boolean;
  };
}

// ===== EVENT TYPES =====

/**
 * Database events
 */
export enum DatabaseEvent {
  TableCreated = 'table:created',
  TableDeleted = 'table:deleted',
  RecordInserted = 'record:inserted',
  RecordUpdated = 'record:updated',
  RecordDeleted = 'record:deleted',
  CacheMiss = 'cache:miss',
  CacheHit = 'cache:hit',
  BufferFlushed = 'buffer:flushed',
  ErrorOccurred = 'error:occurred',
}

/**
 * Event payload interface
 */
export interface EventPayload<T = any> {
  event: DatabaseEvent;
  timestamp: Date;
  data: T;
  metadata?: Record<string, any>;
}

/**
 * Event listener type
 */
export type EventListener<T = any> = (
  payload: EventPayload<T>
) => void | Promise<void>;

// ===== ADVANCED CONDITIONAL TYPES =====

/**
 * Extract keys of a type that match a specific value type
 */
export type KeysOfType<T, U> = {
  [K in keyof T]: T[K] extends U ? K : never;
}[keyof T];

/**
 * Create a type with only the properties that match a specific type
 */
export type PickByType<T, U> = Pick<T, KeysOfType<T, U>>;

/**
 * Conditional type for async or sync functions
 */
export type MaybeAsync<T> = T | Promise<T>;

/**
 * Type-safe event emitter
 */
export interface TypedEventEmitter<T extends Record<string, any>> {
  on<K extends keyof T>(event: K, listener: (data: T[K]) => void): this;
  emit<K extends keyof T>(event: K, data: T[K]): boolean;
  off<K extends keyof T>(event: K, listener: (data: T[K]) => void): this;
}

// ===== VALIDATION TYPES =====

/**
 * Validation rule interface
 */
export interface ValidationRule<T = any> {
  field: string;
  required?: boolean;
  type?: 'string' | 'number' | 'boolean' | 'date' | 'array' | 'object';
  min?: number;
  max?: number;
  pattern?: RegExp;
  custom?: (value: T) => boolean | string;
}

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: Array<{
    field: string;
    message: string;
    value?: any;
  }>;
}

/**
 * Schema validation for API requests
 */
export type ValidatedRequest<T> =
  | {
      valid: true;
      data: T;
    }
  | {
      valid: false;
      errors: ValidationResult['errors'];
    };

// ===== GENERIC REPOSITORY PATTERN =====

/**
 * Generic repository interface
 */
export interface Repository<T extends DatabaseRecord> {
  findById(id: RecordId): Promise<T | null>;
  findMany(options?: QueryOptions): Promise<T[]>;
  create(data: Omit<T, 'id'>): Promise<T>;
  update(id: RecordId, data: Partial<Omit<T, 'id'>>): Promise<T | null>;
  delete(id: RecordId): Promise<boolean>;
  count(options?: QueryOptions): Promise<number>;
  exists(id: RecordId): Promise<boolean>;
}

// ===== TYPE GUARDS =====

/**
 * Type guard for checking if a value is a valid database value
 */
export function isDatabaseValue(value: unknown): value is DatabaseValue {
  return (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    value instanceof Date ||
    value instanceof Buffer ||
    (typeof value === 'object' &&
      value !== null &&
      'lat' in value &&
      'lng' in value &&
      typeof (value as any).lat === 'number' &&
      typeof (value as any).lng === 'number')
  );
}

/**
 * Type guard for coordinates
 */
export function isCoordinates(value: unknown): value is Coordinates {
  return (
    typeof value === 'object' &&
    value !== null &&
    'lat' in value &&
    'lng' in value &&
    typeof (value as any).lat === 'number' &&
    typeof (value as any).lng === 'number'
  );
}

// ===== GLOBAL AUGMENTATIONS =====

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      NODE_ENV: 'development' | 'production' | 'test';
      PORT?: string;
      BINDB_STORAGE_PATH?: string;
      BINDB_CACHE_SIZE?: string;
      BINDB_BUFFER_SIZE?: string;
      BINDB_DEBUG?: string;
    }
  }
}

// ===== MODULE EXPORTS =====

// Note: These would be actual module exports in a real implementation
// export * from './cache';
// export * from './database';
// export * from './http';
// export * from './table';

// Default export for convenience
export default {
  DataType,
  OperationType,
  QueryOperator,
  DatabaseEvent,
  isDatabaseValue,
  isCoordinates,
} as const;
