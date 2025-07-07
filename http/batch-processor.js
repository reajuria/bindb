/**
 * BatchProcessor - Handles batch processing and chunking for large operations
 */
export class BatchProcessor {
  constructor(options = {}) {
    this.config = {
      defaultBatchSize: options.defaultBatchSize || 1000,
      maxBatchSize: options.maxBatchSize || 10000,
      minBatchSize: options.minBatchSize || 1,
      autoOptimize: options.autoOptimize !== false,
      ...options
    };

    // Performance tracking for auto-optimization
    this.performanceHistory = [];
    this.maxHistorySize = 50;
  }

  /**
   * Process an array of items in batches
   * @param {Array} items - Items to process
   * @param {Function} processor - Async function to process each batch
   * @param {object} options - Processing options
   * @returns {Promise<Array>} Combined results from all batches
   */
  async processBatches(items, processor, options = {}) {
    if (!Array.isArray(items)) {
      throw new Error('Items must be an array');
    }

    if (typeof processor !== 'function') {
      throw new Error('Processor must be a function');
    }

    if (items.length === 0) {
      return [];
    }

    const batchSize = this.determineBatchSize(items.length, options);
    const startTime = performance.now();
    const results = [];

    // Process in batches
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const batchStartTime = performance.now();
      
      try {
        const batchResult = await processor(batch);
        
        if (Array.isArray(batchResult)) {
          results.push(...batchResult);
        } else {
          results.push(batchResult);
        }

        // Track batch performance
        if (this.config.autoOptimize) {
          const batchDuration = performance.now() - batchStartTime;
          this.recordBatchPerformance(batch.length, batchDuration);
        }

      } catch (error) {
        const enhancedError = new Error(
          `Batch processing failed at items ${i}-${i + batch.length - 1}: ${error.message}`
        );
        enhancedError.batchIndex = Math.floor(i / batchSize);
        enhancedError.batchSize = batch.length;
        enhancedError.originalError = error;
        throw enhancedError;
      }
    }

    const totalDuration = performance.now() - startTime;
    
