import { Database } from '../engine/database.js';
import { Schema } from '../engine/schema.js';
import { TypeMapper } from './type-mapper.js';
import { BatchProcessor } from './batch-processor.js';
import { ResultFormatter } from './result-formatter.js';

/**
 * DatabaseManager - Manages database instances and operations
 */
export class DatabaseManager {
  constructor(options = {}) {
    this.databases = new Map();
    this.storagePath = process.env.BINDB_STORAGE_PATH || './data';
    
    // Initialize specialized components
    this.typeMapper = new TypeMapper();
    this.batchProcessor = new BatchProcessor(options.batch || {});
    this.resultFormatter = new ResultFormatter(options.formatting || {});
  }

  /**
   * Get or create a database
   * @param {string} name - Database name
   * @returns {Promise<Database>} Database instance
   */
  async getDatabase(name) {
    if (!this.databases.has(name)) {
      const database = await Database.create(this.storagePath, name);
      this.databases.set(name, database);
    }
    return this.databases.get(name);
  }

  /**
   * Create a table with schema
   * @param {string} database - Database name
   * @param {string} table - Table name
   * @param {Array} schema - Schema definition
   * @returns {object} Formatted table creation result
   */
  async createTable(database, table, schema) {
    const startTime = performance.now();
    
    try {
      // Validate and convert schema using TypeMapper
      const validationResult = this.typeMapper.validateSchema(schema);
      if (!validationResult.isValid) {
        throw new Error(`Schema validation failed: ${validationResult.errors.join(', ')}`);
      }

      const convertedSchema = this.typeMapper.convertSchema(schema);
      
      // Create table
      const db = await this.getDatabase(database);
      const tableSchema = Schema.create(database, table, convertedSchema);
      await db.createTable(table, tableSchema);
      
      const result = {
        database,
        table,
        schema: convertedSchema
      };

      // Format result
      return this.resultFormatter.formatCreateTableResult(result, {
        database,
        table,
        startTime,
        endTime: performance.now()
      });

    } catch (error) {
      return this.resultFormatter.formatError(error, {
        operation: 'createTable',
        database,
        table,
        startTime,
        endTime: performance.now()
      });
    }
  }

  /**
   * Insert one record
   * @param {string} database - Database name
   * @param {string} table - Table name
   * @param {object} record - Record to insert
   * @returns {object} Formatted insert result
   */
  async insertOne(database, table, record) {
    const startTime = performance.now();
    
    try {
      const db = await this.getDatabase(database);
      const tableInstance = db.table(table);
      const result = await tableInstance.insert(record);

      return this.resultFormatter.formatInsertResult(result, {
        database,
        table,
        startTime,
        endTime: performance.now()
      });

    } catch (error) {
      return this.resultFormatter.formatError(error, {
        operation: 'insert',
        database,
        table,
        startTime,
        endTime: performance.now()
      });
    }
  }

  /**
   * Insert multiple records with optimized batching
   * @param {string} database - Database name
   * @param {string} table - Table name
   * @param {Array} records - Records to insert
   * @returns {object} Formatted bulk insert result
   */
  async insertMany(database, table, records) {
    const startTime = performance.now();
    
    try {
      if (!Array.isArray(records) || records.length === 0) {
        const result = [];
        return this.resultFormatter.formatBulkInsertResult(result, {
          database,
          table,
          startTime,
          endTime: performance.now()
        });
      }

      const db = await this.getDatabase(database);
      const tableInstance = db.table(table);

      // Use BatchProcessor for optimal chunking
      const processingResult = await this.batchProcessor.processBatches(
        records,
        async (batch) => await tableInstance.bulkInsert(batch)
      );

      return this.resultFormatter.formatBulkInsertResult(processingResult.results, {
        database,
        table,
        batchInfo: processingResult.statistics,
        startTime,
        endTime: performance.now()
      });

    } catch (error) {
      return this.resultFormatter.formatError(error, {
        operation: 'bulkInsert',
        database,
        table,
        startTime,
        endTime: performance.now()
      });
    }
  }

  /**
   * Find one record by ID
   * @param {string} database - Database name
   * @param {string} table - Table name
   * @param {object} filter - Filter criteria (must contain id)
   * @returns {object} Formatted get result
   */
  async findOne(database, table, filter) {
    const startTime = performance.now();
    
    try {
      if (!filter || !filter.id) {
        throw new Error('Filter must contain an id field');
      }

      const db = await this.getDatabase(database);
      const tableInstance = db.table(table);
      const result = await tableInstance.get(filter.id);

      return this.resultFormatter.formatGetResult(result, {
        database,
        table,
        id: filter.id,
        startTime,
        endTime: performance.now()
      });

    } catch (error) {
      return this.resultFormatter.formatError(error, {
        operation: 'findOne',
        database,
        table,
        id: filter?.id,
        startTime,
        endTime: performance.now()
      });
    }
  }

