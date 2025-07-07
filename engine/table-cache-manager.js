import { LRUCache } from './lru-cache.js';
import { WriteBuffer } from './write-buffer.js';

/**
 * TableCacheManager - Handles read caching and write buffering
 */
export class TableCacheManager {
  /**
   * @param {object} options - Cache configuration options
   * @param {number} options.readCacheSize - Maximum number of items in read cache
   * @param {number} options.maxBufferSize - Maximum write buffer size in bytes
   * @param {number} options.maxBufferRecords - Maximum number of buffered records
   * @param {Function} options.writeFlushCallback - Callback for flushing writes
   */
  constructor(options = {}) {
    const {
      readCacheSize = 1000,
      maxBufferSize = 50 * 1024 * 1024, // 50MB
      maxBufferRecords = 10000,          // 10k records
      writeFlushCallback = null
    } = options;

    // Initialize read cache
    this.readCache = new LRUCache(readCacheSize);
    
    // Initialize write buffer
    this.writeBuffer = new WriteBuffer({
      maxBufferSize,
      maxBufferRecords
    });

    // Set up write buffer flush callback if provided
    if (writeFlushCallback) {
      this.writeBuffer.setFlushCallback(writeFlushCallback);
    }
  }

  /**
   * Set write flush callback
   * @param {Function} callback - Flush callback function
   */
  setWriteFlushCallback(callback) {
    this.writeBuffer.setFlushCallback(callback);
  }

  /**
   * Get item from read cache
   * @param {string} key - Cache key
   * @returns {any} Cached value or undefined
   */
  getFromReadCache(key) {
    return this.readCache.get(key);
  }

  /**
   * Store item in read cache
   * @param {string} key - Cache key
   * @param {any} value - Value to cache
   */
  setInReadCache(key, value) {
    this.readCache.set(key, value);
  }

  /**
   * Remove item from read cache
   * @param {string} key - Cache key
   */
  removeFromReadCache(key) {
    this.readCache.delete(key);
  }

  /**
   * Get item from write buffer
   * @param {number} slot - Slot number
   * @returns {object|null} Buffered data or null
   */
  getFromWriteBuffer(slot) {
    return this.writeBuffer.get(slot);
  }

  /**
   * Add item to write buffer
   * @param {number} slot - Slot number
   * @param {Buffer} buffer - Data buffer
   * @param {number} position - File position
   */
  async addToWriteBuffer(slot, buffer, position) {
    await this.writeBuffer.add(slot, buffer, position);
  }

  /**
   * Flush write buffer
   */
  async flushWrites() {
    await this.writeBuffer.flush();
  }

  /**
   * Clear read cache
   */
  clearReadCache() {
    this.readCache.clear();
  }

  /**
   * Clear write buffer
   */
  clearWriteBuffer() {
    this.writeBuffer.clear();
  }

  /**
   * Clear all caches
   */
  clearAll() {
    this.clearReadCache();
    this.clearWriteBuffer();
  }

  /**
   * Get read cache statistics
   * @returns {object} Read cache stats
   */
  getReadCacheStats() {
    return this.readCache.getStats();
  }

  /**
   * Get write buffer statistics
   * @returns {object} Write buffer stats
   */
  getWriteBufferStats() {
    return this.writeBuffer.getStats();
  }

  /**
   * Get combined cache statistics
   * @returns {object} Combined cache statistics
   */
  getStats() {
    return {
      readCache: this.getReadCacheStats(),
      writeBuffer: this.getWriteBufferStats()
    };
  }

  /**
   * Check if data exists in any cache layer
   * @param {string} id - Record ID
   * @param {number} slot - Slot number (for write buffer check)
   * @returns {object|null} Cache hit info or null
   */
  checkCache(id, slot) {
    // Check read cache first
    const readCacheHit = this.readCache.get(id);
    if (readCacheHit !== undefined) {
      return {
        source: 'readCache',
        data: readCacheHit
      };
    }

    // Check write buffer second
    const writeBufferHit = this.writeBuffer.get(slot);
    if (writeBufferHit) {
      return {
        source: 'writeBuffer',
        data: writeBufferHit
      };
    }

    return null;
  }

  /**
   * Invalidate caches for a specific record
   * @param {string} id - Record ID
   */
  invalidateRecord(id) {
    this.removeFromReadCache(id);
    // Note: Write buffer items are invalidated by position/slot, 
    // which is handled at a higher level
  }
}