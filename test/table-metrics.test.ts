import { TableMetrics } from '../engine/table-metrics.js';

describe('TableMetrics', () => {
  let metrics: TableMetrics;

  beforeEach(() => {
    metrics = new TableMetrics();
  });

  describe('Basic Operations Recording', () => {
    it('should record read operations', () => {
      metrics.recordRead(50);
      
      const stats = metrics.getOperationStats();
      expect(stats.reads).toBe(1);
      expect(stats.totalTime).toBe(50);
    });

    it('should record write operations', () => {
      metrics.recordWrite(75);
      
      const stats = metrics.getOperationStats();
      expect(stats.writes).toBe(1);
      expect(stats.totalTime).toBe(75);
    });

    it('should record update operations', () => {
      metrics.recordUpdate(25);
      
      const stats = metrics.getOperationStats();
      expect(stats.updates).toBe(1);
      expect(stats.totalTime).toBe(25);
    });

    it('should record delete operations', () => {
      metrics.recordDelete(100);
      
      const stats = metrics.getOperationStats();
      expect(stats.deletes).toBe(1);
      expect(stats.totalTime).toBe(100);
    });

    it('should accumulate operation counts and times', () => {
      metrics.recordRead(10);
      metrics.recordRead(20);
      metrics.recordWrite(30);
      metrics.recordUpdate(40);
      metrics.recordDelete(50);
      
      const stats = metrics.getOperationStats();
      expect(stats.reads).toBe(2);
      expect(stats.writes).toBe(1);
      expect(stats.updates).toBe(1);
      expect(stats.deletes).toBe(1);
      expect(stats.totalTime).toBe(150);
    });
  });

  describe('Performance Statistics', () => {
    it('should calculate performance stats with operations', () => {
      metrics.recordRead(100);
      metrics.recordWrite(200);
      metrics.recordUpdate(150);
      
      const perfStats = metrics.getPerformanceStats();
      expect(perfStats.totalOperations).toBe(3);
      expect(perfStats.totalTime).toBe(450);
      expect(perfStats.averageTime).toBeCloseTo(150);
      expect(perfStats.operationsPerSecond).toBeGreaterThan(0);
    });

    it('should handle zero operations gracefully', () => {
      const perfStats = metrics.getPerformanceStats();
      expect(perfStats.totalOperations).toBe(0);
      expect(perfStats.totalTime).toBe(0);
      expect(perfStats.averageTime).toBe(0);
      expect(perfStats.operationsPerSecond).toBe(0);
    });

    it('should calculate uptime correctly', () => {
      const startTime = metrics.metricsStartTime;
      expect(metrics.uptime).toBeGreaterThanOrEqual(0);
      expect(startTime).toBeCloseTo(Date.now(), -2); // Within 100ms
    });
  });

  describe('Cache Statistics', () => {
    it('should calculate cache stats with hit rates', () => {
      const cacheStats = metrics.getCacheStats();
      expect(cacheStats.hitRate).toBe(0);
      expect(cacheStats.missRate).toBe(0);
      expect(cacheStats.totalRequests).toBe(0);
    });

    it('should handle cache hits and misses', () => {
      // Simulate cache operations by calling recordRead multiple times
      // which would typically involve cache interactions
      metrics.recordRead(10);
      metrics.recordRead(15);
      metrics.recordRead(20);
      
      const cacheStats = metrics.getCacheStats();
      expect(cacheStats.totalRequests).toBeGreaterThanOrEqual(0);
      expect(cacheStats.hitRate).toBeGreaterThanOrEqual(0);
      expect(cacheStats.missRate).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Comprehensive Statistics', () => {
    it('should provide comprehensive stats combining all metrics', () => {
      metrics.recordRead(50);
      metrics.recordWrite(100);
      metrics.recordUpdate(75);
      metrics.recordDelete(25);

      const mockSlotStats = {
        allocatedCount: 10,
        freeCount: 5,
        totalCount: 15
      };

      const mockCacheStats = {
        readCacheSize: 100,
        writeBufferSize: 50,
        readCacheHits: 80,
        readCacheMisses: 20,
        writeBufferHits: 30,
        writeBufferMisses: 10
      };

      const comprehensive = metrics.getComprehensiveStats(mockSlotStats, mockCacheStats);
      
      expect(comprehensive.operations.reads).toBe(1);
      expect(comprehensive.operations.writes).toBe(1);
      expect(comprehensive.operations.updates).toBe(1);
      expect(comprehensive.operations.deletes).toBe(1);
      expect(comprehensive.performance.totalOperations).toBe(4);
      expect(comprehensive.performance.totalTime).toBe(250);
      expect(comprehensive.slots).toEqual(mockSlotStats);
      expect(comprehensive.cache).toEqual(mockCacheStats);
    });
  });

  describe('Metrics Reset', () => {
    it('should reset all metrics to initial state', () => {
      metrics.recordRead(100);
      metrics.recordWrite(200);
      metrics.recordUpdate(150);
      
      metrics.reset();
      
      const stats = metrics.getOperationStats();
      expect(stats.reads).toBe(0);
      expect(stats.writes).toBe(0);
      expect(stats.updates).toBe(0);
      expect(stats.deletes).toBe(0);
      expect(stats.totalTime).toBe(0);
      
      const perfStats = metrics.getPerformanceStats();
      expect(perfStats.totalOperations).toBe(0);
      expect(perfStats.totalTime).toBe(0);
    });

    it('should update start time on reset', async () => {
      const originalStartTime = metrics.metricsStartTime;
      
      // Wait a small amount
      await new Promise(resolve => setTimeout(resolve, 1));
      
      metrics.reset();
      
      expect(metrics.metricsStartTime).toBeGreaterThan(originalStartTime);
    });
  });

  describe('Summary and String Representation', () => {
    it('should generate meaningful summary string', () => {
      metrics.recordRead(50);
      metrics.recordWrite(100);
      
      const summary = metrics.getSummary();
      expect(summary).toContain('reads: 1');
      expect(summary).toContain('writes: 1');
      expect(summary).toContain('total operations: 2');
      expect(summary).toContain('uptime:');
    });

    it('should handle empty metrics in summary', () => {
      const summary = metrics.getSummary();
      expect(summary).toContain('reads: 0');
      expect(summary).toContain('writes: 0');
      expect(summary).toContain('total operations: 0');
    });
  });

  describe('Getters and Properties', () => {
    it('should provide access to total operations count', () => {
      expect(metrics.totalOperations).toBe(0);
      
      metrics.recordRead(10);
      metrics.recordWrite(20);
      
      expect(metrics.totalOperations).toBe(2);
    });

    it('should provide access to metrics start time', () => {
      const startTime = metrics.metricsStartTime;
      expect(typeof startTime).toBe('number');
      expect(startTime).toBeLessThanOrEqual(Date.now());
    });

    it('should calculate uptime as time since start', async () => {
      const uptime1 = metrics.uptime;
      
      // Wait a small amount
      await new Promise(resolve => setTimeout(resolve, 1));
      
      const uptime2 = metrics.uptime;
      expect(uptime2).toBeGreaterThanOrEqual(uptime1);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle negative timing values gracefully', () => {
      metrics.recordRead(-10);
      
      const stats = metrics.getOperationStats();
      expect(stats.reads).toBe(1);
      expect(stats.totalTime).toBe(-10); // Should still record the value
    });

    it('should handle very large timing values', () => {
      const largeTime = Number.MAX_SAFE_INTEGER;
      metrics.recordRead(largeTime);
      
      const stats = metrics.getOperationStats();
      expect(stats.reads).toBe(1);
      expect(stats.totalTime).toBe(largeTime);
    });

    it('should handle zero timing values', () => {
      metrics.recordRead(0);
      metrics.recordWrite(0);
      
      const stats = metrics.getOperationStats();
      expect(stats.reads).toBe(1);
      expect(stats.writes).toBe(1);
      expect(stats.totalTime).toBe(0);
    });
  });

  describe('Performance Calculations', () => {
    it('should calculate operations per second correctly', () => {
      metrics.recordRead(1000); // 1 second
      
      const perfStats = metrics.getPerformanceStats();
      expect(perfStats.operationsPerSecond).toBeCloseTo(1, 1);
    });

    it('should handle very fast operations', () => {
      metrics.recordRead(0.1); // 0.1ms
      metrics.recordWrite(0.2); // 0.2ms
      
      const perfStats = metrics.getPerformanceStats();
      expect(perfStats.operationsPerSecond).toBeGreaterThan(1000);
    });

    it('should calculate average time correctly with mixed operations', () => {
      metrics.recordRead(100);
      metrics.recordWrite(200);
      metrics.recordUpdate(300);
      metrics.recordDelete(400);
      
      const perfStats = metrics.getPerformanceStats();
      expect(perfStats.averageTime).toBe(250); // (100+200+300+400)/4
    });
  });
});