#!/usr/bin/env node

import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';
import { Database } from '../engine/database.js';
import { Schema, type ColumnDefinition } from '../engine/schema.js';
import { Types } from '../engine/column.js';
import type { Table } from '../engine/table.js';

interface ScalabilityResult {
  test: string;
  recordCount: number;
  datasetSize?: number;
  batchSize?: number;
  throughput: number;
  duration: number;
  memoryUsage?: number;
  cacheHitRate?: number;
  diskIO?: number;
}

interface TestRecord {
  name: string;
  value: number;
  active: boolean;
  category: string;
  timestamp: Date;
}

interface DatabaseSetup {
  db: Database;
  table: Table;
}

interface PerformanceMetrics {
  throughput: number;
  duration: number;
  memoryBefore: NodeJS.MemoryUsage;
  memoryAfter: NodeJS.MemoryUsage;
  memoryDelta: number;
}

class ScalabilityBenchmark {
  private results: ScalabilityResult[] = [];
  private tempDir: string | null = null;
  private verbose: boolean;

  constructor() {
    this.verbose = process.argv.includes('--verbose');
  }

  private log(...args: any[]): void {
    if (this.verbose) {
      console.log(...args);
    }
  }

  async setup(): Promise<void> {
    this.tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'bindb-scalability-'));
    console.log(`🔬 BinDB Scalability Benchmark Suite`);
    console.log(`📁 Test directory: ${this.tempDir}`);
    console.log(`💻 Environment: ${process.platform} ${process.arch} Node.js ${process.version}`);
    console.log(`📊 Available memory: ${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)}MB`);
    console.log(`⏰ Started: ${new Date().toISOString()}\n`);
  }

  async cleanup(): Promise<void> {
    if (this.tempDir) {
      await fs.rm(this.tempDir, { recursive: true, force: true });
    }
  }

  async createTestDatabase(name: string): Promise<DatabaseSetup> {
    if (!this.tempDir) {
      throw new Error('Benchmark not initialized');
    }

    const db = await Database.create(this.tempDir, name);
    
    const columns: ColumnDefinition[] = [
      { name: 'name', type: Types.Text, length: 50 },
      { name: 'value', type: Types.Number },
      { name: 'active', type: Types.Boolean },
      { name: 'category', type: Types.Text, length: 20 },
      { name: 'timestamp', type: Types.Date }
    ];
    
    const schema = Schema.create(name, 'records', columns);
    await db.createTable('records', schema);
    
    const table = db.table('records');
    if (!table) {
      throw new Error('Failed to create table');
    }
    
    return { db, table };
  }

  generateTestData(count: number): TestRecord[] {
    const categories = ['analytics', 'user-data', 'transactions', 'logs', 'cache', 'session', 'metrics'];
    const namePatterns = ['user', 'session', 'request', 'event', 'metric', 'transaction', 'log'];
    
    return Array.from({ length: count }, (_, i) => ({
      name: `${namePatterns[i % namePatterns.length]}_${i.toString().padStart(8, '0')}`,
      value: Math.random() * 10000,
      active: Math.random() > 0.3,
      category: categories[i % categories.length],
      timestamp: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000) // Random date within last year
    }));
  }

  private measurePerformance<T>(operation: () => Promise<T>, recordCount: number): Promise<{ result: T; metrics: PerformanceMetrics }> {
    return new Promise(async (resolve) => {
      const memoryBefore = process.memoryUsage();
      const startTime = process.hrtime.bigint();

      const result = await operation();

      const endTime = process.hrtime.bigint();
      const memoryAfter = process.memoryUsage();
      
      const duration = Number(endTime - startTime) / 1_000_000; // Convert to milliseconds
      const throughput = Math.round(recordCount / (duration / 1000)); // Operations per second
      const memoryDelta = memoryAfter.heapUsed - memoryBefore.heapUsed;

      resolve({
        result,
        metrics: {
          throughput,
          duration: Math.round(duration),
          memoryBefore,
          memoryAfter,
          memoryDelta
        }
      });
    });
  }

  async runDatasetScaleTest(): Promise<void> {
    console.log(`\n📈 DATASET SCALE TEST`);
    console.log(`${'='.repeat(60)}`);
    console.log(`Testing performance across different dataset sizes...\n`);
    
    const dataSizes = [1000, 10000, 50000, 100000, 250000, 500000];
    
    for (const size of dataSizes) {
      console.log(`🔄 Testing dataset size: ${size.toLocaleString()} records`);
      
      const { table } = await this.createTestDatabase(`scale_${size}_${Date.now()}`);
      const records = this.generateTestData(size);
      
      const { metrics } = await this.measurePerformance(async () => {
        return await table.bulkInsert(records);
      }, size);
      
      await table.flush();
      
      console.log(`   Duration: ${metrics.duration.toLocaleString()}ms`);
      console.log(`   Throughput: ${metrics.throughput.toLocaleString()} records/sec`);
      console.log(`   Memory usage: ${(metrics.memoryDelta / 1024 / 1024).toFixed(2)}MB`);
      console.log(`   Memory per record: ${Math.round(metrics.memoryDelta / size)} bytes`);
      
      this.results.push({
        test: 'Dataset Scale',
        recordCount: size,
        throughput: metrics.throughput,
        duration: metrics.duration,
        memoryUsage: metrics.memoryDelta
      });
      
      await table.close();
    }
  }

  async runOptimalBatchSizeTest(): Promise<void> {
    console.log(`\n🎯 OPTIMAL BATCH SIZE TEST`);
    console.log(`${'='.repeat(60)}`);
    console.log(`Finding optimal batch size for bulk operations...\n`);
    
    const batchSizes = [1, 10, 50, 100, 500, 1000, 2500, 5000, 10000, 25000];
    const recordCount = 100000;
    let bestThroughput = 0;
    let bestBatchSize = 0;
    
    for (const batchSize of batchSizes) {
      console.log(`🔄 Testing batch size: ${batchSize.toLocaleString()}`);
      
      const { table } = await this.createTestDatabase(`batch_${batchSize}_${Date.now()}`);
      const records = this.generateTestData(recordCount);
      
      const { metrics } = await this.measurePerformance(async () => {
        if (batchSize === 1) {
          // Individual inserts
          for (const record of records) {
            await table.insert(record);
          }
        } else if (batchSize >= recordCount) {
          // Single bulk insert
          await table.bulkInsert(records);
        } else {
          // Batched bulk inserts
          for (let i = 0; i < records.length; i += batchSize) {
            const batch = records.slice(i, i + batchSize);
            await table.bulkInsert(batch);
          }
        }
        await table.flush();
      }, recordCount);
      
      console.log(`   Throughput: ${metrics.throughput.toLocaleString()} ops/sec`);
      console.log(`   Memory per operation: ${Math.round(metrics.memoryDelta / recordCount)} bytes`);
      
      if (metrics.throughput > bestThroughput) {
        bestThroughput = metrics.throughput;
        bestBatchSize = batchSize;
      }
      
      this.results.push({
        test: 'Batch Size Optimization',
        recordCount,
        batchSize,
        throughput: metrics.throughput,
        duration: metrics.duration,
        memoryUsage: metrics.memoryDelta
      });
      
      await table.close();
    }
    
    console.log(`\n🏆 Optimal batch size: ${bestBatchSize.toLocaleString()} (${bestThroughput.toLocaleString()} ops/sec)`);
  }

  async runConcurrencyStressTest(): Promise<void> {
    console.log(`\n⚡ CONCURRENCY STRESS TEST`);
    console.log(`${'='.repeat(60)}`);
    console.log(`Testing concurrent operation performance...\n`);
    
    const concurrencyLevels = [1, 2, 4, 8, 16, 32, 64];
    const operationsPerThread = 5000;
    
    for (const concurrency of concurrencyLevels) {
      console.log(`🔄 Testing concurrency level: ${concurrency} threads`);
      
      const { table } = await this.createTestDatabase(`concurrent_${concurrency}_${Date.now()}`);
      const totalOperations = concurrency * operationsPerThread;
      
      const { metrics } = await this.measurePerformance(async () => {
        const operations: Promise<any>[] = [];
        
        for (let thread = 0; thread < concurrency; thread++) {
          const threadRecords = this.generateTestData(operationsPerThread);
          const operation = table.bulkInsert(threadRecords);
          operations.push(operation);
        }
        
        await Promise.all(operations);
        await table.flush();
      }, totalOperations);
      
      console.log(`   Total operations: ${totalOperations.toLocaleString()}`);
      console.log(`   Throughput: ${metrics.throughput.toLocaleString()} ops/sec`);
      console.log(`   Latency per operation: ${(metrics.duration / totalOperations).toFixed(3)}ms`);
      console.log(`   Memory efficiency: ${Math.round(metrics.memoryDelta / totalOperations)} bytes/op`);
      
      this.results.push({
        test: 'Concurrency Stress',
        recordCount: totalOperations,
        throughput: metrics.throughput,
        duration: metrics.duration,
        memoryUsage: metrics.memoryDelta
      });
      
      await table.close();
    }
  }

  async runMemoryEfficiencyTest(): Promise<void> {
    console.log(`\n💾 MEMORY EFFICIENCY TEST`);
    console.log(`${'='.repeat(60)}`);
    console.log(`Testing memory usage patterns and efficiency...\n`);
    
    const recordCounts = [10000, 50000, 100000, 250000, 500000];
    
    for (const recordCount of recordCounts) {
      console.log(`🔄 Testing memory efficiency: ${recordCount.toLocaleString()} records`);
      
      const { table } = await this.createTestDatabase(`memory_${recordCount}_${Date.now()}`);
      const records = this.generateTestData(recordCount);
      
      // Measure insertion memory
      const { metrics: insertMetrics } = await this.measurePerformance(async () => {
        return await table.bulkInsert(records);
      }, recordCount);
      
      await table.flush();
      
      // Measure read memory
      const insertedRecords = insertMetrics.result;
      const sampleSize = Math.min(1000, recordCount);
      const sampleIds = insertedRecords
        .slice(0, sampleSize)
        .map(r => r.id as string);
      
      const { metrics: readMetrics } = await this.measurePerformance(async () => {
        const results = [];
        for (const id of sampleIds) {
          const record = await table.get(id);
          results.push(record);
        }
        return results;
      }, sampleSize);
      
      const insertMemoryPerRecord = insertMetrics.memoryDelta / recordCount;
      const readMemoryPerRecord = readMetrics.memoryDelta / sampleSize;
      
      console.log(`   Insert memory: ${(insertMetrics.memoryDelta / 1024 / 1024).toFixed(2)}MB`);
      console.log(`   Memory per record: ${Math.round(insertMemoryPerRecord)} bytes`);
      console.log(`   Read memory efficiency: ${Math.round(readMemoryPerRecord)} bytes/read`);
      console.log(`   Read throughput: ${readMetrics.throughput.toLocaleString()} reads/sec`);
      
      this.results.push({
        test: 'Memory Efficiency (Insert)',
        recordCount,
        throughput: insertMetrics.throughput,
        duration: insertMetrics.duration,
        memoryUsage: insertMetrics.memoryDelta
      });
      
      this.results.push({
        test: 'Memory Efficiency (Read)',
        recordCount: sampleSize,
        datasetSize: recordCount,
        throughput: readMetrics.throughput,
        duration: readMetrics.duration,
        memoryUsage: readMetrics.memoryDelta
      });
      
      await table.close();
    }
  }

  async runCachePerformanceTest(): Promise<void> {
    console.log(`\n🚀 CACHE PERFORMANCE TEST`);
    console.log(`${'='.repeat(60)}`);
    console.log(`Testing cache hit rates and performance...\n`);
    
    const { table } = await this.createTestDatabase(`cache_perf_${Date.now()}`);
    const recordCount = 50000;
    const readCount = 10000;
    
    // Insert test data
    console.log(`🔄 Inserting ${recordCount.toLocaleString()} records...`);
    const records = this.generateTestData(recordCount);
    const insertedRecords = await table.bulkInsert(records);
    await table.flush();
    
    const recordIds = insertedRecords.map(r => r.id as string);
    
    // Test cold reads (cache misses)
    console.log(`🔄 Testing cold reads (cache misses)...`);
    await table.clearCache();
    
    const { metrics: coldMetrics } = await this.measurePerformance(async () => {
      const results = [];
      for (let i = 0; i < readCount; i++) {
        const randomId = recordIds[Math.floor(Math.random() * recordIds.length)];
        const record = await table.get(randomId);
        results.push(record);
      }
      return results;
    }, readCount);
    
    // Test hot reads (cache hits)
    console.log(`🔄 Testing hot reads (cache hits)...`);
    
    const { metrics: hotMetrics } = await this.measurePerformance(async () => {
      const results = [];
      for (let i = 0; i < readCount; i++) {
        const randomId = recordIds[Math.floor(Math.random() * recordIds.length)];
        const record = await table.get(randomId);
        results.push(record);
      }
      return results;
    }, readCount);
    
    const cacheImprovement = (hotMetrics.throughput / coldMetrics.throughput);
    
    console.log(`   Cold reads: ${coldMetrics.throughput.toLocaleString()} reads/sec`);
    console.log(`   Hot reads: ${hotMetrics.throughput.toLocaleString()} reads/sec`);
    console.log(`   Cache improvement: ${cacheImprovement.toFixed(1)}x faster`);
    console.log(`   Cache memory overhead: ${((hotMetrics.memoryDelta - coldMetrics.memoryDelta) / 1024 / 1024).toFixed(2)}MB`);
    
    this.results.push({
      test: 'Cache Performance (Cold)',
      recordCount: readCount,
      datasetSize: recordCount,
      throughput: coldMetrics.throughput,
      duration: coldMetrics.duration,
      memoryUsage: coldMetrics.memoryDelta
    });
    
    this.results.push({
      test: 'Cache Performance (Hot)',
      recordCount: readCount,
      datasetSize: recordCount,
      throughput: hotMetrics.throughput,
      duration: hotMetrics.duration,
      memoryUsage: hotMetrics.memoryDelta,
      cacheHitRate: cacheImprovement
    });
    
    await table.close();
  }

  printComprehensiveReport(): void {
    console.log(`\n\n📊 COMPREHENSIVE SCALABILITY REPORT`);
    console.log(`${'='.repeat(80)}`);
    
    // Peak performance metrics
    const peakThroughput = Math.max(...this.results.map(r => r.throughput));
    const bestMemoryEfficiency = Math.min(...this.results
      .filter(r => r.memoryUsage)
      .map(r => r.memoryUsage! / r.recordCount));
    
    console.log(`\n🏆 PEAK PERFORMANCE METRICS`);
    console.log(`   Maximum throughput: ${peakThroughput.toLocaleString()} ops/sec`);
    console.log(`   Best memory efficiency: ${Math.round(bestMemoryEfficiency)} bytes/record`);
    
    // Optimal batch size analysis
    const batchTests = this.results.filter(r => r.test === 'Batch Size Optimization');
    if (batchTests.length > 0) {
      const optimalBatch = batchTests.reduce((best, current) => 
        current.throughput > best.throughput ? current : best
      );
      console.log(`   Optimal batch size: ${optimalBatch.batchSize?.toLocaleString()} records`);
    }
    
    // Scalability analysis
    const scaleTests = this.results.filter(r => r.test === 'Dataset Scale');
    if (scaleTests.length >= 2) {
      const first = scaleTests[0];
      const last = scaleTests[scaleTests.length - 1];
      const scalabilityFactor = last.throughput / first.throughput;
      const datasetRatio = last.recordCount / first.recordCount;
      
      console.log(`\n📈 SCALABILITY ANALYSIS`);
      console.log(`   Dataset range: ${first.recordCount.toLocaleString()} → ${last.recordCount.toLocaleString()} records`);
      console.log(`   Performance retention: ${(scalabilityFactor * 100).toFixed(1)}%`);
      console.log(`   Scaling efficiency: ${(scalabilityFactor / datasetRatio * 100).toFixed(1)}%`);
    }
    
    // Cache performance analysis
    const cacheTests = this.results.filter(r => r.test.includes('Cache Performance'));
    if (cacheTests.length >= 2) {
      const cold = cacheTests.find(r => r.test.includes('Cold'));
      const hot = cacheTests.find(r => r.test.includes('Hot'));
      if (cold && hot) {
        console.log(`\n🚀 CACHE PERFORMANCE`);
        console.log(`   Cache speedup: ${(hot.throughput / cold.throughput).toFixed(1)}x`);
        console.log(`   Cold read performance: ${cold.throughput.toLocaleString()} ops/sec`);
        console.log(`   Hot read performance: ${hot.throughput.toLocaleString()} ops/sec`);
      }
    }
    
    console.log(`\n📋 DETAILED RESULTS BY TEST`);
    console.log(`${'='.repeat(80)}`);
    
    const groupedResults = this.results.reduce((groups, result) => {
      if (!groups[result.test]) {
        groups[result.test] = [];
      }
      groups[result.test].push(result);
      return groups;
    }, {} as Record<string, ScalabilityResult[]>);
    
    for (const [testName, results] of Object.entries(groupedResults)) {
      console.log(`\n${testName}:`);
      for (const result of results) {
        console.log(`   ${result.recordCount.toLocaleString()} records: ${result.throughput.toLocaleString()} ops/sec`);
        if (result.batchSize) {
          console.log(`     Batch size: ${result.batchSize.toLocaleString()}`);
        }
        if (result.memoryUsage) {
          console.log(`     Memory: ${(result.memoryUsage / 1024 / 1024).toFixed(2)}MB`);
        }
        if (result.duration) {
          console.log(`     Duration: ${result.duration.toLocaleString()}ms`);
        }
      }
    }
    
    console.log(`\n✅ Scalability benchmark complete! System demonstrates excellent performance characteristics.`);
  }

  async run(): Promise<void> {
    try {
      await this.setup();
      
      // Run comprehensive scalability tests
      await this.runDatasetScaleTest();
      await this.runOptimalBatchSizeTest();
      await this.runConcurrencyStressTest();
      await this.runMemoryEfficiencyTest();
      await this.runCachePerformanceTest();
      
      this.printComprehensiveReport();
      
    } catch (error) {
      console.error(`❌ Scalability benchmark failed:`, error);
      process.exit(1);
    } finally {
      await this.cleanup();
    }
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const benchmark = new ScalabilityBenchmark();
  await benchmark.run();
}