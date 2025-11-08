import { Database } from '../engine/database';
import {
  MissingRequiredFieldError,
  TableNotFoundError,
} from '../engine/errors';
import type { RowData } from '../engine/row';
import { Schema } from '../engine/schema';
import { BatchProcessor, type BatchConfig } from './batch-processor';
import {
  ResultFormatter,
  type FormattingConfig,
  type OperationMetadata,
} from './result-formatter';
import {
  TypeMapper,
  type ExternalSchema,
  type SchemaValidationResult,
} from './type-mapper';

/**
 * Database manager configuration options
 */
export interface DatabaseManagerOptions {
  batch?: BatchConfig;
  formatting?: FormattingConfig;
  typeMapping?: Record<string, string>;
}

/**
 * Filter criteria for database operations
 */
export interface FilterCriteria {
  id: string;
  [key: string]: any;
}

/**
 * Update operation data
 */
export interface UpdateData {
  $set?: Record<string, any>;
  [key: string]: any;
}

/**
 * Database operation result types
 */
export interface OperationResult {
  success?: boolean;
  data?: any;
  error?: string;
  metadata?: OperationMetadata;
}

export interface InsertResult {
  insertedId: string;
  record: RowData;
  metadata?: OperationMetadata;
}

export interface BulkInsertResult {
  insertedCount: number;
  insertedIds: string[];
  records: RowData[];
  metadata?: OperationMetadata;
}

export interface UpdateResult {
  matchedCount: number;
  modifiedCount: number;
  record?: RowData | null;
  metadata?: OperationMetadata;
}

export interface DeleteResult {
  deletedCount: number;
  metadata?: OperationMetadata;
}

export interface CountResult {
  count: number;
  metadata?: OperationMetadata;
}

export interface GetResult {
  record: RowData | null;
  found: boolean;
  metadata?: OperationMetadata;
}

/**
 * Manager statistics
 */
export interface ManagerStats {
  databases: {
    active: number;
    names: string[];
  };
  batchProcessor: any;
  typeMapper: {
    supportedTypes: number;
  };
  resultFormatter: any;
}

/**
 * DatabaseManager - Manages database instances and operations
 */
export class DatabaseManager {
  private databases: Map<string, Database> = new Map();
  private storagePath: string;
  private typeMapper: TypeMapper;
  private batchProcessor: BatchProcessor;
  private resultFormatter: ResultFormatter;

  constructor(options: DatabaseManagerOptions = {}) {
    this.storagePath = process.env.BINDB_STORAGE_PATH || './data';

    // Initialize specialized components
    this.typeMapper = new TypeMapper();
    this.batchProcessor = new BatchProcessor(options.batch || {});
    this.resultFormatter = new ResultFormatter(options.formatting || {});
  }

  /**
   * Get or create a database
   */
  async getDatabase(name: string): Promise<Database> {
    if (!this.databases.has(name)) {
      const database = await Database.create(this.storagePath, name);
      this.databases.set(name, database);
    }
    return this.databases.get(name)!;
  }

  /**
   * Create a table with schema
   */
  async createTable(
    database: string,
    table: string,
    schema: ExternalSchema
  ): Promise<OperationResult> {
    const startTime = performance.now();

    try {
      // Validate and convert schema using TypeMapper
      const validationResult: SchemaValidationResult =
        this.typeMapper.validateSchema(schema);
      if (!validationResult.isValid) {
        throw new Error(
          `Schema validation failed: ${validationResult.errors.join(', ')}`
        );
      }

      const convertedSchema = this.typeMapper.convertSchema(schema);

      // Create table
      const db = await this.getDatabase(database);
      const tableSchema = Schema.create(
        database,
        table,
        convertedSchema as any
      );
      await db.createTable(table, tableSchema);

      const result = {
        database,
        table,
        schema: convertedSchema,
      };

      // Format result
      return this.resultFormatter.formatCreateTableResult(result, {
        database,
        table,
        startTime,
        endTime: performance.now(),
      });
    } catch (error) {
      return this.resultFormatter.formatError(error as Error, {
        operation: 'createTable',
        database,
        table,
        startTime,
        endTime: performance.now(),
      });
    }
  }

