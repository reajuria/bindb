import { Database } from '../engine/database.js';
import { Schema } from '../engine/schema.js';
import { Types } from '../engine/column.js';

export class DatabaseManager {
  constructor() {
    this.databases = new Map();
    this.storagePath = process.env.BINDB_STORAGE_PATH || './data';
  }

  /**
   * Get or create a database
   * @param {string} name Database name
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
   * @param {string} database Database name
   * @param {string} table Table name
   * @param {Array} schema Schema definition
   * @returns {Object} Table info
   */
  async createTable(database, table, schema) {
    const db = await this.getDatabase(database);
    
    // Convert schema to BinDB format
    const columns = schema.map(field => ({
      name: field.name,
      type: this.mapType(field.type),
      length: field.length,
      default: field.default
    }));

    const tableSchema = Schema.create(database, table, columns);
    await db.createTable(table, tableSchema);
    
    return {
      database,
      table,
      schema: columns
    };
  }

  /**
   * Map common types to BinDB types
   * @param {string} type Data type
   * @returns {string} BinDB type
   */
  mapType(type) {
    const typeMap = {
      'string': Types.Text,
      'text': Types.Text,
      'number': Types.Number,
      'double': Types.Number,
      'int': Types.Number,
      'integer': Types.Number,
      'boolean': Types.Boolean,
      'bool': Types.Boolean,
      'date': Types.Date,
      'timestamp': Types.Date,
      'coordinates': Types.Coordinates,
      'location': Types.Coordinates,
      'buffer': Types.Buffer,
      'binary': Types.Buffer
    };

    return typeMap[type?.toLowerCase()] || Types.Text;
  }

  /**
   * Insert one record
   * @param {string} database Database name
   * @param {string} table Table name
   * @param {Object} record Record to insert
   * @returns {Object} Inserted record
   */
  async insertOne(database, table, record) {
    const db = await this.getDatabase(database);
    const tableInstance = db.table(table);
    return await tableInstance.insert(record);
  }

  /**
   * Insert multiple records with chunking for large datasets
   * @param {string} database Database name
   * @param {string} table Table name
   * @param {Array} records Records to insert
   * @returns {Array} Inserted records
   */
  async insertMany(database, table, records) {
    if (!Array.isArray(records) || records.length === 0) {
      return [];
    }

    const db = await this.getDatabase(database);
    const tableInstance = db.table(table);
    
    // Chunk large requests to 1000 items max per batch
    const BATCH_SIZE = 1000;
    if (records.length <= BATCH_SIZE) {
      return await tableInstance.bulkInsert(records);
    }
    
    // Process in batches
    const results = [];
    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, i + BATCH_SIZE);
      const batchResults = await tableInstance.bulkInsert(batch);
      results.push(...batchResults);
    }
    
    return results;
  }

  /**
   * Find one record by ID
   * @param {string} database Database name
   * @param {string} table Table name
   * @param {Object} filter Filter criteria (must contain id)
   * @returns {Object|null} Found record
   */
  async findOne(database, table, filter) {
    const db = await this.getDatabase(database);
    const tableInstance = db.table(table);
    
    if (filter.id) {
      return await tableInstance.get(filter.id);
    }
    
    return null;
  }

  /**
   * Update one record by ID
   * @param {string} database Database name
   * @param {string} table Table name
   * @param {Object} filter Filter criteria (must contain id)
   * @param {Object} update Update data
   * @returns {Object} Update result
   */
  async updateOne(database, table, filter, update) {
    const db = await this.getDatabase(database);
    const tableInstance = db.table(table);
    
    if (filter.id) {
      const updateData = update.$set || update;
      const updated = await tableInstance.update(filter.id, updateData);
      return { 
        matchedCount: updated ? 1 : 0, 
        modifiedCount: updated ? 1 : 0,
        record: updated
      };
    }
    
    return { matchedCount: 0, modifiedCount: 0 };
  }

  /**
   * Delete one record by ID
   * @param {string} database Database name
   * @param {string} table Table name
   * @param {Object} filter Filter criteria (must contain id)
   * @returns {Object} Delete result
   */
  async deleteOne(database, table, filter) {
    const db = await this.getDatabase(database);
    const tableInstance = db.table(table);
    
    if (filter.id) {
      const deleted = await tableInstance.delete(filter.id);
      return { deletedCount: deleted ? 1 : 0 };
    }
    
    return { deletedCount: 0 };
  }

  /**
   * Count records efficiently by counting active slots
   * @param {string} database Database name
   * @param {string} table Table name
   * @returns {number} Record count
   */
  async countRecords(database, table) {
    const db = await this.getDatabase(database);
    const tableInstance = db.table(table);
    
    // Use table stats for efficient counting
    const stats = tableInstance.getStats();
    return stats.records;
  }

  /**
   * Close all databases
   */
  async close() {
    for (const db of this.databases.values()) {
      await db.close();
    }
    this.databases.clear();
  }
}