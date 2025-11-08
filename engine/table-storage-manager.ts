import type { Stats } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { StorageError } from './errors';
import { FileManager, type WriteOperation } from './file-manager';
import { parseBufferSchema, type BufferSchema } from './row';
import { Schema } from './schema';

/**
 * Table storage paths
 */
export interface TableStoragePaths {
  schema: string;
  data: string;
}

/**
 * TableStorageManager - Handles table schema and data file operations
 */
export class TableStorageManager {
  public readonly storageBasePath: string;
  public readonly databaseName: string;
  public readonly tableName: string;
  public readonly schemaFilePath: string;
  public readonly dataFilePath: string;

  private fileManager: FileManager;
  private schema: Schema | null = null;
  private bufferSchema: BufferSchema | null = null;

  constructor(
    storageBasePath: string,
    databaseName: string,
    tableName: string
  ) {
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
  }

  /**
   * Initialize table with schema
   */
  async initTable(schema: Schema): Promise<void> {
    schema.database = this.databaseName;
    schema.table = this.tableName;
    await fs.writeFile(this.schemaFilePath, JSON.stringify(schema.toJSON()));
    await FileManager.ensureFile(this.dataFilePath);
    await this.loadSchema();
  }

  /**
   * Load schema from file
   */
  async loadSchema(force: boolean = false): Promise<void> {
    if (this.schema && !force) {
      return;
    }

    const schemaData = JSON.parse(
      await fs.readFile(this.schemaFilePath, 'utf8')
    );
    this.schema = Schema.fromJSON(schemaData);
    this.bufferSchema = parseBufferSchema(this.schema);
  }

  /**
   * Get current schema
   */
  getSchema(): Schema {
    if (!this.schema) {
      throw new StorageError(
        'Schema not loaded. Call loadSchema() first.',
        'getSchema',
        this.schemaFilePath
      );
    }
    return this.schema;
  }

  /**
   * Get current buffer schema
   */
  getBufferSchema(): BufferSchema {
    if (!this.bufferSchema) {
      throw new StorageError(
        'Buffer schema not loaded. Call loadSchema() first.',
        'getBufferSchema',
        this.schemaFilePath
      );
    }
    return this.bufferSchema;
  }

  /**
   * Get file manager for data operations
   */
  getFileManager(): FileManager {
    return this.fileManager;
  }

  /**
   * Get file statistics
   */
  async getFileStats(): Promise<Stats> {
    return await this.fileManager.stat();
  }

  /**
   * Calculate offset for a slot position
   * @param slot - 1-based slot number
   * @returns Byte offset in file
   */
  getOffset(slot: number): number {
    if (!this.bufferSchema) {
      throw new StorageError(
        'Buffer schema not loaded. Call loadSchema() first.',
        'getOffset'
      );
    }
    return (slot === 0 ? 0 : slot - 1) * this.bufferSchema.size;
  }

  /**
   * Read data from specific position
   */
  async readData(size: number, position: number): Promise<Buffer> {
    return await this.fileManager.read(size, position);
  }

  /**
   * Write data to specific position
   */
  async writeData(writes: WriteOperation[]): Promise<void> {
    await this.fileManager.writeMultiple(writes);
  }

  /**
   * Close storage manager and release resources
   */
  async close(): Promise<void> {
    await this.fileManager.close();
  }

  /**
   * Get storage paths
   */
  getPaths(): TableStoragePaths {
    return {
      schema: this.schemaFilePath,
      data: this.dataFilePath,
    };
  }

  /**
   * Check if schema file exists
   */
  async schemaExists(): Promise<boolean> {
    try {
      await fs.access(this.schemaFilePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if data file exists
   */
  async dataExists(): Promise<boolean> {
    try {
      await fs.access(this.dataFilePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get table file size in bytes
   */
  async getTableSize(): Promise<number> {
    try {
      const stats = await this.getFileStats();
      return stats.size;
    } catch {
      return 0;
    }
  }

  /**
   * Check if schema is loaded
   */
  get isSchemaLoaded(): boolean {
    return this.schema !== null && this.bufferSchema !== null;
  }

  /**
   * Get record size in bytes
   */
  get recordSize(): number {
    if (!this.bufferSchema) {
      throw new StorageError(
        'Buffer schema not loaded. Call loadSchema() first.',
        'recordSize'
      );
    }
    return this.bufferSchema.size;
  }
}
