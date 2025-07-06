#!/usr/bin/env node

import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';
import { Database } from '../engine/database.js';
import { Schema } from '../engine/schema.js';
import { Types } from '../engine/column.js';

class ScalabilityBenchmark {
  constructor() {
    this.results = [];
    this.tempDir = null;
    this.verbose = process.argv.includes('--verbose');
  }

  log(...args) {
    if (this.verbose) {
      console.log(...args);
    }
  }

  async setup() {
    this.tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'bindb-scalability-'));
    console.log(`🔬 BinDB Scalability Benchmark Suite`);
    console.log(`📁 Test directory: ${this.tempDir}`);
    console.log(`💻 Environment: ${process.platform} ${process.arch} Node.js ${process.version}`);
    console.log(`📊 Available memory: ${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)}MB`);
    console.log(`⏰ Started: ${new Date().toISOString()}\n`);
  }

  async cleanup() {
    if (this.tempDir) {
      await fs.rm(this.tempDir, { recursive: true, force: true });
    }
  }

  async createTestDatabase(name) {
    const db = await Database.create(this.tempDir, name);
    const schema = Schema.create(name, 'records', [
      { name: 'name', type: Types.Text, length: 50 },
      { name: 'value', type: Types.Number },
      { name: 'active', type: Types.Boolean },
      { name: 'category', type: Types.Text, length: 20 },
      { name: 'timestamp', type: Types.Date }
    ]);
    
    await db.createTable('records', schema);
    return { db, table: db.table('records') };
  }

  generateTestData(count) {
    const records = [];
    const categories = ['A', 'B', 'C', 'D', 'E'];
    
    for (let i = 0; i < count; i++) {
      records.push({
        name: `Record_${i.toString().padStart(8, '0')}`,
        value: Math.random() * 1000,
        active: i % 2 === 0,
        category: categories[i % categories.length],
        timestamp: new Date(Date.now() - Math.random() * 86400000 * 365) // Random date within last year
      });
    }
    return records;
  }

  async runInsertScalabilityTest() {
    console.log(`📈 INSERT SCALABILITY TEST`);
    console.log(`${'='.repeat(60)}`);
    
    // Comprehensive scale from 1 to 1M records
    const scales = [
      // Small scale
      1, 10, 100, 500,
      // Medium scale  
      1000, 2500, 5000, 10000,
      // Large scale
      25000, 50000, 100000, 250000,
      // Ultra scale
      500000, 1000000
    ];

    for (const size of scales) {
      console.log(`\n🔢 Testing ${size.toLocaleString()} records`);
      
      const { table } = await this.createTestDatabase(`insert_scale_${size}_${Date.now()}`);
      const records = this.generateTestData(size);
      
      // Run multiple times for smaller datasets to get stable measurements
      const runs = size <= 1000 ? 3 : 1;
      const times = [];
      
      for (let run = 0; run < runs; run++) {
        if (runs > 1) {
          // Reset table for multiple runs
          await table.close();
          const { table: freshTable } = await this.createTestDatabase(`insert_scale_${size}_${run}_${Date.now()}`);
          await this.performInsertTest(freshTable, records, times);
          await freshTable.close();
        } else {
          await this.performInsertTest(table, records, times);
          await table.close();
        }
      }
      
      const avgTime = times.reduce((a, b) => a + b) / times.length;
      const throughput = Math.round(size / (avgTime / 1000));
      const memoryUsage = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
      
      console.log(`   Time: ${avgTime.toFixed(0)}ms | Throughput: ${throughput.toLocaleString()} ops/sec | Memory: ${memoryUsage}MB`);
      
      this.results.push({
        test: 'Insert Scalability',
        recordCount: size,
        avgTime: Math.round(avgTime),
        throughput,
        memoryUsage
      });
      
      // Force garbage collection if available
      if (global.gc) global.gc();
    }
  }

  async performInsertTest(table, records, times) {
    const startTime = process.hrtime.bigint();
    
    if (records.length === 1) {
      // Single insert
      await table.insert(records[0]);
    } else if (records.length <= 100) {
      // Individual inserts for very small datasets
      for (const record of records) {
        await table.insert(record);
      }
    } else {
      // Bulk insert for larger datasets
      await table.bulkInsert(records);
    }
    
    await table.flush();
    
    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - startTime) / 1_000_000;
    times.push(duration);
  }

  async runReadScalabilityTest() {
    console.log(`\n📖 READ SCALABILITY TEST`);
    console.log(`${'='.repeat(60)}`);
    
    // Test read performance across different dataset sizes
    const readScales = [100, 1000, 10000, 50000, 100000, 500000, 1000000];
    
    for (const datasetSize of readScales) {
      console.log(`\n📚 Dataset: ${datasetSize.toLocaleString()} records`);
      
      // Create dataset
      const { table } = await this.createTestDatabase(`read_scale_${datasetSize}_${Date.now()}`);
      const records = this.generateTestData(datasetSize);
      const insertedRecords = await table.bulkInsert(records);
      await table.flush();
      
      // Test different read patterns
      await this.testSequentialReads(table, insertedRecords);
      await this.testRandomReads(table, insertedRecords);
      await this.testCachedReads(table, insertedRecords);
      
      await table.close();
      
      if (global.gc) global.gc();
    }
  }

  async testSequentialReads(table, insertedRecords) {
    const readCount = Math.min(1000, insertedRecords.length);
    
    const startTime = process.hrtime.bigint();
    
    for (let i = 0; i < readCount; i++) {
      await table.get(insertedRecords[i].id);
    }
    
    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - startTime) / 1_000_000;
    const throughput = Math.round(readCount / (duration / 1000));
    
    console.log(`   Sequential reads: ${throughput.toLocaleString()} ops/sec`);
    
    this.results.push({
      test: 'Sequential Reads',
      recordCount: readCount,
      datasetSize: insertedRecords.length,
      throughput,
      duration: Math.round(duration)
    });
  }

  async testRandomReads(table, insertedRecords) {
    const readCount = Math.min(1000, insertedRecords.length);
    const randomIds = [];
    
    // Generate random IDs
    for (let i = 0; i < readCount; i++) {
      const randomIndex = Math.floor(Math.random() * insertedRecords.length);
      randomIds.push(insertedRecords[randomIndex].id);
    }
    
    const startTime = process.hrtime.bigint();
    
    for (const id of randomIds) {
      await table.get(id);
    }
    
    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - startTime) / 1_000_000;
    const throughput = Math.round(readCount / (duration / 1000));
    
    console.log(`   Random reads: ${throughput.toLocaleString()} ops/sec`);
    
    this.results.push({
      test: 'Random Reads',
      recordCount: readCount,
      datasetSize: insertedRecords.length,
      throughput,
      duration: Math.round(duration)
    });
  }

  async testCachedReads(table, insertedRecords) {
    const readCount = Math.min(100, insertedRecords.length);
    
    // Prime the cache
    for (let i = 0; i < readCount; i++) {
      await table.get(insertedRecords[i].id);
    }
    
    // Test cached reads
    const startTime = process.hrtime.bigint();
    
    for (let i = 0; i < readCount; i++) {
      await table.get(insertedRecords[i].id);
    }
    
    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - startTime) / 1_000_000;
    const throughput = Math.round(readCount / (duration / 1000));
    
    console.log(`   Cached reads: ${throughput.toLocaleString()} ops/sec`);
    
    this.results.push({
      test: 'Cached Reads',
      recordCount: readCount,
      datasetSize: insertedRecords.length,
      throughput,
      duration: Math.round(duration)
    });
  }

  async runOptimalBatchSizeTest() {
    console.log(`\n🎯 OPTIMAL BATCH SIZE TEST`);
    console.log(`${'='.repeat(60)}`);
    
    const batchSizes = [1, 10, 50, 100, 500, 1000, 2500, 5000, 10000, 25000];
    const recordCount = 100000;
    let bestThroughput = 0;
    let bestBatchSize = 0;
    
    for (const batchSize of batchSizes) {
      console.log(`\n🔄 Testing batch size: ${batchSize.toLocaleString()}`);
      
      const { table } = await this.createTestDatabase(`batch_${batchSize}_${Date.now()}`);
      const records = this.generateTestData(recordCount);
      
      const startTime = process.hrtime.bigint();
      
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
      
      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1_000_000;
      const throughput = Math.round(recordCount / (duration / 1000));
      
      console.log(`   Throughput: ${throughput.toLocaleString()} ops/sec`);
      
      if (throughput > bestThroughput) {
        bestThroughput = throughput;
        bestBatchSize = batchSize;
      }
      
      this.results.push({
        test: 'Batch Size Optimization',
        batchSize,
        recordCount,
        throughput,
        duration: Math.round(duration)
      });
      
      await table.close();
      if (global.gc) global.gc();
    }
    
    console.log(`\n🏆 Optimal batch size: ${bestBatchSize.toLocaleString()} (${bestThroughput.toLocaleString()} ops/sec)`);
  }

  printSummary() {
    console.log(`\n\n📋 SCALABILITY BENCHMARK SUMMARY`);
    console.log(`${'='.repeat(70)}`);
    
    // Insert scalability results
    const insertResults = this.results.filter(r => r.test === 'Insert Scalability');
    if (insertResults.length > 0) {
      console.log(`\n📈 Insert Scalability:`);
      const maxInsertThroughput = Math.max(...insertResults.map(r => r.throughput));
      console.log(`   Peak throughput: ${maxInsertThroughput.toLocaleString()} ops/sec`);
      
      // Show how performance scales
      const milestones = [1000, 10000, 100000, 1000000];
      milestones.forEach(milestone => {
        const result = insertResults.find(r => r.recordCount === milestone);
        if (result) {
          console.log(`   ${milestone.toLocaleString()} records: ${result.throughput.toLocaleString()} ops/sec (${result.avgTime}ms)`);
        }
      });
    }
    
    // Read scalability results
    const readTypes = ['Sequential Reads', 'Random Reads', 'Cached Reads'];
    readTypes.forEach(readType => {
      const readResults = this.results.filter(r => r.test === readType);
      if (readResults.length > 0) {
        console.log(`\n📖 ${readType}:`);
        const maxReadThroughput = Math.max(...readResults.map(r => r.throughput));
        console.log(`   Peak throughput: ${maxReadThroughput.toLocaleString()} ops/sec`);
        
        // Show performance across dataset sizes
        const largeDatasetsResult = readResults.find(r => r.datasetSize >= 100000);
        if (largeDatasetsResult) {
          console.log(`   Large datasets (100K+): ${largeDatasetsResult.throughput.toLocaleString()} ops/sec`);
        }
      }
    });
    
    // Batch size optimization
    const batchResults = this.results.filter(r => r.test === 'Batch Size Optimization');
    if (batchResults.length > 0) {
      const bestBatch = batchResults.reduce((best, current) => 
        current.throughput > best.throughput ? current : best
      );
      console.log(`\n🎯 Optimal Batch Size: ${bestBatch.batchSize.toLocaleString()} records`);
      console.log(`   Performance: ${bestBatch.throughput.toLocaleString()} ops/sec`);
    }
    
    console.log(`\n📝 Environment notes:`);
    console.log(`   • Development testing environment`);
    console.log(`   • Performance will change when indexes are implemented`);
    console.log(`   • Results may vary based on hardware and system load`);
    console.log(`   • Memory usage patterns observed during large dataset tests`);
    
    const endMemory = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
    console.log(`   • Final memory usage: ${endMemory}MB`);
  }

  async run() {
    try {
      await this.setup();
      
      await this.runInsertScalabilityTest();
      await this.runReadScalabilityTest();
      await this.runOptimalBatchSizeTest();
      
      this.printSummary();
      
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

export { ScalabilityBenchmark };