/**
 * Batch processing configuration
 */
export interface BatchConfig {
  defaultBatchSize?: number;
  maxBatchSize?: number;
  minBatchSize?: number;
  autoOptimize?: boolean;
  [key: string]: any;
}

/**
 * Batch processing statistics
 */
export interface BatchStatistics {
  totalItems: number;
  batchCount: number;
  batchSize: number;
  totalDuration: number;
  averageBatchDuration: number;
  itemsPerSecond: number;
}

/**
 * Batch processing result
 */
export interface BatchProcessingResult<T> {
  results: T;
  statistics: BatchStatistics;
}

/**
 * Performance tracking data
 */
interface PerformanceRecord {
  batchSize: number;
  duration: number;
  timestamp: number;
}

/**
 * Performance statistics
 */
export interface PerformanceStats {
  totalBatches: number;
  averageDuration: number;
  optimalBatchSize: number;
  recentPerformance: {
    averageDuration: number;
    batchSizeRange: [number, number];
    sampleSize: number;
  };
}

/**
 * Batch processor function type
 */
export type BatchProcessorFunction<T, R> = (batch: T[]) => Promise<R>;

/**
 * BatchProcessor - Handles batch processing and chunking for large operations
 */
export class BatchProcessor {
  private config: Required<BatchConfig>;
  private performanceHistory: PerformanceRecord[] = [];
  private readonly maxHistorySize: number = 50;

  constructor(options: BatchConfig = {}) {
    this.config = {
      defaultBatchSize: options.defaultBatchSize || 1000,
      maxBatchSize: options.maxBatchSize || 10000,
      minBatchSize: options.minBatchSize || 1,
      autoOptimize: options.autoOptimize !== false,
      ...options
    };
  }

  /**
   * Process an array of items in batches
   */
  async processBatches<T, R>(
    items: T[],
    processor: BatchProcessorFunction<T, R>,
    options: Partial<BatchConfig> = {}
  ): Promise<BatchProcessingResult<R[]>> {
    if (!Array.isArray(items)) {
      throw new Error('Items must be an array');
    }

    if (typeof processor !== 'function') {
      throw new Error('Processor must be a function');
    }

    if (items.length === 0) {
      return {
        results: [],
        statistics: {
          totalItems: 0,
          batchCount: 0,
          batchSize: 0,
          totalDuration: 0,
          averageBatchDuration: 0,
          itemsPerSecond: 0
        }
      };
    }

    const batchSize = this.determineBatchSize(items.length, options);
    const startTime = performance.now();
    const results: R[] = [];
    const batchDurations: number[] = [];

    // Process in batches
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const batchStartTime = performance.now();
      
      try {
        const batchResult = await processor(batch);
        
        if (Array.isArray(batchResult)) {
          results.push(...batchResult as R[]);
        } else {
          results.push(batchResult);
        }

        // Track batch performance
        if (this.config.autoOptimize) {
          const batchDuration = performance.now() - batchStartTime;
          batchDurations.push(batchDuration);
          this.recordBatchPerformance(batch.length, batchDuration);
        }

      } catch (error) {
        const enhancedError = new Error(
          `Batch processing failed at items ${i}-${i + batch.length - 1}: ${(error as Error).message}`
        );
        (enhancedError as any).batchIndex = Math.floor(i / batchSize);
        (enhancedError as any).batchSize = batch.length;
        (enhancedError as any).originalError = error;
        throw enhancedError;
      }
    }

    const totalDuration = performance.now() - startTime;
    const batchCount = Math.ceil(items.length / batchSize);
    const averageBatchDuration = batchDurations.length > 0 
      ? batchDurations.reduce((a, b) => a + b, 0) / batchDurations.length 
      : 0;
    
