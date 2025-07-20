import type { RowData } from '../engine/row.js';
import type { BinDBSchemaField } from './type-mapper.js';

/**
 * Result formatter configuration
 */
export interface FormattingConfig {
  includeMetadata?: boolean;
  includeTiming?: boolean;
  includeStats?: boolean;
  dateFormat?: 'iso' | 'timestamp' | 'unix';
  [key: string]: any;
}

/**
 * Operation metadata for responses
 */
export interface OperationMetadata {
  operation?: string;
  database?: string;
  table?: string;
  id?: string;
  startTime?: number;
  endTime?: number;
  timestamp?: number;
  fieldsUpdated?: string[];
  batchInfo?: any;
  columnsCount?: number;
  recordsInPage?: number;
  errorType?: string;
  [key: string]: any;
}

/**
 * Timing information
 */
export interface TimingInfo {
  timing?: {
    duration?: number;
    timestamp: string | number;
  };
}

/**
 * Base response structure
 */
export interface BaseResponse {
  success?: boolean;
  metadata?: OperationMetadata & TimingInfo;
}

/**
 * Insert operation response
 */
export interface InsertResponse extends BaseResponse {
  insertedId: string;
  record: RowData;
}

/**
 * Bulk insert operation response
 */
export interface BulkInsertResponse extends BaseResponse {
  insertedCount: number;
  insertedIds: string[];
  records: RowData[];
}

/**
 * Get operation response
 */
export interface GetResponse extends BaseResponse {
  record: RowData | null;
  found: boolean;
}

/**
 * Update operation response
 */
export interface UpdateResponse extends BaseResponse {
  matchedCount: number;
  modifiedCount: number;
  record?: RowData | null;
}

/**
 * Delete operation response
 */
export interface DeleteResponse extends BaseResponse {
  deletedCount: number;
  acknowledged: boolean;
}

/**
 * Count operation response
 */
export interface CountResponse extends BaseResponse {
  count: number;
}

/**
 * Table creation response
 */
export interface CreateTableResponse extends BaseResponse {
  table: {
    database: string;
    table: string;
    schema: BinDBSchemaField[];
  };
  created: boolean;
}

/**
 * Error response
 */
export interface ErrorResponse extends BaseResponse {
  error: string;
  success: false;
  code?: string | number;
  stack?: string[];
}

/**
 * Pagination information
 */
export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  pages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

/**
 * Pagination response
 */
export interface PaginationResponse extends BaseResponse {
  records: RowData[];
  pagination: PaginationInfo;
}

/**
 * Health check response
 */
export interface HealthResponse {
  status: string;
  timestamp: string | number;
  version?: string;
  uptime?: number;
  databases: Record<string, any>;
  performance: Record<string, any>;
}

/**
 * API information response
 */
export interface ApiInfoResponse {
  name: string;
  version: string;
  description: string;
  endpoints: string[];
  features: string[];
  documentation: string | null;
}

/**
 * Standard response wrapper
 */
export interface StandardResponse<T = any> extends BaseResponse {
  success: true;
  data: T;
}

/**
 * Update result data
 */
export interface UpdateResultData {
  matchedCount: number;
  modifiedCount: number;
  record?: RowData | null;
}

/**
 * Delete result data
 */
export interface DeleteResultData {
  deletedCount: number;
}

/**
 * Table creation result data
 */
export interface CreateTableResultData {
  database: string;
  table: string;
  schema: BinDBSchemaField[];
}

/**
 * Pagination data
 */
export interface PaginationData {
  page?: number;
  limit?: number;
  total?: number;
  hasNext?: boolean;
  hasPrev?: boolean;
}

/**
 * Health check data
 */
export interface HealthData {
  status?: string;
  version?: string;
  uptime?: number;
  databases?: Record<string, any>;
  performance?: Record<string, any>;
}

/**
 * API information data
 */
export interface ApiInfoData {
  name?: string;
  version?: string;
  description?: string;
  endpoints?: string[];
  features?: string[];
  documentation?: string | null;
}

/**
 * ResultFormatter - Handles formatting of database operation results for API responses
 */
export class ResultFormatter {
  private config: Required<FormattingConfig>;

  constructor(options: FormattingConfig = {}) {
    this.config = {
      includeMetadata: options.includeMetadata !== false,
      includeTiming: options.includeTiming !== false,
      includeStats: options.includeStats !== false,
      dateFormat: options.dateFormat || 'iso',
      ...options
    } as Required<FormattingConfig>;
  }

