import {
  RowStatus,
  dataRowToBufferWithGenerated,
  parseDataRow,
} from './row.js';
import { readColumn } from './buffer-utils.js';
import { ID_FIELD } from './constants.js';
import { SlotManager } from './slot-manager.js';
import { TableStorageManager } from './table-storage-manager.js';
import { TableCacheManager } from './table-cache-manager.js';
import { TableMetrics } from './table-metrics.js';

/**
 * Table - Orchestrates table operations using specialized managers
 */
export class Table {
  /**
   * @param {string} storageBasePath
   * @param {import('./database.js').Database} database
   * @param {string} name
   */
  constructor(storageBasePath, database, name) {
    this.database = database;
    this.name = name;

    // Initialize specialized managers
    this.slotManager = new SlotManager();
    this.storageManager = new TableStorageManager(storageBasePath, database.name, name);
    this.metrics = new TableMetrics();
    
    // Initialize cache manager with write callback
    this.cacheManager = new TableCacheManager({
      readCacheSize: 1000,
      maxBufferSize: 50 * 1024 * 1024, // 50MB
      maxBufferRecords: 10000,         // 10k records
      writeFlushCallback: async (writes) => {
        await this.storageManager.writeData(writes);
      }
    });
  }

  /**
   * @param {import('./schema.js').Schema} schema
   * @returns {Promise<void>}
   */
  async initTable(schema) {
    await this.storageManager.initTable(schema);
  }

  async loadSchema(force = false) {
    await this.storageManager.loadSchema(force);
  }

  async loadTable() {
    await this.loadSchema();
    const stat = await this.storageManager.getFileStats();
    const size = stat.size;
    const bufferSchema = this.storageManager.getBufferSchema();
    
    let slot = 0;
    const slotData = [];
    
    for (let pos = 0; pos < size; pos += bufferSchema.size) {
      const flagBuffer = await this.storageManager.readData(1, pos);
      const rowFlag = flagBuffer.readUInt8(0);
      
      if (rowFlag === RowStatus.Deleted) {
        slotData.push({ slot, id: null });
      } else {
        const idSize = bufferSchema.schema[ID_FIELD].nullFlag + 1;
        const buffer = await this.storageManager.readData(idSize, pos);
        const id = readColumn(buffer, bufferSchema, ID_FIELD);
        slotData.push({ slot, id });
      }
      slot++;
    }

    // Load slot data into slot manager
    this.slotManager.loadSlots(slotData);

    console.log(
      `Loaded ${this.name} with ${this.slotManager.getStats().activeSlots} rows`
    );
  }

  async get(id) {
    const startTime = performance.now();
    const slot = this.slotManager.getSlot(id);
    
    if (slot === undefined) {
      this.metrics.recordRead(performance.now() - startTime, false);
      return null;
    }
    
    // Check cache first
    const cacheHit = this.cacheManager.checkCache(id, slot + 1);
    if (cacheHit) {
      if (cacheHit.source === 'readCache') {
        this.metrics.recordRead(performance.now() - startTime, true);
        return cacheHit.data;
      } else {
        // Parse data from write buffer
        const bufferSchema = this.storageManager.getBufferSchema();
        const data = parseDataRow(bufferSchema, cacheHit.data.buffer);
        this.cacheManager.setInReadCache(id, data);
        this.metrics.recordRead(performance.now() - startTime, true);
        return data;
      }
    }
    
    // Read from disk
    const bufferSchema = this.storageManager.getBufferSchema();
    const buffer = await this.storageManager.readData(
      bufferSchema.size,
      this.storageManager.getOffset(slot + 1)
    );
    
    const data = parseDataRow(bufferSchema, buffer);
    this.cacheManager.setInReadCache(id, data);
    this.metrics.recordRead(performance.now() - startTime, false);
    
    return data;
  }

  async insert(row) {
    const startTime = performance.now();
    const bufferSchema = this.storageManager.getBufferSchema();
    const { buffer, generatedValues } = dataRowToBufferWithGenerated(bufferSchema, row);
    
    // Merge input with generated values (efficient - no parsing!)
    const resultData = { ...row, ...generatedValues };
    const id = resultData[ID_FIELD];
    
    // Allocate slot
    const slot = this.slotManager.allocateSlot(id);
    
    // Add to write buffer (auto-flush handled internally)
    await this.cacheManager.addToWriteBuffer(
      slot + 1, 
      buffer, 
      this.storageManager.getOffset(slot + 1)
    );
    
    this.metrics.recordWrite(performance.now() - startTime);
    return resultData;
  }

