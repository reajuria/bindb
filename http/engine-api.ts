import { MissingRequiredFieldError, ValidationError } from '../engine/errors';
import { getLoggingContext, logger } from '../logging/index';
import type { App } from './app';
import {
  DatabaseManager,
  type DatabaseManagerOptions,
} from './database-manager';
import type { ExternalSchema } from './type-mapper';

/**
 * API request types
 */
export interface CreateTableRequest {
  database: string;
  table: string;
  schema: ExternalSchema;
}

export interface InsertRequest {
  database: string;
  table: string;
  data: Record<string, any>;
}

export interface BulkInsertRequest {
  database: string;
  table: string;
  data: Record<string, any>[];
}

export interface FindRequest {
  database: string;
  table: string;
  id: string;
}

export interface UpdateRequest {
  database: string;
  table: string;
  id: string;
  data: Record<string, any>;
}

export interface DeleteRequest {
  database: string;
  table: string;
  id: string;
}

export interface CountRequest {
  database: string;
  table: string;
}

export interface StatsRequest {
  database: string;
  table?: string;
}

/**
 * Engine API configuration
 */
export interface EngineAPIConfig extends DatabaseManagerOptions {
  enableMetrics?: boolean;
  enableDebugRoutes?: boolean;
  maxRequestSize?: number;
}

/**
 * Complete Engine API implementation with full database operations
 */
export class EngineAPI {
  private databaseManager: DatabaseManager;
  private config: EngineAPIConfig;
  private requestCount: number = 0;
  private startTime: number = Date.now();
  private app: App | null = null;

  constructor(options: EngineAPIConfig = {}) {
    this.config = {
      enableMetrics: true,
      enableDebugRoutes: false,
      maxRequestSize: 50 * 1024 * 1024, // 50MB
      ...options,
    };

    // Initialize database manager with configuration
    this.databaseManager = new DatabaseManager(options);
  }

  /**
   * Register Engine API routes with the app
   */
  registerRoutes(app: App): void {
    this.app = app;

    // Core database operations
    this.registerTableRoutes(app);
    this.registerDataRoutes(app);
    this.registerStatsRoutes(app);

    // Utility routes
    this.registerUtilityRoutes(app);

    // Debug routes (if enabled)
    if (this.config.enableDebugRoutes) {
      this.registerDebugRoutes(app);
    }
  }

  /**
   * Register table management routes
   */
  private registerTableRoutes(app: App): void {
    // Create table
    app.post('/v1/table/create', async req => {
      this.incrementRequestCount();

      try {
        const request = req.body as CreateTableRequest;
        this.validateRequest(request, ['database', 'table', 'schema']);

        const result = await this.databaseManager.createTable(
          request.database,
          request.table,
          request.schema
        );

        return result;
      } catch (error) {
        return this.handleError(error as Error, 'createTable');
      }
    });

    // List tables
    app.get('/v1/table/list', async req => {
      this.incrementRequestCount();

      try {
        const database = req.query?.database as string;
        if (!database) {
          throw new MissingRequiredFieldError('database', 'listTables');
        }

        const db = await this.databaseManager.getDatabase(database);
        const tables = db.getTableNames();

        return {
          success: true,
          database,
          tables,
          count: tables.length,
        };
      } catch (error) {
        return this.handleError(error as Error, 'listTables');
      }
    });

    // Get table schema
    app.get('/v1/table/schema', async req => {
      this.incrementRequestCount();

      try {
        const database = req.query?.database as string;
        const table = req.query?.table as string;

        if (!database || !table) {
          throw new MissingRequiredFieldError('database, table', 'operation');
        }

        const db = await this.databaseManager.getDatabase(database);
        const tableInstance = db.getTable(table);
        const schema = tableInstance.getSchema();

        return {
          success: true,
          database,
          table,
          schema: schema.toJSON(),
        };
      } catch (error) {
        return this.handleError(error as Error, 'getTableSchema');
      }
    });
  }