  /**
   * Format insert operation result
   */
  formatInsertResult(result: RowData, metadata: OperationMetadata = {}): InsertResponse {
    const response: InsertResponse = {
      insertedId: result.id as string,
      record: this.formatRecord(result)
    };

    if (this.config.includeMetadata) {
      response.metadata = {
        operation: 'insert',
        table: metadata.table,
        database: metadata.database,
        ...this.getTimingInfo(metadata)
      } as any;
    }

    return response;
  }

  /**
   * Format bulk insert operation result
   */
  formatBulkInsertResult(results: RowData[], metadata: OperationMetadata = {}): BulkInsertResponse {
    const insertedIds = results.map(record => record.id as string);
    
    const response: BulkInsertResponse = {
      insertedCount: results.length,
      insertedIds,
      records: results.map(record => this.formatRecord(record))
    };

    if (this.config.includeMetadata) {
      response.metadata = {
        operation: 'bulkInsert',
        table: metadata.table,
        database: metadata.database,
        batchInfo: metadata.batchInfo,
        ...this.getTimingInfo(metadata)
      } as any;
    }

    return response;
  }

  /**
   * Format get operation result
   */
  formatGetResult(result: RowData | null, metadata: OperationMetadata = {}): GetResponse {
    const response: GetResponse = {
      record: result ? this.formatRecord(result) : null,
      found: !!result
    };

    if (this.config.includeMetadata) {
      response.metadata = {
        operation: 'get',
        table: metadata.table,
        database: metadata.database,
        id: metadata.id,
        ...this.getTimingInfo(metadata)
      } as any;
    }

    return response;
  }

  /**
   * Format update operation result
   */
  formatUpdateResult(result: UpdateResultData, metadata: OperationMetadata = {}): UpdateResponse {
    const response: UpdateResponse = {
      matchedCount: result.matchedCount || 0,
      modifiedCount: result.modifiedCount || 0,
      record: result.record ? this.formatRecord(result.record) : null
    };

    if (this.config.includeMetadata) {
      response.metadata = {
        operation: 'update',
        table: metadata.table,
        database: metadata.database,
        id: metadata.id,
        fieldsUpdated: metadata.fieldsUpdated,
        ...this.getTimingInfo(metadata)
      } as any;
    }

    return response;
  }

  /**
   * Format delete operation result
   */
  formatDeleteResult(result: DeleteResultData, metadata: OperationMetadata = {}): DeleteResponse {
    const response: DeleteResponse = {
      deletedCount: result.deletedCount || 0,
      acknowledged: true
    };

    if (this.config.includeMetadata) {
      response.metadata = {
        operation: 'delete',
        table: metadata.table,
        database: metadata.database,
        id: metadata.id,
        ...this.getTimingInfo(metadata)
      } as any;
    }

    return response;
  }

  /**
   * Format count operation result
   */
  formatCountResult(count: number, metadata: OperationMetadata = {}): CountResponse {
    const response: CountResponse = {
      count: count || 0
    };

    if (this.config.includeMetadata) {
      response.metadata = {
        operation: 'count',
        table: metadata.table,
        database: metadata.database,
        ...this.getTimingInfo(metadata)
      } as any;
    }

    return response;
  }

  /**
   * Format table creation result
   */
  formatCreateTableResult(result: CreateTableResultData, metadata: OperationMetadata = {}): CreateTableResponse {
    const response: CreateTableResponse = {
      table: {
        database: result.database,
        table: result.table,
        schema: result.schema
      },
      created: true
    };

    if (this.config.includeMetadata) {
      response.metadata = {
        operation: 'createTable',
        columnsCount: result.schema?.length || 0,
        ...this.getTimingInfo(metadata)
      };
    }

    return response;
  }

  /**
   * Format a single record
   */
  formatRecord(record: RowData): RowData {
    if (!record || typeof record !== 'object') {
      return record;
    }

    const formatted: RowData = { ...record };

    // Format dates according to configuration
    for (const [key, value] of Object.entries(formatted)) {
      if (value instanceof Date) {
        formatted[key] = this.formatDate(value);
      }
    }

    return formatted;
  }

  /**
   * Format date according to configuration
   */
  formatDate(date: Date): string | number {
    switch (this.config.dateFormat) {
      case 'timestamp':
        return date.getTime();
      case 'unix':
        return Math.floor(date.getTime() / 1000);
      case 'iso':
      default:
        return date.toISOString();
    }
  }

