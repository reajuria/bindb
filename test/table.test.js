import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Database } from '../engine/database.js';
import { Schema } from '../engine/schema.js';
import { Types } from '../engine/column.js';

async function createTempDB() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'bindb-'));
  const db = await Database.create(dir, 'testdb');
  const schema = new Schema();
  schema.addColumn({ name: 'name', type: Types.Text, length: 20 });
  await db.createTable('items', schema);
  return { dir, db };
}

test('insert and read row', async () => {
  const { dir, db } = await createTempDB();
  let db2;
  
  try {
    const table = db.table('items');
    const inserted = await table.insert({ name: 'foo' });
    
    // Flush buffered data to disk
    await table.flush();

    db2 = new Database(dir, 'testdb');
    await db2.initDatabase();
    const table2 = db2.table('items');
    const row = await table2.get(inserted.id);

    assert.deepEqual(row, inserted);
  } finally {
    // Cleanup file handles and temp directory
    await db?.close();
    await db2?.close();
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('bulk insert operations', async () => {
  const { dir, db } = await createTempDB();
  
  try {
    const table = db.table('items');
    const records = [
      { name: 'item1' },
      { name: 'item2' },
      { name: 'item3' }
    ];
    
    const inserted = await table.bulkInsert(records);
    assert.equal(inserted.length, 3);
    assert.ok(inserted[0].id);
    assert.equal(inserted[0].name, 'item1');
    
    // Verify all records were inserted
    await table.flush();
    for (const record of inserted) {
      const row = await table.get(record.id);
      assert.deepEqual(row, record);
    }
  } finally {
    await db?.close();
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('write buffer behavior', async () => {
  const { dir, db } = await createTempDB();
  
  try {
    const table = db.table('items');
    
    // Insert without flushing
    const inserted = await table.insert({ name: 'buffered' });
    
    // Data should be accessible immediately through cache/buffer
    const row = await table.get(inserted.id);
    assert.deepEqual(row, inserted);
    
    // Verify buffer stats
    const stats = table.writeBuffer.getStats();
    assert.ok(stats.recordCount >= 0);
    assert.ok(stats.bufferSize >= 0);
    
    // Manual flush
    await table.flush();
    const statsAfterFlush = table.writeBuffer.getStats();
    assert.equal(statsAfterFlush.recordCount, 0); // Should be empty after flush
    
  } finally {
    await db?.close();
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('cache functionality', async () => {
  const { dir, db } = await createTempDB();
  
  try {
    const table = db.table('items');
    const inserted = await table.insert({ name: 'cached' });
    await table.flush();
    
    // First read - should populate cache
    const row1 = await table.get(inserted.id);
    assert.deepEqual(row1, inserted);
    
    // Second read - should hit cache
    const row2 = await table.get(inserted.id);
    assert.deepEqual(row2, inserted);
    
    // Check cache statistics
    const cacheStats = table.readCache.getStats();
    assert.ok(cacheStats.size >= 0);
    assert.ok(cacheStats.maxSize > 0);
    
  } finally {
    await db?.close();
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('large dataset performance characteristics', async () => {
  const { dir, db } = await createTempDB();
  
  try {
    const table = db.table('items');
    const recordCount = 1000;
    const records = [];
    
    for (let i = 0; i < recordCount; i++) {
      records.push({ name: `item_${i}` });
    }
    
    // Test bulk insert performance
    const startTime = process.hrtime.bigint();
    const inserted = await table.bulkInsert(records);
    await table.flush();
    const endTime = process.hrtime.bigint();
    
    const duration = Number(endTime - startTime) / 1_000_000; // Convert to milliseconds
    const throughput = recordCount / (duration / 1000); // ops/sec
    
    assert.equal(inserted.length, recordCount);
    assert.ok(throughput > 1000, `Throughput ${throughput} ops/sec should be > 1000`);
    
    // Verify random access performance
    const randomIndices = [0, 100, 500, 999];
    for (const index of randomIndices) {
      const row = await table.get(inserted[index].id);
      assert.equal(row.name, `item_${index}`);
    }
    
  } finally {
    await db?.close();
    await fs.rm(dir, { recursive: true, force: true });
  }
});