  /**
   * Insert one record
   */
  async insertOne(
    database: string,
    table: string,
    record: RowData
  ): Promise<InsertResult> {
    const startTime = performance.now();

    try {
      const db = await this.getDatabase(database);
      const tableInstance = db.table(table);
      if (!tableInstance) {
        throw new TableNotFoundError(database, table);
      }

      const result = await tableInstance.insert(record);

      return this.resultFormatter.formatInsertResult(result, {
        database,
        table,
        startTime,
        endTime: performance.now(),
      });
    } catch (error) {
      return this.resultFormatter.formatError(error as Error, {
        operation: 'insert',
        database,
        table,
        startTime,
        endTime: performance.now(),
      }) as any;
    }
  }

  /**
   * Insert multiple records with optimized batching
   */
  async insertMany(
    database: string,
    table: string,
    records: RowData[]
  ): Promise<BulkInsertResult> {
    const startTime = performance.now();

    try {
      if (!Array.isArray(records) || records.length === 0) {
        const result: RowData[] = [];
        return this.resultFormatter.formatBulkInsertResult(result, {
          database,
          table,
          startTime,
          endTime: performance.now(),
        });
      }

      const db = await this.getDatabase(database);
      const tableInstance = db.table(table);
      if (!tableInstance) {
        throw new TableNotFoundError(database, table);
      }

      // Use BatchProcessor for optimal chunking
      const processingResult = await this.batchProcessor.processBatches(
        records,
        async (batch: RowData[]) => await tableInstance.bulkInsert(batch)
      );

      return this.resultFormatter.formatBulkInsertResult(
        processingResult.results.flat(),
        {
          database,
          table,
          batchInfo: processingResult.statistics,
          startTime,
          endTime: performance.now(),
        }
      );
    } catch (error) {
      return this.resultFormatter.formatError(error as Error, {
        operation: 'bulkInsert',
        database,
        table,
        startTime,
        endTime: performance.now(),
      }) as any;
    }
  }

  /**
   * Find one record by ID
   */
  async findOne(
    database: string,
    table: string,
    filter: FilterCriteria
  ): Promise<GetResult> {
    const startTime = performance.now();

    try {
      if (!filter || !filter.id) {
        throw new MissingRequiredFieldError('id', 'filterOperation');
      }

      const db = await this.getDatabase(database);
      const tableInstance = db.table(table);
      if (!tableInstance) {
        throw new TableNotFoundError(database, table);
      }

      const result = await tableInstance.get(filter.id);

      return this.resultFormatter.formatGetResult(result, {
        database,
        table,
        id: filter.id,
        startTime,
        endTime: performance.now(),
      });
    } catch (error) {
      return this.resultFormatter.formatError(error as Error, {
        operation: 'findOne',
        database,
        table,
        id: filter?.id,
        startTime,
        endTime: performance.now(),
      }) as any;
    }
  }

  /**
   * Update one record by ID
   */
  async updateOne(
    database: string,
    table: string,
    filter: FilterCriteria,
    update: UpdateData
  ): Promise<UpdateResult> {
    const startTime = performance.now();

    try {
      if (!filter || !filter.id) {
        throw new MissingRequiredFieldError('id', 'filterOperation');
      }

      const db = await this.getDatabase(database);
      const tableInstance = db.table(table);
      if (!tableInstance) {
        throw new TableNotFoundError(database, table);
      }

      const updateData = update.$set || update;
      const result = await tableInstance.update(filter.id, updateData);

      const formattedResult = {
        matchedCount: result ? 1 : 0,
        modifiedCount: result ? 1 : 0,
        record: result,
      };

      return this.resultFormatter.formatUpdateResult(formattedResult, {
        database,
        table,
        id: filter.id,
        fieldsUpdated: Object.keys(updateData),
        startTime,
        endTime: performance.now(),
      });
    } catch (error) {
      return this.resultFormatter.formatError(error as Error, {
        operation: 'update',
        database,
        table,
        id: filter?.id,
        startTime,
        endTime: performance.now(),
      }) as any;
    }
  }

