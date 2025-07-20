import { readColumn, type BufferSchema } from './buffer-utils.js';
import { ID_FIELD } from './constants.js';
import {
  RowStatus,
  dataRowToBufferWithGenerated,
  parseDataRow,
  type RowData,
  type SerializationResult,
} from './row.js';
import type { Schema } from './schema.js';
import { SlotManager, type SlotData, type SlotStats } from './slot-manager.js';
import {
  TableCacheManager,
  type TableCacheStats,
} from './table-cache-manager.js';
import { TableMetrics, type ComprehensiveStats } from './table-metrics.js';
import { TableStorageManager } from './table-storage-manager.js';

/**
 * Bulk insert write operation
 */
interface BulkWriteOperation {
  slot: number;
  buffer: Buffer;
  position: number;
}

/**
 * Table class for database operations
 * Forward declaration to avoid circular dependency
 */
interface Database {
  name: string;
}

/**
 * Table - Orchestrates table operations using specialized managers
 */
export class Table {
  public readonly database: Database;
  public readonly name: string;

  private slotManager: SlotManager;
  private storageManager: TableStorageManager;
  private cacheManager: TableCacheManager;
  private metrics: TableMetrics;

  constructor(storageBasePath: string, database: Database, name: string) {
    this.database = database;
    this.name = name;

    // Initialize specialized managers
    this.slotManager = new SlotManager();
    this.storageManager = new TableStorageManager(
      storageBasePath,
      database.name,
      name
    );
    this.metrics = new TableMetrics();

    // Initialize cache manager with write callback
    this.cacheManager = new TableCacheManager({
      readCacheSize: 1000,
      maxBufferSize: 50 * 1024 * 1024, // 50MB
      maxBufferRecords: 10000, // 10k records
      writeFlushCallback: async writes => {
        await this.storageManager.writeData(writes);
      },
    });
  }

  /**
   * Initialize table with schema
   */
  async initTable(schema: Schema): Promise<void> {
    await this.storageManager.initTable(schema);
  }

  /**
   * Load schema from storage
   */
  async loadSchema(force: boolean = false): Promise<void> {
    await this.storageManager.loadSchema(force);
  }

  /**
   * Load table data and initialize slot manager
   */
  async loadTable(): Promise<void> {
    await this.loadSchema();
    const stat = await this.storageManager.getFileStats();
    const size = stat.size;
    const bufferSchema = this.storageManager.getBufferSchema();

    let slot = 0;
    const slotData: SlotData[] = [];

    for (let pos = 0; pos < size; pos += bufferSchema.size) {
      const flagBuffer = await this.storageManager.readData(1, pos);
      const rowFlag = flagBuffer.readUInt8(0);

      if (rowFlag === RowStatus.Deleted) {
        slotData.push({ slot, id: null });
      } else {
        const idSize = bufferSchema.schema[ID_FIELD].nullFlag + 1;
        const buffer = await this.storageManager.readData(idSize, pos);
        const id = readColumn(buffer, bufferSchema, ID_FIELD) as string;
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

  /**
   * Get a record by ID
   */
  async get(id: string): Promise<RowData | null> {
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
        if (data) {
          this.cacheManager.setInReadCache(id, data);
          this.metrics.recordRead(performance.now() - startTime, true);
          return data;
        }
      }
    }

    // Read from disk
    const bufferSchema = this.storageManager.getBufferSchema();
    const buffer = await this.storageManager.readData(
      bufferSchema.size,
      this.storageManager.getOffset(slot + 1)
    );

    const data = parseDataRow(bufferSchema, buffer);
    if (data) {
      this.cacheManager.setInReadCache(id, data);
    }
    this.metrics.recordRead(performance.now() - startTime, false);

    return data;
  }

  /**
   * Insert a single record
   */
  async insert(row: RowData): Promise<RowData> {
    const startTime = performance.now();
    const bufferSchema = this.storageManager.getBufferSchema();
    const { buffer, generatedValues }: SerializationResult =
      dataRowToBufferWithGenerated(bufferSchema, row);

    // Merge input with generated values (efficient - no parsing!)
    const resultData: RowData = { ...row, ...generatedValues };
    const id = resultData[ID_FIELD] as string;

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
   */
  async bulkInsert(rows: RowData[]): Promise<RowData[]> {
    if (!Array.isArray(rows) || rows.length === 0) {
      return [];
    }

    const startTime = performance.now();
    const bufferSchema = this.storageManager.getBufferSchema();
    const results: RowData[] = [];
    const writeOperations: BulkWriteOperation[] = [];

    // Phase 1: Prepare all data and allocate slots
    for (let i = 0; i < rows.length; i++) {
      const { buffer, generatedValues }: SerializationResult =
        dataRowToBufferWithGenerated(bufferSchema, rows[i]);
      const resultData: RowData = { ...rows[i], ...generatedValues };
      const id = resultData[ID_FIELD] as string;

      // Allocate slot
      const slot = this.slotManager.allocateSlot(id);

      results.push(resultData);
      writeOperations.push({
        slot: slot + 1,
        buffer,
        position: this.storageManager.getOffset(slot + 1),
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
   */
  async update(id: string, updates: Partial<RowData>): Promise<RowData | null> {
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
    const updated: RowData = { ...current, ...updates };
    updated[ID_FIELD] = id; // Preserve the original ID

    // Create new buffer with updated data
    const bufferSchema = this.storageManager.getBufferSchema();
    const { buffer }: SerializationResult = dataRowToBufferWithGenerated(
      bufferSchema,
      updated
    );

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
   */
  async delete(id: string): Promise<boolean> {
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

  /**
   * Flush all pending writes
   */
  async flush(): Promise<void> {
    await this.cacheManager.flushWrites();
  }

  /**
   * Close table and release resources
   */
  async close(): Promise<void> {
    // Ensure all data is written before closing
    await this.flush();

    // Close storage manager
    await this.storageManager.close();

    // Clear caches
    this.cacheManager.clearAll();
  }

  getStats(): ComprehensiveStats {
    return this.metrics.getComprehensiveStats(
      this.slotManager.getStats(),
      this.cacheManager.getStats()
    );
  }

  getWriteBufferStats(): any {
    return this.cacheManager.getWriteBufferStats();
  }

  getReadCacheStats(): any {
    return this.cacheManager.getReadCacheStats();
  }

  getSlotStats(): SlotStats {
    return this.slotManager.getStats();
  }

  getCacheStats(): TableCacheStats {
    return this.cacheManager.getStats();
  }

  /**
   * Get all records (for compatibility)
   */
  async getAll(): Promise<RowData[]> {
    const results: RowData[] = [];
    const activeIds = this.slotManager.getActiveIds();

    for (const id of activeIds) {
      const record = await this.get(id);
      if (record) {
        results.push(record);
      }
    }

    return results;
  }

  getSchema(): Schema {
    return this.storageManager.getSchema();
  }

  getBufferSchema(): BufferSchema {
    return this.storageManager.getBufferSchema();
  }

  get isLoaded(): boolean {
    return this.storageManager.isSchemaLoaded;
  }

  get recordCount(): number {
    return this.slotManager.allocatedCount;
  }
}