  /**
   * Register data manipulation routes
   */
  private registerDataRoutes(app: App): void {
    // Insert single record
    app.post('/v1/insert', async req => {
      this.incrementRequestCount();

      try {
        const request = req.body as InsertRequest;
        this.validateRequest(request, ['database', 'table', 'data']);

        const result = await this.databaseManager.insertOne(
          request.database,
          request.table,
          request.data
        );

        return result;
      } catch (error) {
        return this.handleError(error as Error, 'insert');
      }
    });

    // Bulk insert records
    app.post('/v1/bulkInsert', async req => {
      this.incrementRequestCount();

      try {
        const request = req.body as BulkInsertRequest;
        this.validateRequest(request, ['database', 'table', 'data']);

        if (!Array.isArray(request.data)) {
          throw new ValidationError(
            'Data must be an array for bulk insert',
            'data',
            typeof request.data
          );
        }

        const result = await this.databaseManager.insertMany(
          request.database,
          request.table,
          request.data
        );

        return result;
      } catch (error) {
        return this.handleError(error as Error, 'bulkInsert');
      }
    });

    // Find single record
    app.get('/v1/find', async req => {
      this.incrementRequestCount();

      try {
        const database = req.query?.database as string;
        const table = req.query?.table as string;
        const id = req.query?.id as string;

        if (!database || !table || !id) {
          throw new MissingRequiredFieldError('database, table, id', 'find');
        }

        const result = await this.databaseManager.findOne(database, table, {
          id,
        });

        return result;
      } catch (error) {
        return this.handleError(error as Error, 'find');
      }
    });

    // Update record
    app.put('/v1/update', async req => {
      this.incrementRequestCount();

      try {
        const request = req.body as UpdateRequest;
        this.validateRequest(request, ['database', 'table', 'id', 'data']);

        const result = await this.databaseManager.updateOne(
          request.database,
          request.table,
          { id: request.id },
          request.data
        );

        return result;
      } catch (error) {
        return this.handleError(error as Error, 'update');
      }
    });

    // Delete record
    app.delete('/v1/delete', async req => {
      this.incrementRequestCount();

      try {
        const request = req.body as DeleteRequest;
        this.validateRequest(request, ['database', 'table', 'id']);

        const result = await this.databaseManager.deleteOne(
          request.database,
          request.table,
          { id: request.id }
        );

        return result;
      } catch (error) {
        return this.handleError(error as Error, 'delete');
      }
    });

    // Count records
    app.get('/v1/count', async req => {
      this.incrementRequestCount();

      try {
        const database = req.query?.database as string;
        const table = req.query?.table as string;

        if (!database || !table) {
          throw new MissingRequiredFieldError('database, table', 'operation');
        }

        const result = await this.databaseManager.countRecords(database, table);
        return result;
      } catch (error) {
        return this.handleError(error as Error, 'count');
      }
    });
  }

  /**
   * Register statistics and monitoring routes
   */
  private registerStatsRoutes(app: App): void {
    // Get database/table stats
    app.get('/v1/stats', async req => {
      this.incrementRequestCount();

      try {
        const database = req.query?.database as string;
        const table = req.query?.table as string;

        if (!database) {
          throw new MissingRequiredFieldError('database', 'getStats');
        }

        const result = await this.databaseManager.getStats(database, table);
        return result;
      } catch (error) {
        return this.handleError(error as Error, 'getStats');
      }
    });

    // Get API metrics
    app.get('/v1/metrics', async _req => {
      this.incrementRequestCount();

      try {
        const uptime = Date.now() - this.startTime;
        const managerStats = this.databaseManager.getManagerStats();

        return {
          success: true,
          api: {
            uptime: uptime,
            requestCount: this.requestCount,
            requestsPerSecond: this.requestCount / (uptime / 1000),
            startTime: this.startTime,
          },
          manager: managerStats,
        };
      } catch (error) {
        return this.handleError(error as Error, 'getMetrics');
      }
    });
  }

