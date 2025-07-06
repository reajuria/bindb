#!/usr/bin/env node

import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';
import { Database } from '../engine/database.js';
import { Schema } from '../engine/schema.js';
import { Types } from '../engine/column.js';

class UnifiedBenchmarkSuite {
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
    this.tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'bindb-unified-bench-'));
    console.log(`🧪 BinDB Development Benchmark Suite`);
    console.log(`📁 Test directory: ${this.tempDir}`);
    console.log(`💻 Environment: ${process.platform} ${process.arch} Node.js ${process.version}`);
    console.log(`📊 Available memory: ${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)}MB\n`);
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
      { name: 'category', type: Types.Text, length: 20 }
    ]);
    
    await db.createTable('records', schema);
    return { db, table: db.table('records') };
  }

  generateTestData(count) {
    const records = [];
    for (let i = 0; i < count; i++) {
      records.push({
        name: `Record_${i}`,
        value: Math.random() * 1000,
        active: i % 2 === 0,
        category: `Cat_${i % 5}`
      });
    }
    return records;
  }

  async benchmarkIndividualInserts(recordCount = 1000) {
    console.log(`\n📊 Individual Insert Test (${recordCount.toLocaleString()} records)`);
    
    const { table } = await this.createTestDatabase(`individual_${Date.now()}`);
    const records = this.generateTestData(recordCount);
    
    if (global.gc) global.gc();
    const startTime = process.hrtime.bigint();
    
    for (const record of records) {
      await table.insert(record);
    }
    await table.flush();
    
    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - startTime) / 1_000_000;
    const throughput = Math.round(recordCount / (duration / 1000));
    
    this.log(`   Duration: ${duration.toFixed(0)}ms`);
    console.log(`   Throughput: ${throughput.toLocaleString()} inserts/sec`);
    
    await table.close();
    this.results.push({ test: 'Individual Inserts', recordCount, throughput, duration });
    return throughput;
  }

  async benchmarkBulkInserts(recordCount = 10000) {
    console.log(`\n📦 Bulk Insert Test (${recordCount.toLocaleString()} records)`);
    
    const { table } = await this.createTestDatabase(`bulk_${Date.now()}`);
    const records = this.generateTestData(recordCount);
    
    if (global.gc) global.gc();
    const startTime = process.hrtime.bigint();
    
    await table.bulkInsert(records);
    await table.flush();
    
    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - startTime) / 1_000_000;
    const throughput = Math.round(recordCount / (duration / 1000));
    
    this.log(`   Duration: ${duration.toFixed(0)}ms`);
    console.log(`   Throughput: ${throughput.toLocaleString()} inserts/sec`);
    
    await table.close();
    this.results.push({ test: 'Bulk Insert', recordCount, throughput, duration });
    return throughput;
  }

  async benchmarkReads(recordCount = 1000) {
    console.log(`\n📖 Read Performance Test (${recordCount.toLocaleString()} records)`);
    
    const { table } = await this.createTestDatabase(`reads_${Date.now()}`);
    const records = this.generateTestData(recordCount);
    
    // Insert test data
    const insertedRecords = await table.bulkInsert(records);
    await table.flush();
    
    // Test cold reads
    if (global.gc) global.gc();
    const coldStartTime = process.hrtime.bigint();
    
    for (let i = 0; i < Math.min(100, recordCount); i++) {
      await table.get(insertedRecords[i].id);
    }
    
    const coldEndTime = process.hrtime.bigint();
    const coldDuration = Number(coldEndTime - coldStartTime) / 1_000_000;
    const coldThroughput = Math.round(Math.min(100, recordCount) / (coldDuration / 1000));
    
    // Test cached reads
    const cachedStartTime = process.hrtime.bigint();
    
    for (let i = 0; i < Math.min(100, recordCount); i++) {
      await table.get(insertedRecords[i].id);
    }
    
    const cachedEndTime = process.hrtime.bigint();
    const cachedDuration = Number(cachedEndTime - cachedStartTime) / 1_000_000;
    const cachedThroughput = Math.round(Math.min(100, recordCount) / (cachedDuration / 1000));
    
    this.log(`   Cold reads: ${coldDuration.toFixed(2)}ms`);
    this.log(`   Cached reads: ${cachedDuration.toFixed(2)}ms`);
    console.log(`   Cold throughput: ${coldThroughput.toLocaleString()} reads/sec`);
    console.log(`   Cached throughput: ${cachedThroughput.toLocaleString()} reads/sec`);
    
    await table.close();
    this.results.push({ test: 'Cold Reads', recordCount: Math.min(100, recordCount), throughput: coldThroughput, duration: coldDuration });
    this.results.push({ test: 'Cached Reads', recordCount: Math.min(100, recordCount), throughput: cachedThroughput, duration: cachedDuration });
    
    return { cold: coldThroughput, cached: cachedThroughput };
  }

  async benchmarkArchitecture() {
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

  printSummary() {
    console.log(`\n\n📋 BENCHMARK SUMMARY`);
    console.log(`${'='.repeat(50)}`);
    
    const throughputResults = this.results.filter(r => r.throughput);
    if (throughputResults.length > 0) {
      const maxThroughput = Math.max(...throughputResults.map(r => r.throughput));
      console.log(`📈 Peak throughput: ${maxThroughput.toLocaleString()} ops/sec`);
      
      // Compare bulk vs individual
      const individualResult = this.results.find(r => r.test === 'Individual Inserts');
      const bulkResult = this.results.find(r => r.test === 'Bulk Insert');
      
      if (individualResult && bulkResult) {
        const improvement = (bulkResult.throughput / individualResult.throughput).toFixed(1);
        console.log(`🚀 Bulk insert improvement: ${improvement}x over individual inserts`);
      }
    }
    
    console.log(`\n📊 Results by test:`);
    this.results.forEach(result => {
      if (result.throughput) {
        console.log(`   ${result.test}: ${result.throughput.toLocaleString()} ops/sec`);
      } else if (result.efficiency) {
        console.log(`   ${result.test}: ${result.efficiency} buffer efficiency`);
      }
    });
    
    console.log(`\n📝 Development notes:`);
    console.log(`   • Results from isolated test environment`);
    console.log(`   • Performance will change when indexes are added`);
    console.log(`   • Production performance depends on hardware and load`);
  }

  async run() {
    try {
      await this.setup();
      
      // Quick test suite for CI
      if (process.argv.includes('--quick')) {
        console.log(`⚡ Quick benchmark mode enabled\n`);
        await this.benchmarkIndividualInserts(100);
        await this.benchmarkBulkInserts(1000);
        await this.benchmarkReads(500);
      } else {
        // Full test suite
        await this.benchmarkIndividualInserts(1000);
        await this.benchmarkBulkInserts(10000);
        await this.benchmarkReads(1000);
        await this.benchmarkArchitecture();
      }
      
      this.printSummary();
      
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

export { UnifiedBenchmarkSuite };