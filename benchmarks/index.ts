#!/usr/bin/env node

import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';
import { Database } from '../engine/database.js';
import { Schema, type ColumnDefinition } from '../engine/schema.js';
import { Types } from '../engine/column.js';
import type { Table } from '../engine/table.js';

interface BenchmarkResult {
  test: string;
  recordCount: number;
  throughput?: number;
  duration?: number;
  efficiency?: string;
  memory?: number;
}

interface PerformanceMetrics {
  duration: number;
  throughput: number;
  memory: NodeJS.MemoryUsage;
}

interface TestRecord {
  name: string;
  value: number;
  active: boolean;
  category: string;
}

interface DatabaseSetup {
  db: Database;
  table: Table;
}

interface ReadBenchmarkResult {
  cold: number;
  cached: number;
}

class UnifiedBenchmarkSuite {
  private results: BenchmarkResult[] = [];
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
    this.tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'bindb-unified-bench-'));
    console.log(`🧪 BinDB Development Benchmark Suite`);
    console.log(`📁 Test directory: ${this.tempDir}`);
    console.log(`💻 Environment: ${process.platform} ${process.arch} Node.js ${process.version}`);
    console.log(`📊 Available memory: ${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)}MB\n`);
  }

  async cleanup(): Promise<void> {
    if (this.tempDir) {
      await fs.rm(this.tempDir, { recursive: true, force: true });
    }
  }

  async createTestDatabase(name: string): Promise<DatabaseSetup> {
    if (!this.tempDir) {
      throw new Error('Benchmark suite not initialized');
    }

    const db = await Database.create(this.tempDir, name);
    
    const columns: ColumnDefinition[] = [
      { name: 'name', type: Types.Text, length: 50 },
      { name: 'value', type: Types.Number },
      { name: 'active', type: Types.Boolean },
      { name: 'category', type: Types.Text, length: 20 }
    ];
    
    const schema = Schema.create(name, 'records', columns);
    await db.createTable('records', schema);
    
    return { db, table: db.table('records') };
  }

  generateTestData(count: number): TestRecord[] {
    const categories = ['web', 'mobile', 'api', 'database', 'cache'];
    const names = ['user', 'session', 'request', 'response', 'query', 'data', 'config'];
    
    return Array.from({ length: count }, (_, i) => ({
      name: `${names[i % names.length]}_${i}`,
      value: Math.random() * 1000,
      active: Math.random() > 0.5,
      category: categories[i % categories.length]
    }));
  }

  private measurePerformance<T>(operation: () => Promise<T>): Promise<{ result: T; metrics: PerformanceMetrics }> {
    return new Promise(async (resolve) => {
      const startMemory = process.memoryUsage();
      const startTime = process.hrtime.bigint();

      const result = await operation();

      const endTime = process.hrtime.bigint();
      const endMemory = process.memoryUsage();
      
      const duration = Number(endTime - startTime) / 1_000_000; // Convert to milliseconds
      const throughput = 1000 / duration; // Operations per second

      resolve({
        result,
        metrics: {
          duration,
          throughput,
          memory: endMemory
        }
      });
    });
  }

  async benchmarkIndividualInserts(recordCount: number = 1000): Promise<number> {
    console.log(`\n🔄 Individual Insert Test (${recordCount.toLocaleString()} records)`);
    
    const { table } = await this.createTestDatabase(`individual_${Date.now()}`);
    const records = this.generateTestData(recordCount);
    
    const startTime = process.hrtime.bigint();
    
    for (let i = 0; i < recordCount; i++) {
      await table.insert(records[i]);
      
      if (i % 100 === 0 && i > 0) {
        this.log(`   Inserted ${i} records...`);
      }
    }
    
    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - startTime) / 1_000_000;
    const throughput = (recordCount / duration) * 1000;
    
    console.log(`   Duration: ${duration.toFixed(2)}ms`);
    console.log(`   Throughput: ${throughput.toLocaleString()} records/sec`);
    
    await table.close();
    this.results.push({ test: 'Individual Inserts', recordCount, throughput, duration });
    
    return throughput;
  }

  async benchmarkBulkInsert(recordCount: number = 1000): Promise<number> {
    console.log(`\n⚡ Bulk Insert Test (${recordCount.toLocaleString()} records)`);
    
    const { table } = await this.createTestDatabase(`bulk_${Date.now()}`);
    const records = this.generateTestData(recordCount);
    
    const startTime = process.hrtime.bigint();
    await table.bulkInsert(records);
    const endTime = process.hrtime.bigint();
    
    const duration = Number(endTime - startTime) / 1_000_000;
    const throughput = (recordCount / duration) * 1000;
    
    console.log(`   Duration: ${duration.toFixed(2)}ms`);
    console.log(`   Throughput: ${throughput.toLocaleString()} records/sec`);
    
    await table.close();
    this.results.push({ test: 'Bulk Insert', recordCount, throughput, duration });
    
    return throughput;
  }

  async benchmarkReads(recordCount: number = 1000): Promise<ReadBenchmarkResult> {
    console.log(`\n📖 Read Performance Test (${recordCount.toLocaleString()} records)`);
    
    const { table } = await this.createTestDatabase(`reads_${Date.now()}`);
    const records = this.generateTestData(recordCount);
    
    // Insert test data
    const insertedRecords = await table.bulkInsert(records);
    const recordIds = insertedRecords.map(r => r.id);
    
    // Cold read test (clear cache)
    await table.clearCache();
    
    const coldStartTime = process.hrtime.bigint();
    for (let i = 0; i < Math.min(100, recordCount); i++) {
      await table.findById(recordIds[i]);
    }
    const coldEndTime = process.hrtime.bigint();
    
    const coldDuration = Number(coldEndTime - coldStartTime) / 1_000_000;
    const coldThroughput = (Math.min(100, recordCount) / coldDuration) * 1000;
    
    console.log(`   Cold reads: ${coldThroughput.toLocaleString()} reads/sec`);
    
    // Cached read test
    const cachedStartTime = process.hrtime.bigint();
    for (let i = 0; i < Math.min(100, recordCount); i++) {
      await table.findById(recordIds[i]);
    }
    const cachedEndTime = process.hrtime.bigint();
    
    const cachedDuration = Number(cachedEndTime - cachedStartTime) / 1_000_000;
    const cachedThroughput = (Math.min(100, recordCount) / cachedDuration) * 1000;
    
    console.log(`   Cached reads: ${cachedThroughput.toLocaleString()} reads/sec`);
    console.log(`   Cache improvement: ${(cachedThroughput / coldThroughput).toFixed(1)}x`);
    
    await table.close();
    this.results.push({ test: 'Cold Reads', recordCount: Math.min(100, recordCount), throughput: coldThroughput, duration: coldDuration });
    this.results.push({ test: 'Cached Reads', recordCount: Math.min(100, recordCount), throughput: cachedThroughput, duration: cachedDuration });
    
    return { cold: coldThroughput, cached: cachedThroughput };
  }

  async benchmarkArchitecture(): Promise<void> {
    console.log(`\n🏗️  Architecture Component Test`);
    
    const { table } = await this.createTestDatabase(`arch_${Date.now()}`);
    
    // Insert data and check component utilization
    const records = this.generateTestData(1000);
    await table.bulkInsert(records);
    
    const stats = table.getStats();
    this.log('   Component utilization:');
    this.log(`     WriteBuffer: ${stats.writeBuffer.recordUtilization}`);
    this.log(`     ReadCache: ${stats.cache.utilization}`);
    
    console.log(`   Records stored: ${stats.records}`);
    console.log(`   Buffer efficiency: ${stats.writeBuffer.recordUtilization}`);
    
    await table.flush();
    await table.close();
    
    this.results.push({ test: 'Architecture', recordCount: 1000, efficiency: stats.writeBuffer.recordUtilization });
  }

  async benchmarkMemoryUsage(): Promise<void> {
    console.log(`\n💾 Memory Usage Test`);
    
    const beforeMemory = process.memoryUsage();
    
    const { table } = await this.createTestDatabase(`memory_${Date.now()}`);
    const records = this.generateTestData(5000);
    
    await table.bulkInsert(records);
    
    const afterMemory = process.memoryUsage();
    const memoryIncrease = afterMemory.heapUsed - beforeMemory.heapUsed;
    const bytesPerRecord = memoryIncrease / records.length;
    
    console.log(`   Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);
    console.log(`   Bytes per record: ${bytesPerRecord.toFixed(0)} bytes`);
    console.log(`   Heap utilization: ${(afterMemory.heapUsed / afterMemory.heapTotal * 100).toFixed(1)}%`);
    
    await table.close();
    this.results.push({ test: 'Memory Usage', recordCount: 5000, memory: memoryIncrease });
  }

  async benchmarkConcurrentOperations(): Promise<void> {
    console.log(`\n🔄 Concurrent Operations Test`);
    
    const { table } = await this.createTestDatabase(`concurrent_${Date.now()}`);
    const recordsPerBatch = 200;
    const batchCount = 5;
    
    const startTime = process.hrtime.bigint();
    
    // Run concurrent insert operations
    const operations: Promise<any>[] = [];
    for (let i = 0; i < batchCount; i++) {
      const batchRecords = this.generateTestData(recordsPerBatch);
      operations.push(table.bulkInsert(batchRecords));
    }
    
    const results = await Promise.all(operations);
    const endTime = process.hrtime.bigint();
    
    const totalRecords = recordsPerBatch * batchCount;
    const duration = Number(endTime - startTime) / 1_000_000;
    const throughput = (totalRecords / duration) * 1000;
    
    console.log(`   Batches: ${batchCount} x ${recordsPerBatch} records`);
    console.log(`   Duration: ${duration.toFixed(2)}ms`);
    console.log(`   Throughput: ${throughput.toLocaleString()} records/sec`);
    
    await table.close();
    this.results.push({ test: 'Concurrent Operations', recordCount: totalRecords, throughput, duration });
  }

  printSummary(): void {
    console.log(`\n\n📋 BENCHMARK SUMMARY`);
    console.log(`${'='.repeat(50)}`);
    
    const throughputResults = this.results.filter(r => r.throughput);
    if (throughputResults.length > 0) {
      const maxThroughput = Math.max(...throughputResults.map(r => r.throughput!));
      console.log(`📈 Peak throughput: ${maxThroughput.toLocaleString()} ops/sec`);
      
      // Compare bulk vs individual
      const individualResult = this.results.find(r => r.test === 'Individual Inserts');
      const bulkResult = this.results.find(r => r.test === 'Bulk Insert');
      
      if (individualResult && bulkResult) {
        const improvement = (bulkResult.throughput! / individualResult.throughput!).toFixed(1);
        console.log(`🚀 Bulk insert improvement: ${improvement}x over individual inserts`);
      }
    }
    
    console.log(`\n📊 Results by test:`);
    for (const result of this.results) {
      console.log(`   ${result.test}: ${result.recordCount.toLocaleString()} records`);
      if (result.throughput) {
        console.log(`     Throughput: ${result.throughput.toLocaleString()} ops/sec`);
      }
      if (result.duration) {
        console.log(`     Duration: ${result.duration.toFixed(2)}ms`);
      }
      if (result.efficiency) {
        console.log(`     Efficiency: ${result.efficiency}`);
      }
      if (result.memory) {
        console.log(`     Memory: ${(result.memory / 1024 / 1024).toFixed(2)}MB`);
      }
    }
    
    console.log(`\n✅ Benchmark complete!`);
  }

  async run(): Promise<void> {
    try {
      await this.setup();
      
      // Run benchmark suite
      await this.benchmarkIndividualInserts(1000);
      await this.benchmarkBulkInsert(1000);
      await this.benchmarkReads(1000);
      await this.benchmarkArchitecture();
      await this.benchmarkMemoryUsage();
      await this.benchmarkConcurrentOperations();
      
      this.printSummary();
      
    } catch (error) {
      console.error(`❌ Benchmark failed:`, error);
      process.exit(1);
    } finally {
      await this.cleanup();
    }
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const suite = new UnifiedBenchmarkSuite();
  await suite.run();
}