import { LRUCache, type CacheStats } from './lru-cache';
import {
  WriteBuffer,
  type BufferStats,
  type FlushCallback,
} from './write-buffer';

/**
 * Table cache manager configuration options
 */
export interface TableCacheManagerOptions {
  readCacheSize?: number;
  maxBufferSize?: number;
  maxBufferRecords?: number;
  writeFlushCallback?: FlushCallback | null;
}

/**
 * Cache hit information
 */
export interface CacheHit {
  source: 'readCache' | 'writeBuffer';
  data: any;
}

/**
 * Combined cache statistics
 */
export interface TableCacheStats {
  readCache: CacheStats;
  writeBuffer: BufferStats;
}

/**
 * TableCacheManager - Handles read caching and write buffering
 */
export class TableCacheManager {
  private readCache: LRUCache<string, any>;
  private writeBuffer: WriteBuffer;

  constructor(options: TableCacheManagerOptions = {}) {
    const {
      readCacheSize = 1000,
      maxBufferSize = 50 * 1024 * 1024, // 50MB
      maxBufferRecords = 10000, // 10k records
      writeFlushCallback = null,
    } = options;

    // Initialize read cache
    this.readCache = new LRUCache<string, any>(readCacheSize);

    // Initialize write buffer
    this.writeBuffer = new WriteBuffer({
      maxBufferSize,
      maxBufferRecords,
    });

    // Set up write buffer flush callback if provided
    if (writeFlushCallback) {
      this.writeBuffer.setFlushCallback(writeFlushCallback);
    }
  }

  /**
   * Set write flush callback
   */
  setWriteFlushCallback(callback: FlushCallback): void {
    this.writeBuffer.setFlushCallback(callback);
  }

  /**
   * Get item from read cache
   */
  getFromReadCache(key: string): any {
    return this.readCache.get(key);
  }

  /**
   * Store item in read cache
   */
  setInReadCache(key: string, value: any): void {
    this.readCache.set(key, value);
  }

  /**
   * Remove item from read cache
   */
  removeFromReadCache(key: string): boolean {
    return this.readCache.delete(key);
  }

  /**
   * Check if key exists in read cache
   */
  hasInReadCache(key: string): boolean {
    return this.readCache.has(key);
  }

  /**
   * Get item from write buffer
   */
  getFromWriteBuffer(slot: number): any {
    return this.writeBuffer.get(slot);
  }

  /**
   * Add item to write buffer
   */
  async addToWriteBuffer(
    slot: number,
    buffer: Buffer,
    position: number
  ): Promise<boolean> {
    return await this.writeBuffer.add(slot, buffer, position);
  }

  /**
   * Check if slot exists in write buffer
   */
  hasInWriteBuffer(slot: number): boolean {
    return this.writeBuffer.has(slot);
  }

  /**
   * Flush write buffer
   */
  async flushWrites(): Promise<void> {
    await this.writeBuffer.flush();
  }

  /**
   * Clear read cache
   */
  clearReadCache(): void {
    this.readCache.clear();
  }

  /**
   * Clear write buffer
   */
  clearWriteBuffer(): void {
    this.writeBuffer.clear();
  }

  /**
   * Clear all caches
   */
  clearAll(): void {
    this.clearReadCache();
    this.clearWriteBuffer();
  }

  /**
   * Get read cache statistics
   */
  getReadCacheStats(): CacheStats {
    return this.readCache.getStats();
  }

  /**
   * Get write buffer statistics
   */
  getWriteBufferStats(): BufferStats {
    return this.writeBuffer.getStats();
  }

  /**
   * Get combined cache statistics
   */
  getStats(): TableCacheStats {
    return {
      readCache: this.getReadCacheStats(),
      writeBuffer: this.getWriteBufferStats(),
    };
  }

  /**
   * Check if data exists in any cache layer
   */
  checkCache(id: string, slot: number): CacheHit | null {
    // Check read cache first
    const readCacheHit = this.readCache.get(id);
    if (readCacheHit !== undefined) {
      return {
        source: 'readCache',
        data: readCacheHit,
      };
    }

    // Check write buffer second
    const writeBufferHit = this.writeBuffer.get(slot);
    if (writeBufferHit) {
      return {
        source: 'writeBuffer',
        data: writeBufferHit,
      };
    }

    return null;
  }

  /**
   * Invalidate caches for a specific record
   */
  invalidateRecord(id: string): void {
    this.removeFromReadCache(id);
    // Note: Write buffer items are invalidated by position/slot,
    // which is handled at a higher level
  }

  /**
   * Get the current size of the read cache
   */
  get readCacheSize(): number {
    return this.readCache.size;
  }

  /**
   * Get the current number of records in write buffer
   */
  get writeBufferSize(): number {
    return this.writeBuffer.currentRecords;
  }

  /**
   * Check if write buffer is empty
   */
  get isWriteBufferEmpty(): boolean {
    return this.writeBuffer.isEmpty();
  }

  /**
   * Check if write buffer should be flushed
   */
  get shouldFlushWrites(): boolean {
    return this.writeBuffer.shouldFlush();
  }
}
