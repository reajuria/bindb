/**
 * High-performance LRU (Least Recently Used) cache implementation
 * Optimized for fast read/write operations with O(1) complexity
 */

export interface CacheStats {
  size: number;
  maxSize: number;
  utilization: string;
}

export class LRUCache<K extends string | number, V> {
  private maxSize: number;
  private cache: Map<K, V>;

  /**
   * @param maxSize - Maximum number of items to cache
   */
  constructor(maxSize: number = 1000) {
    this.maxSize = maxSize;
    this.cache = new Map<K, V>();
  }

  /**
   * Get a value from the cache
   */
  get(key: K): V | undefined {
    if (!this.cache.has(key)) {
      return undefined;
    }

    const value = this.cache.get(key)!;

    // Move to end for LRU behavior (most recently used)
    this.cache.delete(key);
    this.cache.set(key, value);

    return value;
  }

  /**
   * Set a value in the cache
   */
  set(key: K, value: V): void {
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
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }

    // Add new item
    this.cache.set(key, value);
  }

  /**
   * Check if a key exists in the cache
   */
  has(key: K): boolean {
    return this.cache.has(key);
  }

  /**
   * Remove a key from the cache
   */
  delete(key: K): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear all items from the cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get the current size of the cache
   */
  get size(): number {
    return this.cache.size;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      utilization: ((this.cache.size / this.maxSize) * 100).toFixed(1) + '%',
    };
  }
}
