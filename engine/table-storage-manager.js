import fs from 'node:fs/promises';
import path from 'node:path';
import { FileManager } from './file-manager.js';
import { Schema } from './schema.js';
import { parseBufferSchema } from './row.js';

/**
 * TableStorageManager - Handles table schema and data file operations
 */
export class TableStorageManager {
  /**
   * @param {string} storageBasePath - Base storage path
   * @param {string} databaseName - Database name
   * @param {string} tableName - Table name
   */
  constructor(storageBasePath, databaseName, tableName) {
    this.storageBasePath = storageBasePath;
    this.databaseName = databaseName;
    this.tableName = tableName;
    
    this.schemaFilePath = path.join(
      storageBasePath,
      databaseName,
      `${tableName}.schema.json`
    );

    this.dataFilePath = path.join(
      storageBasePath,
      databaseName,
      `${tableName}.data`
    );

    this.fileManager = new FileManager(this.dataFilePath);
    this.schema = null;
    this.bufferSchema = null;
  }

  /**
   * Initialize table with schema
   * @param {import('./schema.js').Schema} schema - Table schema
   */
  async initTable(schema) {
    schema.database = this.databaseName;
    schema.table = this.tableName;
    await fs.writeFile(this.schemaFilePath, JSON.stringify(schema.toJSON()));
    await FileManager.ensureFile(this.dataFilePath);
    await this.loadSchema();
  }

  /**
   * Load schema from file
   * @param {boolean} force - Force reload even if already loaded
   */
  async loadSchema(force = false) {
    if (this.schema && !force) {
      return;
    }
    
    const schemaData = JSON.parse(await fs.readFile(this.schemaFilePath, 'utf8'));
    this.schema = Schema.fromJSON(schemaData);
    this.bufferSchema = parseBufferSchema(this.schema);
  }

  /**
   * Get current schema
   * @returns {import('./schema.js').Schema} Current schema
   */
  getSchema() {
    if (!this.schema) {
      throw new Error('Schema not loaded. Call loadSchema() first.');
    }
    return this.schema;
  }

  /**
   * Get current buffer schema
   * @returns {object} Current buffer schema
   */
  getBufferSchema() {
    if (!this.bufferSchema) {
      throw new Error('Buffer schema not loaded. Call loadSchema() first.');
    }
    return this.bufferSchema;
  }

  /**
   * Get file manager for data operations
   * @returns {FileManager} File manager instance
   */
  getFileManager() {
    return this.fileManager;
  }

  /**
   * Get file statistics
   * @returns {Promise<object>} File statistics
   */
  async getFileStats() {
    return await this.fileManager.stat();
  }

  /**
   * Calculate offset for a slot position
   * @param {number} slot - 1-based slot number
   * @returns {number} Byte offset in file
   */
  getOffset(slot) {
    if (!this.bufferSchema) {
      throw new Error('Buffer schema not loaded. Call loadSchema() first.');
    }
    return (slot === 0 ? 0 : slot - 1) * this.bufferSchema.size;
  }

  /**
   * Read data from specific position
   * @param {number} size - Number of bytes to read
   * @param {number} position - Position to read from
   * @returns {Promise<Buffer>} Data buffer
   */
  async readData(size, position) {
    return await this.fileManager.read(size, position);
  }

  /**
   * Write data to specific position
   * @param {Array<object>} writes - Array of write operations
   */
  async writeData(writes) {
    await this.fileManager.writeMultiple(writes);
  }

  /**
   * Close storage manager and release resources
   */
  async close() {
    await this.fileManager.close();
  }

  /**
   * Get storage paths
   * @returns {object} Storage file paths
   */
  getPaths() {
    return {
      schema: this.schemaFilePath,
      data: this.dataFilePath
    };
  }
}