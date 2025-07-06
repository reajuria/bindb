import fs from 'node:fs/promises';
import path from 'node:path';
import {
  RowStatus,
  dataRowToBufferWithGenerated,
  parseBufferSchema,
  parseDataRow,
} from './row.js';
import { Schema } from './schema.js';
import { readColumn } from './buffer-utils.js';
import { ID_FIELD } from './constants.js';
import { LRUCache } from './lru-cache.js';
import { FileManager } from './file-manager.js';
import { WriteBuffer } from './write-buffer.js';

export class Table {
  /**
   * @param {string} storageBasePath
   * @param {import('./database.js').Database} database
   * @param {string} name
   */
  constructor(storageBasePath, database, name) {
    this.storageBasePath = storageBasePath;
    this.database = database;
    this.name = name;
    this.idMap = [];
    this.idToSlot = new Map(); // Reverse lookup: id -> slot index  
    this.freeSlots = []; // Stack of available slots for reuse

    this.schemaFilePath = path.join(
      this.storageBasePath,
      database.name,
      `${name}.schema.json`
    );

    this.dataFilePath = path.join(
      this.storageBasePath,
      database.name,
      `${name}.data`
    );

    // Initialize extracted components
    this.readCache = new LRUCache(1000); // Cache up to 1000 records
    this.fileManager = new FileManager(this.dataFilePath);
    this.writeBuffer = new WriteBuffer({
      maxBufferSize: 50 * 1024 * 1024, // 50MB
      maxBufferRecords: 10000 // 10k records
    });

    // Set up write buffer flush callback
    this.writeBuffer.setFlushCallback(async (writes) => {
      await this.fileManager.writeMultiple(writes);
    });
  }

  /**
   * @param {import('./schema.js').Schema} schema
   * @returns {Promise<void>}
   */
  async initTable(schema) {
    schema.database = this.database.name;
    schema.table = this.name;
    await fs.writeFile(this.schemaFilePath, JSON.stringify(schema.toJSON()));
    await FileManager.ensureFile(this.dataFilePath);
    await this.loadSchema();
  }

  async loadSchema(force = false) {
    if (this.schema && !force) {
      return;
    }
    const schema = Schema.fromJSON(
      JSON.parse(await fs.readFile(this.schemaFilePath, 'utf8'))
    );
    this.schema = schema;
    this.bufferSchema = parseBufferSchema(schema);
  }

  async loadTable() {
    await this.loadSchema();
    const stat = await this.fileManager.stat();
    const size = stat.size;
    let slot = 0;
    this.freeSlots = []; // Reset free slots
    this.idToSlot.clear(); // Reset reverse lookup
    
    for (let pos = 0; pos < size; pos += this.bufferSchema.size) {
      const flagBuffer = await this.fileManager.read(1, pos);
      const rowFlag = flagBuffer.readUInt8(0);
      if (rowFlag === RowStatus.Deleted) {
        this.idMap[slot] = null;
        this.freeSlots.push(slot); // Track deleted slots for reuse
      } else {
        const idSize = this.bufferSchema.schema[ID_FIELD].nullFlag + 1;
        const buffer = await this.fileManager.read(idSize, pos);
        const id = readColumn(buffer, this.bufferSchema, ID_FIELD);
        this.idMap[slot] = id;
        this.idToSlot.set(id, slot); // Build reverse lookup
      }
      slot++;
    }

    console.log(
      `Loaded ${this.name} with ${this.idMap.filter((id) => id).length} rows`
    );
  }

  async get(id) {
    const slot = this.idToSlot.get(id);
    if (slot === undefined) {
      return null;
    }
    
    // Check read cache first (fastest)
    const cached = this.readCache.get(id);
    if (cached !== undefined) {
      return cached;
    }
    
    // Check if data is in write buffer second
    const bufferedData = this.writeBuffer.get(slot + 1);
    if (bufferedData) {
      const data = parseDataRow(this.bufferSchema, bufferedData.buffer);
      this.readCache.set(id, data);
      return data;
    }
    
    // Read from disk using FileManager
    const buffer = await this.fileManager.read(
      this.bufferSchema.size,
      this.getOffset(slot + 1)
    );
    
    const data = parseDataRow(this.bufferSchema, buffer);
    this.readCache.set(id, data);
    
    return data;
  }

  getOffset(slot) {
    return (slot === 0 ? 0 : slot - 1) * this.bufferSchema.size;
  }

  findEmptySlot() {
    // Reuse a deleted slot if available, otherwise append new slot
    return this.freeSlots.length > 0 
      ? this.freeSlots.pop() + 1  // Convert to 1-based index
      : this.idMap.length + 1;    // Append new slot
  }

  async insert(row) {
    const { buffer, generatedValues } = dataRowToBufferWithGenerated(this.bufferSchema, row);
    const slot = this.findEmptySlot();
    
    // Merge input with generated values (efficient - no parsing!)
    const resultData = { ...row, ...generatedValues };
    
    // Update in-memory structures immediately
    this.idMap[slot - 1] = resultData[ID_FIELD];
    this.idToSlot.set(resultData[ID_FIELD], slot - 1);
    
    // Add to write buffer (auto-flush handled internally)
    await this.writeBuffer.add(slot, buffer, this.getOffset(slot));
    
    return resultData;
  }

  /**
   * Insert multiple records in a single optimized operation
   * Uses Promise.all for optimal performance while maintaining proper API usage
   * @param {Array<object>} rows - Array of row objects to insert
   * @returns {Promise<Array<object>>} Array of inserted records with generated IDs
   */
  async bulkInsert(rows) {
    if (!Array.isArray(rows) || rows.length === 0) {
      return [];
    }

    const results = [];
    const writeOperations = [];
    
    // Phase 1: Prepare all data and in-memory updates
    for (let i = 0; i < rows.length; i++) {
      const slot = this.findEmptySlot();
      const { buffer, generatedValues } = dataRowToBufferWithGenerated(this.bufferSchema, rows[i]);
      
      // Merge input with generated values (efficient - no parsing!)
      const resultData = { ...rows[i], ...generatedValues };
      
      results.push(resultData);
      writeOperations.push({
        slot,
        buffer,
        position: this.getOffset(slot)
      });
      
      // Update in-memory structures immediately
      this.idMap[slot - 1] = resultData[ID_FIELD];
      this.idToSlot.set(resultData[ID_FIELD], slot - 1);
    }

    // Phase 2: Batch add all operations to write buffer using Promise.all
    // This approach maintains proper API usage for future indexing compatibility
    const promises = writeOperations.map(op => 
      this.writeBuffer.add(op.slot, op.buffer, op.position)
    );
    
    await Promise.all(promises);

    return results;
  }

  async flush() {
    await this.writeBuffer.flush();
  }

  async close() {
    // Ensure all data is written before closing
    await this.flush();
    
    // Close file manager (handles both read and write handles)
    await this.fileManager.close();
    
    // Clear read cache
    this.readCache.clear();
  }

  /**
   * Get performance statistics for the table
   * @returns {object} Performance statistics
   */
  getStats() {
    return {
      records: this.idMap.filter(id => id).length,
      freeSlots: this.freeSlots.length,
      cache: this.readCache.getStats(),
      writeBuffer: this.writeBuffer.getStats()
    };
  }

  /**
   * Get write buffer statistics
   * @returns {object} Write buffer stats
   */
  getWriteBufferStats() {
    return this.writeBuffer.getStats();
  }

  /**
   * Get read cache statistics
   * @returns {object} Read cache stats
   */
  getReadCacheStats() {
    return this.readCache.getStats();
  }
}