  /**
   * Get timing information for metadata
   */
  private getTimingInfo(metadata: OperationMetadata): TimingInfo {
    if (!this.config.includeTiming) {
      return {};
    }

    const timing: { duration?: number; timestamp: string | number } = {
      timestamp: metadata.timestamp 
        ? this.formatDate(new Date(metadata.timestamp))
        : this.formatDate(new Date())
    };
    
    if (metadata.startTime && metadata.endTime) {
      timing.duration = metadata.endTime - metadata.startTime;
    }

    return { timing };
  }

  /**
   * Format error result
   */
  formatError(error: Error, metadata: OperationMetadata = {}): ErrorResponse {
    const response: ErrorResponse = {
      error: error.message || 'Unknown error',
      success: false
    };

    if ('code' in error && error.code) {
      response.code = error.code as string | number;
    }

    if (this.config.includeMetadata) {
      response.metadata = {
        operation: metadata.operation || 'unknown',
        errorType: error.name || 'Error',
        ...this.getTimingInfo(metadata)
      };
    }

    // Include stack trace in development
    if (process.env.NODE_ENV === 'development' && error.stack) {
      response.stack = error.stack.split('\n');
    }

    return response;
  }

  /**
   * Format pagination result
   */
  formatPaginationResult(
    records: RowData[], 
    pagination: PaginationData, 
    metadata: OperationMetadata = {}
  ): PaginationResponse {
    const response: PaginationResponse = {
      records: records.map(record => this.formatRecord(record)),
      pagination: {
        page: pagination.page || 1,
        limit: pagination.limit || 10,
        total: pagination.total || 0,
        pages: Math.ceil((pagination.total || 0) / (pagination.limit || 10)),
        hasNext: pagination.hasNext || false,
        hasPrev: pagination.hasPrev || false
      }
    };

    if (this.config.includeMetadata) {
      response.metadata = {
        operation: 'paginate',
        table: metadata.table,
        database: metadata.database,
        recordsInPage: records.length,
        ...this.getTimingInfo(metadata)
      } as any;
    }

    return response;
  }

  /**
   * Format health check result
   */
  formatHealthResult(healthData: HealthData): HealthResponse {
    return {
      status: healthData.status || 'healthy',
      timestamp: this.formatDate(new Date()),
      version: healthData.version,
      uptime: healthData.uptime,
      databases: healthData.databases || {},
      performance: healthData.performance || {}
    } as any;
  }

  /**
   * Format API information result
   */
  formatApiInfoResult(apiInfo: ApiInfoData): ApiInfoResponse {
    return {
      name: apiInfo.name || 'BinDB Engine API',
      version: apiInfo.version || '1.0.0',
      description: apiInfo.description || 'Binary database engine HTTP API',
      endpoints: apiInfo.endpoints || [],
      features: apiInfo.features || [],
      documentation: apiInfo.documentation || null
    };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<FormattingConfig>): void {
    this.config = {
      ...this.config,
      ...newConfig
    } as Required<FormattingConfig>;
  }

  /**
   * Get current configuration
   */
  getConfig(): Required<FormattingConfig> {
    return { ...this.config };
  }

  /**
   * Create a standardized response wrapper
   */
  wrapResponse<T = any>(data: T, metadata: OperationMetadata = {}): StandardResponse<T> {
    const response: StandardResponse<T> = {
      success: true,
      data
    };

    if (this.config.includeMetadata && Object.keys(metadata).length > 0) {
      response.metadata = {
        ...metadata,
        ...this.getTimingInfo(metadata)
      };
    }

    return response;
  }

  /**
   * Format validation error
   */
  formatValidationError(
    message: string, 
    field?: string, 
    value?: any, 
    metadata: OperationMetadata = {}
  ): ErrorResponse {
    const error = new Error(message);
    error.name = 'ValidationError';
    (error as any).field = field;
    (error as any).value = value;
    
    return this.formatError(error, metadata);
  }

  /**
   * Format not found error
   */
  formatNotFoundError(
    resource: string, 
    id?: string, 
    metadata: OperationMetadata = {}
  ): ErrorResponse {
    const message = id 
      ? `${resource} with id '${id}' not found`
      : `${resource} not found`;
    
    const error = new Error(message);
    error.name = 'NotFoundError';
    
    return this.formatError(error, metadata);
  }

  /**
   * Check if response indicates success
   */
  isSuccessResponse(response: BaseResponse): boolean {
    return response.success !== false;
  }

  /**
   * Extract timing from response metadata
   */
  extractTiming(response: BaseResponse): { duration?: number; timestamp?: string | number } | null {
    return response.metadata?.timing || null;
  }
}