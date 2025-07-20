/**
 * TableMetrics - Handles table performance monitoring and statistics
 */

/**
 * Operation counts tracking
 */
export interface OperationCounts {
  reads: number;
  writes: number;
  updates: number;
  deletes: number;
  cacheHits: number;
  cacheMisses: number;
}

/**
 * Performance timing tracking
 */
export interface PerformanceTiming {
  totalReadTime: number;
  totalWriteTime: number;
  totalUpdateTime: number;
  totalDeleteTime: number;
}

/**
 * Extended performance statistics
 */
export interface PerformanceStats extends PerformanceTiming {
  averageReadTime: number;
  averageWriteTime: number;
  averageUpdateTime: number;
  averageDeleteTime: number;
  totalOperations: number;
}

/**
 * Cache performance statistics
 */
export interface CacheStats {
  hits: number;
  misses: number;
  totalRequests: number;
  hitRate: number;
  missRate: number;
}

/**
 * Comprehensive table statistics
 */
export interface ComprehensiveStats {
  uptime: number;
  totalOperations: number;
  operationsPerSecond: number;
  operations: OperationCounts;
  performance: PerformanceStats;
  cachePerformance: CacheStats;
  slots: Record<string, any>;
  cache: Record<string, any>;
}

export class TableMetrics {
  private operationCounts: OperationCounts;
  private performanceTiming: PerformanceTiming;
  private startTime: number;

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
   */
  recordRead(duration: number = 0, fromCache: boolean = false): void {
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
   */
  recordWrite(duration: number = 0): void {
    this.operationCounts.writes++;
    this.performanceTiming.totalWriteTime += duration;
  }

  /**
   * Record an update operation
   */
  recordUpdate(duration: number = 0): void {
    this.operationCounts.updates++;
    this.performanceTiming.totalUpdateTime += duration;
  }

  /**
   * Record a delete operation
   */
  recordDelete(duration: number = 0): void {
    this.operationCounts.deletes++;
    this.performanceTiming.totalDeleteTime += duration;
  }

  /**
   * Get basic operation statistics
   */
  getOperationStats(): OperationCounts {
    return { ...this.operationCounts };
  }

  /**
   * Get performance timing statistics
   */
  getPerformanceStats(): PerformanceStats {
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
   */
  getCacheStats(): CacheStats {
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
   */
  getComprehensiveStats(
    slotStats: Record<string, any> = {}, 
    cacheStats: Record<string, any> = {}
  ): ComprehensiveStats {
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
  reset(): void {
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
   */
  getSummary(): string {
    const stats = this.getComprehensiveStats();
    return `Table Metrics Summary:
Operations: ${stats.totalOperations} total (${stats.operationsPerSecond.toFixed(2)} ops/sec)
Cache: ${stats.cachePerformance.hitRate.toFixed(2)}% hit rate
Uptime: ${(stats.uptime / 1000).toFixed(2)} seconds`;
  }

  /**
   * Get the start time of metrics collection
   */
  get metricsStartTime(): number {
    return this.startTime;
  }

  /**
   * Get current uptime in milliseconds
   */
  get uptime(): number {
    return Date.now() - this.startTime;
  }

  /**
   * Get total number of operations recorded
   */
  get totalOperations(): number {
    return this.operationCounts.reads + this.operationCounts.writes + 
           this.operationCounts.updates + this.operationCounts.deletes;
  }
}