  /**
   * Register utility routes
   */
  private registerUtilityRoutes(app: App): void {
    // Admin interface
    app.get('/v1/admin', async _req => {
      try {
        const fs = await import('fs/promises');
        const path = await import('path');
        const adminHtmlPath = path.join(process.cwd(), 'admin.html');
        const adminHtml = await fs.readFile(adminHtmlPath, 'utf-8');

        return {
          statusCode: 200,
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-cache',
          },
          body: adminHtml,
        };
      } catch (error) {
        return {
          statusCode: 500,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            error: 'Failed to load admin interface',
            message: (error as Error).message,
          }),
        };
      }
    });

    // Health check
    app.get('/v1/health', async _req => {
      try {
        const uptime = Date.now() - this.startTime;

        return {
          status: 'healthy',
          timestamp: new Date().toISOString(),
          uptime: uptime,
          version: '1.0.0',
          api: {
            requestCount: this.requestCount,
            enabledFeatures: {
              metrics: this.config.enableMetrics,
              debugRoutes: this.config.enableDebugRoutes,
            },
          },
        };
      } catch (error) {
        return {
          status: 'unhealthy',
          error: (error as Error).message,
          timestamp: new Date().toISOString(),
        };
      }
    });

    // API information
    app.get('/v1/info', async _req => {
      return {
        name: 'BinDB Engine API',
        version: '1.0.0',
        description: 'Binary database engine HTTP API with TypeScript',
        endpoints: [
          'POST /v1/table/create',
          'GET /v1/table/list',
          'GET /v1/table/schema',
          'POST /v1/insert',
          'POST /v1/bulkInsert',
          'GET /v1/find',
          'PUT /v1/update',
          'DELETE /v1/delete',
          'GET /v1/count',
          'GET /v1/stats',
          'GET /v1/metrics',
          'GET /v1/health',
          'GET /v1/info',
          'GET /v1/cors',
        ],
        features: [
          'Type-safe database operations',
          'Batch processing with optimization',
          'Performance monitoring',
          'Schema validation',
          'Comprehensive error handling',
          'CORS support',
        ],
      };
    });

    // CORS configuration
    app.get('/v1/cors', async _req => {
      return {
        success: true,
        cors: this.app?.getCORSConfig() || {},
        description: 'Current CORS configuration for the API',
        note: 'CORS is enabled by default with permissive settings for development. Configure for production use.',
      };
    });
  }

  /**
   * Register debug routes (development only)
   */
  private registerDebugRoutes(app: App): void {
    // Get all data (dangerous - development only)
    app.get('/v1/debug/all', async req => {
      try {
        const database = req.query?.database as string;
        const table = req.query?.table as string;

        if (!database || !table) {
          throw new MissingRequiredFieldError('database, table', 'operation');
        }

        const db = await this.databaseManager.getDatabase(database);
        const tableInstance = db.getTable(table);
        const records = await tableInstance.getAll();

        return {
          success: true,
          database,
          table,
          records,
          count: records.length,
          warning: 'This is a debug endpoint - not for production use',
        };
      } catch (error) {
        return this.handleError(error as Error, 'debugGetAll');
      }
    });

    // Flush all pending writes
    app.post('/v1/debug/flush', async req => {
      try {
        const database = req.query?.database as string;
        const table = req.query?.table as string;

        if (!database || !table) {
          throw new MissingRequiredFieldError('database, table', 'operation');
        }

        const db = await this.databaseManager.getDatabase(database);
        const tableInstance = db.getTable(table);
        await tableInstance.flush();

        return {
          success: true,
          message: 'All pending writes flushed',
          database,
          table,
        };
      } catch (error) {
        return this.handleError(error as Error, 'debugFlush');
      }
    });
  }

  /**
   * Validate request has required fields
   */
  private validateRequest(request: any, requiredFields: string[]): void {
    for (const field of requiredFields) {
      if (!request || request[field] === undefined || request[field] === null) {
        throw new MissingRequiredFieldError(field, 'request validation');
      }
    }
  }

  /**
   * Handle errors consistently
   */
  private handleError(error: Error, operation: string): any {
    // Log error with context
    logger.error(
      `API error in ${operation}`,
      {
        ...getLoggingContext(),
        operation,
        errorName: error.name,
        errorCode: (error as any).code,
      },
      error
    );

    const response: any = {
      success: false,
      error: error.message,
      operation,
      timestamp: new Date().toISOString(),
    };

    // Check if error is a BinDBError and extract HTTP status code
    if ('statusCode' in error && typeof error.statusCode === 'number') {
      response.statusCode = error.statusCode;
    }

    // Include error code if available
    if ('code' in error && error.code) {
      response.code = error.code;
    }

    // Include metadata if available
    if ('metadata' in error && error.metadata) {
      response.errorMetadata = error.metadata;
    }

    return response;
  }

  /**
   * Increment request counter for metrics
   */
  private incrementRequestCount(): void {
    if (this.config.enableMetrics) {
      this.requestCount++;
    }
  }

  /**
   * Update API configuration
   */
  updateConfig(newConfig: Partial<EngineAPIConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.databaseManager.updateConfig(newConfig);
  }

  /**
   * Get current configuration
   */
  getConfig(): EngineAPIConfig {
    return { ...this.config };
  }

  /**
   * Close the API and cleanup resources
   */
  async close(): Promise<void> {
    logger.info('Closing EngineAPI and cleaning up resources');
    await this.databaseManager.close();
    logger.info('EngineAPI closed successfully');
  }

  /**
   * Get API statistics
   */
  getStats(): {
    uptime: number;
    requestCount: number;
    requestsPerSecond: number;
    startTime: number;
    config: EngineAPIConfig;
  } {
    const uptime = Date.now() - this.startTime;

    return {
      uptime,
      requestCount: this.requestCount,
      requestsPerSecond: this.requestCount / (uptime / 1000),
      startTime: this.startTime,
      config: this.config,
    };
  }
}