    return {
      results,
      statistics: {
        totalItems: items.length,
        batchCount,
        batchSize,
        totalDuration,
        averageBatchDuration,
        itemsPerSecond: totalDuration > 0 ? (items.length / totalDuration) * 1000 : 0
      }
    };
  }

  /**
   * Determine optimal batch size
   */
  private determineBatchSize(itemCount: number, options: Partial<BatchConfig> = {}): number {
    const batchSize = options.defaultBatchSize || this.config.defaultBatchSize;
    const maxBatchSize = options.maxBatchSize || this.config.maxBatchSize;
    const minBatchSize = options.minBatchSize || this.config.minBatchSize;

    let determinedSize = batchSize;

    // Auto-optimize based on performance history
    if (this.config.autoOptimize && this.performanceHistory.length >= 3) {
      const optimalSize = this.calculateOptimalBatchSize();
      if (optimalSize > 0) {
        determinedSize = optimalSize;
      }
    }

    // Apply constraints
    determinedSize = Math.max(minBatchSize, Math.min(maxBatchSize, determinedSize));
    
    // Don't exceed item count
    return Math.min(determinedSize, itemCount);
  }

  /**
   * Calculate optimal batch size based on performance history
   */
  private calculateOptimalBatchSize(): number {
    if (this.performanceHistory.length < 3) {
      return this.config.defaultBatchSize;
    }

    // Find the batch size with the best throughput (items per millisecond)
    const recentHistory = this.performanceHistory.slice(-20); // Last 20 batches
    const performanceMap = new Map<number, number[]>();

    for (const record of recentHistory) {
      const throughput = record.batchSize / record.duration;
      if (!performanceMap.has(record.batchSize)) {
        performanceMap.set(record.batchSize, []);
      }
      performanceMap.get(record.batchSize)!.push(throughput);
    }

    let bestBatchSize = this.config.defaultBatchSize;
    let bestThroughput = 0;

    for (const [batchSize, throughputs] of performanceMap) {
      const avgThroughput = throughputs.reduce((a, b) => a + b, 0) / throughputs.length;
      if (avgThroughput > bestThroughput) {
        bestThroughput = avgThroughput;
        bestBatchSize = batchSize;
      }
    }

    return bestBatchSize;
  }

  /**
   * Record batch performance for optimization
   */
  private recordBatchPerformance(batchSize: number, duration: number): void {
    this.performanceHistory.push({
      batchSize,
      duration,
      timestamp: Date.now()
    });

    // Limit history size
    if (this.performanceHistory.length > this.maxHistorySize) {
      this.performanceHistory.shift();
    }
  }

  /**
   * Get performance statistics
   */
  getPerformanceStats(): PerformanceStats {
    if (this.performanceHistory.length === 0) {
      return {
        totalBatches: 0,
        averageDuration: 0,
        optimalBatchSize: this.config.defaultBatchSize,
        recentPerformance: {
          averageDuration: 0,
          batchSizeRange: [this.config.minBatchSize, this.config.maxBatchSize],
          sampleSize: 0
        }
      };
    }

    const totalDuration = this.performanceHistory.reduce((sum, record) => sum + record.duration, 0);
    const averageDuration = totalDuration / this.performanceHistory.length;
    
    const recentHistory = this.performanceHistory.slice(-10);
    const recentDuration = recentHistory.reduce((sum, record) => sum + record.duration, 0);
    const recentAverage = recentHistory.length > 0 ? recentDuration / recentHistory.length : 0;
    
    const batchSizes = this.performanceHistory.map(record => record.batchSize);
    const minBatchSize = Math.min(...batchSizes);
    const maxBatchSize = Math.max(...batchSizes);

    return {
      totalBatches: this.performanceHistory.length,
      averageDuration,
      optimalBatchSize: this.calculateOptimalBatchSize(),
      recentPerformance: {
        averageDuration: recentAverage,
        batchSizeRange: [minBatchSize, maxBatchSize],
        sampleSize: recentHistory.length
      }
    };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<BatchConfig>): void {
    this.config = {
      ...this.config,
      ...newConfig
    };
  }

  /**
   * Get current configuration
   */
  getConfig(): Required<BatchConfig> {
    return { ...this.config };
  }

  /**
   * Clear performance history
   */
  clearPerformanceHistory(): void {
    this.performanceHistory = [];
  }

  /**
   * Process batches with parallel execution
   */
  async processBatchesParallel<T, R>(
    items: T[],
    processor: BatchProcessorFunction<T, R>,
    options: Partial<BatchConfig & { maxConcurrency?: number }> = {}
  ): Promise<BatchProcessingResult<R[]>> {
    const maxConcurrency = options.maxConcurrency || 3;
    const batchSize = this.determineBatchSize(items.length, options);
    
    if (items.length === 0) {
      return {
        results: [],
        statistics: {
          totalItems: 0,
          batchCount: 0,
          batchSize: 0,
          totalDuration: 0,
          averageBatchDuration: 0,
          itemsPerSecond: 0
        }
      };
    }

    const startTime = performance.now();
    const batches: T[][] = [];
    
    // Create batches
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }

    const results: R[] = [];
    const batchDurations: number[] = [];

    // Process batches with controlled concurrency
    for (let i = 0; i < batches.length; i += maxConcurrency) {
      const concurrentBatches = batches.slice(i, i + maxConcurrency);
      
      const batchPromises = concurrentBatches.map(async (batch, index) => {
        const batchStartTime = performance.now();
        
        try {
          const result = await processor(batch);
          const duration = performance.now() - batchStartTime;
          
          if (this.config.autoOptimize) {
            batchDurations.push(duration);
            this.recordBatchPerformance(batch.length, duration);
          }
          
          return result;
        } catch (error) {
          const batchIndex = i + index;
          const enhancedError = new Error(
            `Parallel batch processing failed at batch ${batchIndex}: ${(error as Error).message}`
          );
          (enhancedError as any).batchIndex = batchIndex;
          (enhancedError as any).batchSize = batch.length;
          (enhancedError as any).originalError = error;
          throw enhancedError;
        }
      });

      const batchResults = await Promise.all(batchPromises);
      
      for (const batchResult of batchResults) {
        if (Array.isArray(batchResult)) {
          results.push(...batchResult as R[]);
        } else {
          results.push(batchResult);
        }
      }
    }

    const totalDuration = performance.now() - startTime;
    const averageBatchDuration = batchDurations.length > 0 
      ? batchDurations.reduce((a, b) => a + b, 0) / batchDurations.length 
      : 0;

    return {
      results,
      statistics: {
        totalItems: items.length,
        batchCount: batches.length,
        batchSize,
        totalDuration,
        averageBatchDuration,
        itemsPerSecond: totalDuration > 0 ? (items.length / totalDuration) * 1000 : 0
      }
    };
  }
}