    return {
      results,
      statistics: {
        totalItems: items.length,
        batchCount: Math.ceil(items.length / batchSize),
        batchSize,
        totalDuration,
        averageBatchDuration: totalDuration / Math.ceil(items.length / batchSize),
        throughput: items.length / (totalDuration / 1000) // items per second
      }
    };
  }

  /**
   * Determine optimal batch size for processing
   * @param {number} totalItems - Total number of items
   * @param {object} options - Batch size options
   * @returns {number} Optimal batch size
   */
  determineBatchSize(totalItems, options = {}) {
    const specifiedBatchSize = options.batchSize;
    
    // Use specified batch size if provided and valid
    if (specifiedBatchSize && this.isValidBatchSize(specifiedBatchSize)) {
      return Math.min(specifiedBatchSize, totalItems);
    }

    // Use auto-optimized batch size if available
    if (this.config.autoOptimize && this.performanceHistory.length > 0) {
      const optimizedSize = this.getOptimalBatchSize();
      if (optimizedSize) {
        return Math.min(optimizedSize, totalItems);
      }
    }

    // Use default batch size
    let batchSize = this.config.defaultBatchSize;

    // Adjust for small datasets
    if (totalItems < batchSize) {
      return totalItems;
    }

    // Adjust for very large datasets to avoid memory issues
    if (totalItems > this.config.maxBatchSize * 10) {
      batchSize = this.config.maxBatchSize;
    }

    return Math.min(batchSize, totalItems);
  }

  /**
   * Validate batch size
   * @param {number} batchSize - Batch size to validate
   * @returns {boolean} True if valid
   */
  isValidBatchSize(batchSize) {
    return typeof batchSize === 'number' && 
           batchSize >= this.config.minBatchSize && 
           batchSize <= this.config.maxBatchSize;
  }

  /**
   * Record batch performance for optimization
   * @param {number} batchSize - Size of the batch
   * @param {number} duration - Duration in milliseconds
   * @private
   */
  recordBatchPerformance(batchSize, duration) {
    const record = {
      batchSize,
      duration,
      throughput: batchSize / (duration / 1000), // items per second
      timestamp: Date.now()
    };

    this.performanceHistory.push(record);

    // Keep history size manageable
    if (this.performanceHistory.length > this.maxHistorySize) {
      this.performanceHistory.shift();
    }
  }

  /**
   * Get optimal batch size based on performance history
   * @returns {number|null} Optimal batch size or null if not enough data
   * @private
   */
  getOptimalBatchSize() {
    if (this.performanceHistory.length < 3) {
      return null;
    }

    // Find batch size with best throughput
    const bestPerformance = this.performanceHistory.reduce((best, current) => {
      return current.throughput > best.throughput ? current : best;
    });

    // Ensure the optimal size is within valid range
    const optimalSize = Math.round(bestPerformance.batchSize);
    
    if (this.isValidBatchSize(optimalSize)) {
      return optimalSize;
    }

    return null;
  }

  /**
   * Process items with parallel batches (use with caution)
   * @param {Array} items - Items to process
   * @param {Function} processor - Async function to process each batch
   * @param {object} options - Processing options
   * @returns {Promise<Array>} Combined results from all batches
   */
  async processParallelBatches(items, processor, options = {}) {
    const maxConcurrency = options.maxConcurrency || 3;
    const batchSize = this.determineBatchSize(items.length, options);
    
    const batches = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }

    const results = [];
    
    // Process batches in parallel with concurrency limit
    for (let i = 0; i < batches.length; i += maxConcurrency) {
      const concurrentBatches = batches.slice(i, i + maxConcurrency);
      
      const batchPromises = concurrentBatches.map(async (batch, index) => {
        try {
          return await processor(batch);
        } catch (error) {
          const enhancedError = new Error(
            `Parallel batch processing failed at batch ${i + index}: ${error.message}`
          );
          enhancedError.batchIndex = i + index;
          enhancedError.originalError = error;
          throw enhancedError;
        }
      });

      const batchResults = await Promise.all(batchPromises);
      
      for (const batchResult of batchResults) {
        if (Array.isArray(batchResult)) {
          results.push(...batchResult);
        } else {
          results.push(batchResult);
        }
      }
    }

    return results;
  }

  /**
   * Get performance statistics
   * @returns {object} Performance statistics
   */
  getPerformanceStats() {
    if (this.performanceHistory.length === 0) {
      return {
        totalBatches: 0,
        averageThroughput: 0,
        bestThroughput: 0,
        averageBatchSize: 0,
        recommendedBatchSize: this.config.defaultBatchSize
      };
    }

    const totalBatches = this.performanceHistory.length;
    const averageThroughput = this.performanceHistory.reduce((sum, record) => 
      sum + record.throughput, 0) / totalBatches;
    const bestThroughput = Math.max(...this.performanceHistory.map(r => r.throughput));
    const averageBatchSize = this.performanceHistory.reduce((sum, record) => 
      sum + record.batchSize, 0) / totalBatches;

    return {
      totalBatches,
      averageThroughput: Math.round(averageThroughput),
      bestThroughput: Math.round(bestThroughput),
      averageBatchSize: Math.round(averageBatchSize),
      recommendedBatchSize: this.getOptimalBatchSize() || this.config.defaultBatchSize,
      historySize: this.performanceHistory.length
    };
  }

  /**
   * Clear performance history
   */
  clearPerformanceHistory() {
    this.performanceHistory = [];
  }

  /**
   * Update configuration
   * @param {object} newConfig - New configuration options
   */
  updateConfig(newConfig) {
    this.config = {
      ...this.config,
      ...newConfig
    };

    // Validate new configuration
    if (this.config.minBatchSize > this.config.maxBatchSize) {
      throw new Error('minBatchSize cannot be greater than maxBatchSize');
    }

    if (this.config.defaultBatchSize < this.config.minBatchSize || 
        this.config.defaultBatchSize > this.config.maxBatchSize) {
      throw new Error('defaultBatchSize must be between minBatchSize and maxBatchSize');
    }
  }

  /**
   * Get current configuration
   * @returns {object} Current configuration
   */
  getConfig() {
    return { ...this.config };
  }
}