  /**
   * Update one record by ID
   * @param {string} database - Database name
   * @param {string} table - Table name
   * @param {object} filter - Filter criteria (must contain id)
   * @param {object} update - Update data
   * @returns {object} Formatted update result
   */
  async updateOne(database, table, filter, update) {
    const startTime = performance.now();
    
    try {
      if (!filter || !filter.id) {
        throw new Error('Filter must contain an id field');
      }

      const db = await this.getDatabase(database);
      const tableInstance = db.table(table);
      
      const updateData = update.$set || update;
      const result = await tableInstance.update(filter.id, updateData);
      
      const formattedResult = {
        matchedCount: result ? 1 : 0,
        modifiedCount: result ? 1 : 0,
        record: result
      };

      return this.resultFormatter.formatUpdateResult(formattedResult, {
        database,
        table,
        id: filter.id,
        fieldsUpdated: Object.keys(updateData),
        startTime,
        endTime: performance.now()
      });

    } catch (error) {
      return this.resultFormatter.formatError(error, {
        operation: 'update',
        database,
        table,
        id: filter?.id,
        startTime,
        endTime: performance.now()
      });
    }
  }

  /**
   * Delete one record by ID
   * @param {string} database - Database name
   * @param {string} table - Table name
   * @param {object} filter - Filter criteria (must contain id)
   * @returns {object} Formatted delete result
   */
  async deleteOne(database, table, filter) {
    const startTime = performance.now();
    
    try {
      if (!filter || !filter.id) {
        throw new Error('Filter must contain an id field');
      }

      const db = await this.getDatabase(database);
      const tableInstance = db.table(table);
      const deleted = await tableInstance.delete(filter.id);
      
      const result = { deletedCount: deleted ? 1 : 0 };

      return this.resultFormatter.formatDeleteResult(result, {
        database,
        table,
        id: filter.id,
        startTime,
        endTime: performance.now()
      });

    } catch (error) {
      return this.resultFormatter.formatError(error, {
        operation: 'delete',
        database,
        table,
        id: filter?.id,
        startTime,
        endTime: performance.now()
      });
    }
  }

  /**
   * Count records efficiently
   * @param {string} database - Database name
   * @param {string} table - Table name
   * @returns {object} Formatted count result
   */
  async countRecords(database, table) {
    const startTime = performance.now();
    
    try {
      const db = await this.getDatabase(database);
      const tableInstance = db.table(table);
      
      // Use table stats for efficient counting
      const stats = tableInstance.getStats();
      const count = stats.slots.activeSlots;

      return this.resultFormatter.formatCountResult(count, {
        database,
        table,
        startTime,
        endTime: performance.now()
      });

    } catch (error) {
      return this.resultFormatter.formatError(error, {
        operation: 'count',
        database,
        table,
        startTime,
        endTime: performance.now()
      });
    }
  }

  /**
   * Get database and table statistics
   * @param {string} database - Database name
   * @param {string} table - Table name (optional)
   * @returns {object} Database/table statistics
   */
  async getStats(database, table = null) {
    const startTime = performance.now();
    
    try {
      const db = await this.getDatabase(database);
      
      if (table) {
        const tableInstance = db.table(table);
        const tableStats = tableInstance.getStats();
        
        return this.resultFormatter.wrapResponse({
          database,
          table,
          stats: tableStats
        }, {
          operation: 'getTableStats',
          startTime,
          endTime: performance.now()
        });
      } else {
        // Return database-level stats
        const databaseStats = {
          name: database,
          tables: [], // Could be enhanced to list tables
          performance: this.batchProcessor.getPerformanceStats()
        };
        
        return this.resultFormatter.wrapResponse(databaseStats, {
          operation: 'getDatabaseStats',
          startTime,
          endTime: performance.now()
        });
      }

    } catch (error) {
      return this.resultFormatter.formatError(error, {
        operation: 'getStats',
        database,
        table,
        startTime,
        endTime: performance.now()
      });
    }
  }

  /**
   * Get component configurations and statistics
   * @returns {object} Manager statistics
   */
  getManagerStats() {
    return {
      databases: {
        active: this.databases.size,
        names: Array.from(this.databases.keys())
      },
      batchProcessor: this.batchProcessor.getPerformanceStats(),
      typeMapper: {
        supportedTypes: Object.keys(this.typeMapper.getTypeMappings()).length
      },
      resultFormatter: this.resultFormatter.getConfig()
    };
  }

  /**
   * Update component configurations
   * @param {object} config - Configuration updates
   */
  updateConfig(config) {
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
  async close() {
    for (const db of this.databases.values()) {
      await db.close();
    }
    this.databases.clear();
    
    // Clear performance history
    this.batchProcessor.clearPerformanceHistory();
  }
}