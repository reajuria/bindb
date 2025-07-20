import { promises as fs } from 'fs';
import path from 'path';
import { performance } from 'perf_hooks';
import { Types } from '../engine/column.js';
import { Database } from '../engine/database.js';
import { Schema } from '../engine/schema.js';

describe('Database Performance Benchmarks', () => {
  const testDir = './benchmark-data';
  let db: Database;

  beforeAll(async () => {
    // Ensure test directory exists
    try {
      await fs.mkdir(testDir, { recursive: true });
    } catch {
      // Directory might already exist
    }
  });

  afterAll(async () => {
    await db?.close();
    // Cleanup test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  beforeEach(async () => {
    db = new Database(testDir, 'benchmark_db');
    await db.initDatabase();
  });

  afterEach(async () => {
    await db?.close();
  });

  describe('CRUD Performance', () => {
    test('bulk insert performance', async () => {
      const schema = Schema.create('benchmark_db', 'users', [
        { name: 'name', type: Types.Text, length: 50 },
        { name: 'email', type: Types.Text, length: 100 },
        { name: 'age', type: Types.Number },
        { name: 'created_at', type: Types.Date },
      ]);

      await db.createTable('users', schema);
      const table = db.table('users');

      if (table) {
        const recordCount = 1000;
        const records = Array.from({ length: recordCount }, (_, i) => ({
          name: `User ${i}`,
          email: `user${i}@example.com`,
          age: 20 + (i % 50),
          created_at: new Date(),
        }));

        const startTime = performance.now();

        for (const record of records) {
          await table.insert(record);
        }

        const endTime = performance.now();
        const totalTime = endTime - startTime;
        const throughput = recordCount / (totalTime / 1000);

        console.log(`\n📊 Bulk Insert Performance:`);
        console.log(`  Records: ${recordCount}`);
        console.log(`  Total Time: ${totalTime.toFixed(2)}ms`);
        console.log(`  Throughput: ${throughput.toFixed(0)} records/sec`);
        console.log(
          `  Average Time per Record: ${(totalTime / recordCount).toFixed(3)}ms`
        );

        // Performance assertions (relaxed for CI environments)
        const maxTime = process.env.CI ? 20000 : 10000;
        const minThroughput = process.env.CI ? 50 : 100;
        expect(totalTime).toBeLessThan(maxTime);
        expect(throughput).toBeGreaterThan(minThroughput);
      }
    }, 15000);

    test('read performance with various access patterns', async () => {
      const schema = Schema.create('benchmark_db', 'products', [
        { name: 'sku', type: Types.Text, length: 20 },
        { name: 'name', type: Types.Text, length: 100 },
        { name: 'price', type: Types.Number },
        { name: 'category', type: Types.Text, length: 50 },
      ]);

      await db.createTable('products', schema);
      const table = db.table('products');

      if (table) {
        // Insert test data
        const recordCount = 500;
        const insertedIds: string[] = [];
        for (let i = 0; i < recordCount; i++) {
          const record = await table.insert({
            sku: `SKU-${i.toString().padStart(6, '0')}`,
            name: `Product ${i}`,
            price: Math.random() * 1000,
            category: `Category ${i % 10}`,
          });
          insertedIds.push(record.id as string);
        }

        // Sequential read test
        const sequentialStartTime = performance.now();
        for (let i = 0; i < Math.min(100, recordCount); i++) {
          await table.get(insertedIds[i]);
        }
        const sequentialEndTime = performance.now();
        const sequentialTime = sequentialEndTime - sequentialStartTime;

        // Random read test
        const randomStartTime = performance.now();
        for (let i = 0; i < 100; i++) {
          const randomIndex = Math.floor(Math.random() * insertedIds.length);
          await table.get(insertedIds[randomIndex]);
        }
        const randomEndTime = performance.now();
        const randomTime = randomEndTime - randomStartTime;

        console.log(`\n📊 Read Performance:`);
        console.log(`  Sequential Reads (100): ${sequentialTime.toFixed(2)}ms`);
        console.log(`  Random Reads (100): ${randomTime.toFixed(2)}ms`);
        console.log(
          `  Avg Sequential: ${(sequentialTime / 100).toFixed(3)}ms per read`
        );
        console.log(
          `  Avg Random: ${(randomTime / 100).toFixed(3)}ms per read`
        );

        // Performance assertions (relaxed for CI environments)
        const maxSequentialTime = process.env.CI ? 15 : 5;
        const maxRandomTime = process.env.CI ? 20 : 10;
        expect(sequentialTime / 100).toBeLessThan(maxSequentialTime);
        expect(randomTime / 100).toBeLessThan(maxRandomTime);
      }
    }, 10000);

    test('update performance', async () => {
      const schema = Schema.create('benchmark_db', 'counters', [
        { name: 'name', type: Types.Text, length: 50 },
        { name: 'value', type: Types.Number },
        { name: 'last_updated', type: Types.Date },
      ]);

      await db.createTable('counters', schema);
      const table = db.table('counters');

      if (table) {
        // Insert initial records
        const recordCount = 200;
        const insertedIds: string[] = [];
        for (let i = 0; i < recordCount; i++) {
          const record = await table.insert({
            name: `Counter ${i}`,
            value: 0,
            last_updated: new Date(),
          });
          insertedIds.push(record.id as string);
        }

        // Update performance test
        const updateCount = 100;
        const startTime = performance.now();

        for (let i = 0; i < updateCount; i++) {
          const id = insertedIds[i % insertedIds.length];
          await table.update(id, {
            value: i,
            last_updated: new Date(),
          });
        }

        const endTime = performance.now();
        const totalTime = endTime - startTime;
        const throughput = updateCount / (totalTime / 1000);

        console.log(`\n📊 Update Performance:`);
        console.log(`  Updates: ${updateCount}`);
        console.log(`  Total Time: ${totalTime.toFixed(2)}ms`);
        console.log(`  Throughput: ${throughput.toFixed(0)} updates/sec`);
        console.log(
          `  Average Time per Update: ${(totalTime / updateCount).toFixed(3)}ms`
        );

        // Performance assertions (relaxed for CI environments)
        const maxUpdateTime = process.env.CI ? 10000 : 5000;
        const minUpdateThroughput = process.env.CI ? 10 : 20;
        expect(totalTime).toBeLessThan(maxUpdateTime);
        expect(throughput).toBeGreaterThan(minUpdateThroughput);
      }
    }, 10000);
  });

  describe('Memory and Storage Efficiency', () => {
    test('storage efficiency with large text fields', async () => {
      const schema = Schema.create('benchmark_db', 'documents', [
        { name: 'title', type: Types.Text, length: 200 },
        { name: 'content', type: Types.Text, length: 2000 },
        { name: 'tags', type: Types.Text, length: 500 },
      ]);

      await db.createTable('documents', schema);
      const table = db.table('documents');

      if (table) {
        const recordCount = 100;
        const documents = Array.from({ length: recordCount }, (_, i) => ({
          title: `Document ${i} - ${new Array(50).fill('A').join('')}`,
          content: `Content for document ${i} - ${new Array(500).fill('Lorem ipsum dolor sit amet. ').join('')}`,
          tags: `tag1,tag2,tag3,document${i},test,benchmark`,
        }));

        const startTime = performance.now();

        for (const doc of documents) {
          await table.insert(doc);
        }

        const endTime = performance.now();
        const insertTime = endTime - startTime;

        // Check file size
        const dbPath = path.join(testDir, 'benchmark_db', 'documents');
        let totalSize = 0;
        try {
          const files = await fs.readdir(dbPath);
          for (const file of files) {
            const stats = await fs.stat(path.join(dbPath, file));
            totalSize += stats.size;
          }
        } catch {
          // Ignore if files don't exist
        }

        const avgDocumentSize = totalSize / recordCount;

        console.log(`\n📊 Storage Efficiency:`);
        console.log(`  Documents: ${recordCount}`);
        console.log(`  Total Storage: ${(totalSize / 1024).toFixed(2)} KB`);
        console.log(
          `  Average Document Size: ${avgDocumentSize.toFixed(0)} bytes`
        );
        console.log(`  Insert Time: ${insertTime.toFixed(2)}ms`);

        // Storage efficiency assertions (relaxed for CI environments)
        const maxDocSize = process.env.CI ? 8000 : 5000;
        const maxInsertTime = process.env.CI ? 15000 : 8000;
        expect(avgDocumentSize).toBeLessThan(maxDocSize);
        expect(insertTime).toBeLessThan(maxInsertTime);
      }
    }, 12000);
  });
});