  /**
   * Delete one record by ID
   */
  async deleteOne(
    database: string,
    table: string,
    filter: FilterCriteria
  ): Promise<DeleteResult> {
    const startTime = performance.now();

    try {
      if (!filter || !filter.id) {
        throw new MissingRequiredFieldError('id', 'deleteOne');
      }

      const db = await this.getDatabase(database);
      const tableInstance = db.table(table);
      if (!tableInstance) {
        throw new TableNotFoundError(database, table);
      }

      const deleted = await tableInstance.delete(filter.id);

      const result = { deletedCount: deleted ? 1 : 0 };

      return this.resultFormatter.formatDeleteResult(result, {
        database,
        table,
        id: filter.id,
        startTime,
        endTime: performance.now(),
      });
    } catch (error) {
      return this.resultFormatter.formatError(error as Error, {
        operation: 'delete',
        database,
        table,
        id: filter?.id,
        startTime,
        endTime: performance.now(),
      }) as any;
    }
  }

  /**
   * Count records efficiently
   */
  async countRecords(database: string, table: string): Promise<CountResult> {
    const startTime = performance.now();

    try {
      const db = await this.getDatabase(database);
      const tableInstance = db.table(table);
      if (!tableInstance) {
        throw new TableNotFoundError(database, table);
      }

      // Use table stats for efficient counting
      const stats = tableInstance.getStats();
      const count = stats.slots.activeSlots;

      return this.resultFormatter.formatCountResult(count, {
        database,
        table,
        startTime,
        endTime: performance.now(),
      });
    } catch (error) {
      return this.resultFormatter.formatError(error as Error, {
        operation: 'count',
        database,
        table,
        startTime,
        endTime: performance.now(),
      }) as any;
    }
  }

  /**
   * Get database and table statistics
   */
  async getStats(database: string, table?: string): Promise<OperationResult> {
    const startTime = performance.now();

    try {
      const db = await this.getDatabase(database);

      if (table) {
        const tableInstance = db.table(table);
        if (!tableInstance) {
          throw new TableNotFoundError(database, table);
        }

        const tableStats = tableInstance.getStats();

        return this.resultFormatter.wrapResponse(
          {
            database,
            table,
            stats: tableStats,
          },
          {
            operation: 'getTableStats',
            startTime,
            endTime: performance.now(),
          }
        );
      } else {
        // Return database-level stats
        const databaseStats = {
          name: database,
          tables: db.getTableNames(),
          tableCount: db.tableCount,
          performance: this.batchProcessor.getPerformanceStats(),
        };

        return this.resultFormatter.wrapResponse(databaseStats, {
          operation: 'getDatabaseStats',
          startTime,
          endTime: performance.now(),
        });
      }
    } catch (error) {
      return this.resultFormatter.formatError(error as Error, {
        operation: 'getStats',
        database,
        table: table as any,
        startTime,
        endTime: performance.now(),
      });
    }
  }

  /**
   * Get component configurations and statistics
   */
  getManagerStats(): ManagerStats {
    return {
      databases: {
        active: this.databases.size,
        names: Array.from(this.databases.keys()),
      },
      batchProcessor: this.batchProcessor.getPerformanceStats(),
      typeMapper: {
        supportedTypes: Object.keys(this.typeMapper.getTypeMappings()).length,
      },
      resultFormatter: this.resultFormatter.getConfig(),
    };
  }

  /**
   * Update component configurations
   */
  updateConfig(config: DatabaseManagerOptions): void {
    if (config.batch) {
      this.batchProcessor.updateConfig(config.batch);
    }

    if (config.formatting) {
      this.resultFormatter.updateConfig(config.formatting);
    }

    if (config.typeMapping) {
      // Add custom type mappings
      for (const [external, bindb] of Object.entries(config.typeMapping)) {
        this.typeMapper.addTypeMapping(external, bindb);
      }
    }
  }

  /**
   * Close all databases and cleanup resources
   */
  async close(): Promise<void> {
    for (const db of this.databases.values()) {
      await db.close();
    }
    this.databases.clear();

    // Clear performance history
    this.batchProcessor.clearPerformanceHistory();
  }
}
