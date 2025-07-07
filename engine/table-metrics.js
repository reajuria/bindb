/**
 * TableMetrics - Handles table performance monitoring and statistics
 */
export class TableMetrics {
  constructor() {
    this.operationCounts = {
      reads: 0,
      writes: 0,
      updates: 0,
      deletes: 0,
      cacheHits: 0,
      cacheMisses: 0
    };

    this.performanceTiming = {
      totalReadTime: 0,
      totalWriteTime: 0,
      totalUpdateTime: 0,
      totalDeleteTime: 0
    };

    this.startTime = Date.now();
  }

  /**
   * Record a read operation
   * @param {number} duration - Operation duration in milliseconds
   * @param {boolean} fromCache - Whether the read was from cache
   */
  recordRead(duration = 0, fromCache = false) {
    this.operationCounts.reads++;
    this.performanceTiming.totalReadTime += duration;
    
    if (fromCache) {
      this.operationCounts.cacheHits++;
    } else {
      this.operationCounts.cacheMisses++;
    }
  }

  /**
   * Record a write operation
   * @param {number} duration - Operation duration in milliseconds
   */
  recordWrite(duration = 0) {
    this.operationCounts.writes++;
    this.performanceTiming.totalWriteTime += duration;
  }

  /**
   * Record an update operation
   * @param {number} duration - Operation duration in milliseconds
   */
  recordUpdate(duration = 0) {
    this.operationCounts.updates++;
    this.performanceTiming.totalUpdateTime += duration;
  }

  /**
   * Record a delete operation
   * @param {number} duration - Operation duration in milliseconds
   */
  recordDelete(duration = 0) {
    this.operationCounts.deletes++;
    this.performanceTiming.totalDeleteTime += duration;
  }

  /**
   * Get basic operation statistics
   * @returns {object} Operation statistics
   */
  getOperationStats() {
    return { ...this.operationCounts };
  }

  /**
   * Get performance timing statistics
   * @returns {object} Performance timing statistics
   */
  getPerformanceStats() {
    const totalOps = this.operationCounts.reads + this.operationCounts.writes + 
                    this.operationCounts.updates + this.operationCounts.deletes;
    
    return {
      ...this.performanceTiming,
      averageReadTime: this.operationCounts.reads > 0 
        ? this.performanceTiming.totalReadTime / this.operationCounts.reads 
        : 0,
      averageWriteTime: this.operationCounts.writes > 0 
        ? this.performanceTiming.totalWriteTime / this.operationCounts.writes 
        : 0,
      averageUpdateTime: this.operationCounts.updates > 0 
        ? this.performanceTiming.totalUpdateTime / this.operationCounts.updates 
        : 0,
      averageDeleteTime: this.operationCounts.deletes > 0 
        ? this.performanceTiming.totalDeleteTime / this.operationCounts.deletes 
        : 0,
      totalOperations: totalOps
    };
  }

  /**
   * Get cache performance statistics
   * @returns {object} Cache performance statistics
   */
  getCacheStats() {
    const totalCacheRequests = this.operationCounts.cacheHits + this.operationCounts.cacheMisses;
    
    return {
      hits: this.operationCounts.cacheHits,
      misses: this.operationCounts.cacheMisses,
      totalRequests: totalCacheRequests,
      hitRate: totalCacheRequests > 0 
        ? this.operationCounts.cacheHits / totalCacheRequests 
        : 0,
      missRate: totalCacheRequests > 0 
        ? this.operationCounts.cacheMisses / totalCacheRequests 
        : 0
    };
  }

  /**
   * Get comprehensive table statistics
   * @param {object} slotStats - Slot manager statistics
   * @param {object} cacheStats - Cache manager statistics
   * @returns {object} Comprehensive table statistics
   */
  getComprehensiveStats(slotStats = {}, cacheStats = {}) {
    const uptime = Date.now() - this.startTime;
    const totalOps = this.operationCounts.reads + this.operationCounts.writes + 
                    this.operationCounts.updates + this.operationCounts.deletes;

    return {
      // Basic table info
      uptime,
      totalOperations: totalOps,
      operationsPerSecond: uptime > 0 ? (totalOps / (uptime / 1000)) : 0,
      
      // Operation breakdown
      operations: this.getOperationStats(),
      
      // Performance metrics
      performance: this.getPerformanceStats(),
      
      // Cache performance
      cachePerformance: this.getCacheStats(),
      
      // Slot information (from SlotManager)
      slots: slotStats,
      
      // Cache details (from TableCacheManager)
      cache: cacheStats
    };
  }

  /**
   * Reset all metrics
   */
  reset() {
    this.operationCounts = {
      reads: 0,
      writes: 0,
      updates: 0,
      deletes: 0,
      cacheHits: 0,
      cacheMisses: 0
    };

    this.performanceTiming = {
      totalReadTime: 0,
      totalWriteTime: 0,
      totalUpdateTime: 0,
      totalDeleteTime: 0
    };

    this.startTime = Date.now();
  }

  /**
   * Get metrics summary as string
   * @returns {string} Formatted metrics summary
   */
  getSummary() {
    const stats = this.getComprehensiveStats();
    return `Table Metrics Summary:
Operations: ${stats.totalOperations} total (${stats.operationsPerSecond.toFixed(2)} ops/sec)
Cache: ${stats.cachePerformance.hitRate.toFixed(2)}% hit rate
Uptime: ${(stats.uptime / 1000).toFixed(2)} seconds`;
  }
}