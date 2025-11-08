import { ValidationError } from '../engine/errors';

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
  _batchCount: number;
  _batchSize: number;
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
  _batchSize: number;
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
    _batchSizeRange: [number, number];
    sampleSize: number;
  };
}

/**
 * Batch processor function type
 */
export type BatchProcessorFunction<T, R> = (_batch: T[]) => Promise<R>;

/**
 * BatchProcessor - Handles _batch processing and chunking for large operations
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
      ...options,
    };
  }

  /**
   * Process an array of items in _batches
   */
  async processBatches<T, R>(
    items: T[],
    processor: BatchProcessorFunction<T, R>,
    options: Partial<BatchConfig> = {}
  ): Promise<BatchProcessingResult<R[]>> {
    if (!Array.isArray(items)) {
      throw new ValidationError(
        'Items must be an array',
        'items',
        typeof items
      );
    }

    if (typeof processor !== 'function') {
      throw new ValidationError(
        'Processor must be a function',
        'processor',
        typeof processor
      );
    }

    if (items.length === 0) {
      return {
        results: [],
        statistics: {
          totalItems: 0,
          _batchCount: 0,
          _batchSize: 0,
          totalDuration: 0,
          averageBatchDuration: 0,
          itemsPerSecond: 0,
        },
      };
    }

    const _batchSize = this.determineBatchSize(items.length, options);
    const startTime = performance.now();
    const results: R[] = [];
    const _batchDurations: number[] = [];

    // Process in _batches
    for (let i = 0; i < items.length; i += _batchSize) {
      const _batch = items.slice(i, i + _batchSize);
      const _batchStartTime = performance.now();

      try {
        const _batchResult = await processor(_batch);

        if (Array.isArray(_batchResult)) {
          results.push(...(_batchResult as R[]));
        } else {
          results.push(_batchResult);
        }

        // Track _batch performance
        if (this.config.autoOptimize) {
          const _batchDuration = performance.now() - _batchStartTime;
          _batchDurations.push(_batchDuration);
          this.recordBatchPerformance(_batch.length, _batchDuration);
        }
      } catch (error) {
        const enhancedError = new Error(
          `Batch processing failed at items ${i}-${i + _batch.length - 1}: ${(error as Error).message}`
        );
        (enhancedError as any)._batchIndex = Math.floor(i / _batchSize);
        (enhancedError as any)._batchSize = _batch.length;
        (enhancedError as any).originalError = error;
        throw enhancedError;
      }
    }

    const totalDuration = performance.now() - startTime;
    const _batchCount = Math.ceil(items.length / _batchSize);
    const averageBatchDuration =
      _batchDurations.length > 0
        ? _batchDurations.reduce((a, b) => a + b, 0) / _batchDurations.length
        : 0;

    return {
      results,
      statistics: {
        totalItems: items.length,
        _batchCount,
        _batchSize,
        totalDuration,
        averageBatchDuration,
        itemsPerSecond:
          totalDuration > 0 ? (items.length / totalDuration) * 1000 : 0,
      },
    };
  }

  /**
   * Determine optimal _batch size
   */
  private determineBatchSize(
    itemCount: number,
    options: Partial<BatchConfig> = {}
  ): number {
    const _batchSize = options.defaultBatchSize || this.config.defaultBatchSize;
    const maxBatchSize = options.maxBatchSize || this.config.maxBatchSize;
    const minBatchSize = options.minBatchSize || this.config.minBatchSize;

    let determinedSize = _batchSize;

    // Auto-optimize based on performance history
    if (this.config.autoOptimize && this.performanceHistory.length >= 3) {
      const optimalSize = this.calculateOptimalBatchSize();
      if (optimalSize > 0) {
        determinedSize = optimalSize;
      }
    }

    // Apply constraints
    determinedSize = Math.max(
      minBatchSize,
      Math.min(maxBatchSize, determinedSize)
    );

    // Don't exceed item count
    return Math.min(determinedSize, itemCount);
  }

  /**
   * Calculate optimal _batch size based on performance history
   */
  private calculateOptimalBatchSize(): number {
    if (this.performanceHistory.length < 3) {
      return this.config.defaultBatchSize;
    }

    // Find the _batch size with the best throughput (items per millisecond)
    const recentHistory = this.performanceHistory.slice(-20); // Last 20 _batches
    const performanceMap = new Map<number, number[]>();

    for (const record of recentHistory) {
      const throughput = record._batchSize / record.duration;
      if (!performanceMap.has(record._batchSize)) {
        performanceMap.set(record._batchSize, []);
      }
      performanceMap.get(record._batchSize)!.push(throughput);
    }

    let bestBatchSize = this.config.defaultBatchSize;
    let bestThroughput = 0;

    for (const [_batchSize, throughputs] of performanceMap) {
      const avgThroughput =
        throughputs.reduce((a, b) => a + b, 0) / throughputs.length;
      if (avgThroughput > bestThroughput) {
        bestThroughput = avgThroughput;
        bestBatchSize = _batchSize;
      }
    }

    return bestBatchSize;
  }

  /**
   * Record _batch performance for optimization
   */
  private recordBatchPerformance(_batchSize: number, duration: number): void {
    this.performanceHistory.push({
      _batchSize,
      duration,
      timestamp: Date.now(),
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
          _batchSizeRange: [this.config.minBatchSize, this.config.maxBatchSize],
          sampleSize: 0,
        },
      };
    }

    const totalDuration = this.performanceHistory.reduce(
      (sum, record) => sum + record.duration,
      0
    );
    const averageDuration = totalDuration / this.performanceHistory.length;

    const recentHistory = this.performanceHistory.slice(-10);
    const recentDuration = recentHistory.reduce(
      (sum, record) => sum + record.duration,
      0
    );
    const recentAverage =
      recentHistory.length > 0 ? recentDuration / recentHistory.length : 0;

    const _batchSizes = this.performanceHistory.map(
      record => record._batchSize
    );
    const minBatchSize = Math.min(..._batchSizes);
    const maxBatchSize = Math.max(..._batchSizes);

    return {
      totalBatches: this.performanceHistory.length,
      averageDuration,
      optimalBatchSize: this.calculateOptimalBatchSize(),
      recentPerformance: {
        averageDuration: recentAverage,
        _batchSizeRange: [minBatchSize, maxBatchSize],
        sampleSize: recentHistory.length,
      },
    };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<BatchConfig>): void {
    this.config = {
      ...this.config,
      ...newConfig,
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
   * Process _batches with parallel execution
   */
  async processBatchesParallel<T, R>(
    items: T[],
    processor: BatchProcessorFunction<T, R>,
    options: Partial<BatchConfig & { maxConcurrency?: number }> = {}
  ): Promise<BatchProcessingResult<R[]>> {
    const maxConcurrency = options.maxConcurrency || 3;
    const _batchSize = this.determineBatchSize(items.length, options);

    if (items.length === 0) {
      return {
        results: [],
        statistics: {
          totalItems: 0,
          _batchCount: 0,
          _batchSize: 0,
          totalDuration: 0,
          averageBatchDuration: 0,
          itemsPerSecond: 0,
        },
      };
    }

    const startTime = performance.now();
    const _batches: T[][] = [];

    // Create _batches
    for (let i = 0; i < items.length; i += _batchSize) {
      _batches.push(items.slice(i, i + _batchSize));
    }

    const results: R[] = [];
    const _batchDurations: number[] = [];

    // Process _batches with controlled concurrency
    for (let i = 0; i < _batches.length; i += maxConcurrency) {
      const concurrentBatches = _batches.slice(i, i + maxConcurrency);

      const _batchPromises = concurrentBatches.map(async (_batch, index) => {
        const _batchStartTime = performance.now();

        try {
          const result = await processor(_batch);
          const duration = performance.now() - _batchStartTime;

          if (this.config.autoOptimize) {
            _batchDurations.push(duration);
            this.recordBatchPerformance(_batch.length, duration);
          }

          return result;
        } catch (error) {
          const _batchIndex = i + index;
          const enhancedError = new Error(
            `Parallel _batch processing failed at _batch ${_batchIndex}: ${(error as Error).message}`
          );
          (enhancedError as any)._batchIndex = _batchIndex;
          (enhancedError as any)._batchSize = _batch.length;
          (enhancedError as any).originalError = error;
          throw enhancedError;
        }
      });

      const _batchResults = await Promise.all(_batchPromises);

      for (const _batchResult of _batchResults) {
        if (Array.isArray(_batchResult)) {
          results.push(...(_batchResult as R[]));
        } else {
          results.push(_batchResult);
        }
      }
    }

    const totalDuration = performance.now() - startTime;
    const averageBatchDuration =
      _batchDurations.length > 0
        ? _batchDurations.reduce((a, b) => a + b, 0) / _batchDurations.length
        : 0;

    return {
      results,
      statistics: {
        totalItems: items.length,
        _batchCount: _batches.length,
        _batchSize,
        totalDuration,
        averageBatchDuration,
        itemsPerSecond:
          totalDuration > 0 ? (items.length / totalDuration) * 1000 : 0,
      },
    };
  }
}
