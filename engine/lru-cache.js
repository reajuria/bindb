/**
 * High-performance LRU (Least Recently Used) cache implementation
 * Optimized for fast read/write operations with O(1) complexity
 */
export class LRUCache {
  /**
   * @param {number} maxSize - Maximum number of items to cache
   */
  constructor(maxSize = 1000) {
    this.maxSize = maxSize;
    this.cache = new Map();
  }

  /**
   * Get a value from the cache
   * @param {string} key - The cache key
   * @returns {any} The cached value or undefined if not found
   */
  get(key) {
    if (!this.cache.has(key)) {
      return undefined;
    }

    const value = this.cache.get(key);
    
    // Move to end for LRU behavior (most recently used)
    this.cache.delete(key);
    this.cache.set(key, value);
    
    return value;
  }

  /**
   * Set a value in the cache
   * @param {string} key - The cache key
   * @param {any} value - The value to cache
   */
  set(key, value) {
    // If key already exists, update it
    if (this.cache.has(key)) {
      this.cache.delete(key);
      this.cache.set(key, value);
      return;
    }

    // Check if we need to evict oldest item
    if (this.cache.size >= this.maxSize) {
      // Remove least recently used (first item)
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    // Add new item
    this.cache.set(key, value);
  }

  /**
   * Check if a key exists in the cache
   * @param {string} key - The cache key
   * @returns {boolean} True if key exists
   */
  has(key) {
    return this.cache.has(key);
  }

  /**
   * Remove a key from the cache
   * @param {string} key - The cache key
   * @returns {boolean} True if key was removed
   */
  delete(key) {
    return this.cache.delete(key);
  }

  /**
   * Clear all items from the cache
   */
  clear() {
    this.cache.clear();
  }

  /**
   * Get the current size of the cache
   * @returns {number} Number of items in cache
   */
  get size() {
    return this.cache.size;
  }

  /**
   * Get cache statistics
   * @returns {object} Cache statistics
   */
  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      utilization: (this.cache.size / this.maxSize * 100).toFixed(1) + '%'
    };
  }
}