  /**
   * Insert multiple records in a single optimized operation
   * @param {Array<object>} rows - Array of row objects to insert
   * @returns {Promise<Array<object>>} Array of inserted records with generated IDs
   */
  async bulkInsert(rows) {
    if (!Array.isArray(rows) || rows.length === 0) {
      return [];
    }

    const startTime = performance.now();
    const bufferSchema = this.storageManager.getBufferSchema();
    const results = [];
    const writeOperations = [];
    
    // Phase 1: Prepare all data and allocate slots
    for (let i = 0; i < rows.length; i++) {
      const { buffer, generatedValues } = dataRowToBufferWithGenerated(bufferSchema, rows[i]);
      const resultData = { ...rows[i], ...generatedValues };
      const id = resultData[ID_FIELD];
      
      // Allocate slot
      const slot = this.slotManager.allocateSlot(id);
      
      results.push(resultData);
      writeOperations.push({
        slot: slot + 1,
        buffer,
        position: this.storageManager.getOffset(slot + 1)
      });
    }

    // Phase 2: Batch add all operations to write buffer
    const promises = writeOperations.map(op => 
      this.cacheManager.addToWriteBuffer(op.slot, op.buffer, op.position)
    );
    
    await Promise.all(promises);
    this.metrics.recordWrite(performance.now() - startTime);

    return results;
  }

  /**
   * Update a record by ID
   * @param {string} id - Record ID
   * @param {object} updates - Updated fields
   * @returns {Promise<object|null>} Updated record or null if not found
   */
  async update(id, updates) {
    const startTime = performance.now();
    const slot = this.slotManager.getSlot(id);
    
    if (slot === undefined) {
      this.metrics.recordUpdate(performance.now() - startTime);
      return null;
    }
    
    // Get current record
    const current = await this.get(id);
    if (!current) {
      this.metrics.recordUpdate(performance.now() - startTime);
      return null;
    }
    
    // Merge updates with current data
    const updated = { ...current, ...updates };
    updated[ID_FIELD] = id; // Preserve the original ID
    
    // Create new buffer with updated data
    const bufferSchema = this.storageManager.getBufferSchema();
    const { buffer } = dataRowToBufferWithGenerated(bufferSchema, updated);
    
    // Invalidate cache
    this.cacheManager.invalidateRecord(id);
    
    // Update via write buffer
    await this.cacheManager.addToWriteBuffer(
      slot + 1, 
      buffer, 
      this.storageManager.getOffset(slot + 1)
    );
    
    this.metrics.recordUpdate(performance.now() - startTime);
    return updated;
  }

  /**
   * Delete a record by ID
   * @param {string} id - Record ID
   * @returns {Promise<boolean>} True if deleted, false if not found
   */
  async delete(id) {
    const startTime = performance.now();
    const slot = this.slotManager.getSlot(id);
    
    if (slot === undefined) {
      this.metrics.recordDelete(performance.now() - startTime);
      return false;
    }
    
    // Create a buffer with deleted row status
    const bufferSchema = this.storageManager.getBufferSchema();
    const buffer = Buffer.alloc(bufferSchema.size);
    buffer.writeUInt8(RowStatus.Deleted, 0);
    
    // Deallocate slot
    this.slotManager.deallocateSlot(id);
    
    // Invalidate cache
    this.cacheManager.invalidateRecord(id);
    
    // Write deletion marker to disk
    await this.cacheManager.addToWriteBuffer(
      slot + 1, 
      buffer, 
      this.storageManager.getOffset(slot + 1)
    );
    
    this.metrics.recordDelete(performance.now() - startTime);
    return true;
  }

  async flush() {
    await this.cacheManager.flushWrites();
  }

  async close() {
    // Ensure all data is written before closing
    await this.flush();
    
    // Close storage manager
    await this.storageManager.close();
    
    // Clear caches
    this.cacheManager.clearAll();
  }

  /**
   * Get performance statistics for the table
   * @returns {object} Performance statistics
   */
  getStats() {
    return this.metrics.getComprehensiveStats(
      this.slotManager.getStats(),
      this.cacheManager.getStats()
    );
  }

  /**
   * Get write buffer statistics
   * @returns {object} Write buffer stats
   */
  getWriteBufferStats() {
    return this.cacheManager.getWriteBufferStats();
  }

  /**
   * Get read cache statistics
   * @returns {object} Read cache stats
   */
  getReadCacheStats() {
    return this.cacheManager.getReadCacheStats();
  }

  /**
   * Get all records (for compatibility)
   * @returns {Promise<Array<object>>} All active records
   */
  async getAll() {
    const results = [];
    const activeIds = this.slotManager.getActiveIds();
    
    for (const id of activeIds) {
      const record = await this.get(id);
      if (record) {
        results.push(record);
      }
    }
    
    return results;
  }
}