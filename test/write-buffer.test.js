import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WriteBuffer } from '../engine/write-buffer.js';

test('basic buffer operations', async () => {
  const buffer = new WriteBuffer({ maxBufferRecords: 3, maxBufferSize: 1024 });
  
  const testData = Buffer.from('test data');
  
  // Add data to buffer
  const flushed1 = await buffer.add(1, testData, 0);
  assert.equal(flushed1, false); // Should not auto-flush yet
  
  // Check if data exists in buffer
  assert.equal(buffer.has(1), true);
  assert.equal(buffer.has(2), false);
  
  // Get data from buffer
  const retrieved = buffer.get(1);
  assert.deepEqual(retrieved.buffer, testData);
  assert.equal(retrieved.position, 0);
  
  // Check stats
  const stats = buffer.getStats();
  assert.equal(stats.recordCount, 1);
  assert.ok(stats.bufferSize > 0);
});

test('auto-flush on record count limit', async () => {
  let flushCalled = false;
  let flushedData = null;
  
  const buffer = new WriteBuffer({ maxBufferRecords: 2, maxBufferSize: 1024 });
  buffer.setFlushCallback(async (writes) => {
    flushCalled = true;
    flushedData = writes;
  });
  
  // Add first record
  await buffer.add(1, Buffer.from('data1'), 0);
  assert.equal(flushCalled, false);
  
  // Add second record - should trigger flush
  await buffer.add(2, Buffer.from('data2'), 10);
  assert.equal(flushCalled, true);
  assert.equal(flushedData.length, 2);
  
  // Buffer should be empty after flush
  assert.equal(buffer.isEmpty(), true);
  assert.equal(buffer.getStats().recordCount, 0);
});

test('auto-flush on buffer size limit', async () => {
  let flushCalled = false;
  
  const buffer = new WriteBuffer({ maxBufferRecords: 10, maxBufferSize: 50 });
  buffer.setFlushCallback(async () => {
    flushCalled = true;
  });
  
  // Add data that exceeds size limit
  const largeData = Buffer.alloc(60); // Exceeds 50 byte limit
  await buffer.add(1, largeData, 0);
  
  assert.equal(flushCalled, true);
});

test('manual flush operations', async () => {
  let flushCalled = false;
  let flushedWrites = [];
  
  const buffer = new WriteBuffer({ maxBufferRecords: 10, maxBufferSize: 1024 });
  buffer.setFlushCallback(async (writes) => {
    flushCalled = true;
    flushedWrites = writes;
  });
  
  // Add some data
  await buffer.add(1, Buffer.from('data1'), 0);
  await buffer.add(2, Buffer.from('data2'), 10);
  
  // Manual flush
  await buffer.flush();
  
  assert.equal(flushCalled, true);
  assert.equal(flushedWrites.length, 2);
  assert.equal(flushedWrites[0].slot, 1);
  assert.equal(flushedWrites[1].slot, 2);
  assert.equal(buffer.isEmpty(), true);
});

test('flush callback data structure', async () => {
  let receivedWrites = null;
  
  const buffer = new WriteBuffer({ maxBufferRecords: 2, maxBufferSize: 1024 });
  buffer.setFlushCallback(async (writes) => {
    receivedWrites = writes;
  });
  
  const buffer1 = Buffer.from('test1');
  const buffer2 = Buffer.from('test2');
  
  await buffer.add(10, buffer1, 100);
  await buffer.add(20, buffer2, 200);
  
  // Should auto-flush
  assert.ok(receivedWrites);
  assert.equal(receivedWrites.length, 2);
  
  // Check structure of flushed data
  const write1 = receivedWrites.find(w => w.slot === 10);
  const write2 = receivedWrites.find(w => w.slot === 20);
  
  assert.ok(write1);
  assert.ok(write2);
  assert.deepEqual(write1.buffer, buffer1);
  assert.equal(write1.position, 100);
  assert.deepEqual(write2.buffer, buffer2);
  assert.equal(write2.position, 200);
});

test('concurrent flush protection', async () => {
  let flushCount = 0;
  
  const buffer = new WriteBuffer({ maxBufferRecords: 1, maxBufferSize: 1024 });
  buffer.setFlushCallback(async () => {
    flushCount++;
    // Simulate slow flush
    await new Promise(resolve => setTimeout(resolve, 10));
  });
  
  // Add data to trigger flush
  await buffer.add(1, Buffer.from('data1'), 0);
  
  // Try to flush again while first flush is in progress
  const flushPromises = [
    buffer.flush(),
    buffer.flush(),
    buffer.flush()
  ];
  
  await Promise.all(flushPromises);
  
  // Should only flush once
  assert.equal(flushCount, 1);
});

test('buffer statistics tracking', async () => {
  const buffer = new WriteBuffer({ maxBufferRecords: 100, maxBufferSize: 10240 });
  
  // Initial stats
  let stats = buffer.getStats();
  assert.equal(stats.recordCount, 0);
  assert.equal(stats.bufferSize, 0);
  assert.equal(stats.maxRecords, 100);
  assert.equal(stats.maxSize, 10240);
  assert.equal(stats.recordUtilization, '0.0%');
  assert.equal(stats.sizeUtilization, '0.0%');
  assert.equal(stats.flushInProgress, false);
  
  // Add some data
  await buffer.add(1, Buffer.alloc(1024), 0);
  await buffer.add(2, Buffer.alloc(512), 1024);
  
  stats = buffer.getStats();
  assert.equal(stats.recordCount, 2);
  assert.equal(stats.bufferSize, 1536);
  assert.equal(stats.recordUtilization, '2.0%');
  assert.equal(stats.sizeUtilization, '15.0%');
});

test('buffer clear operation', async () => {
  const buffer = new WriteBuffer({ maxBufferRecords: 10, maxBufferSize: 1024 });
  
  // Add data
  await buffer.add(1, Buffer.from('data1'), 0);
  await buffer.add(2, Buffer.from('data2'), 10);
  
  assert.equal(buffer.currentRecords, 2);
  assert.ok(buffer.currentSize > 0);
  
  // Clear buffer
  buffer.clear();
  
  assert.equal(buffer.currentRecords, 0);
  assert.equal(buffer.currentSize, 0);
  assert.equal(buffer.isEmpty(), true);
});

test('buffer property getters', async () => {
  const buffer = new WriteBuffer({ maxBufferRecords: 5, maxBufferSize: 512 });
  
  const data1 = Buffer.from('test1');
  const data2 = Buffer.from('test2');
  
  await buffer.add(1, data1, 0);
  await buffer.add(2, data2, 10);
  
  assert.equal(buffer.currentRecords, 2);
  assert.equal(buffer.currentSize, data1.length + data2.length);
  assert.equal(buffer.isEmpty(), false);
  
  buffer.clear();
  assert.equal(buffer.isEmpty(), true);
});

test('flush condition evaluation', () => {
  // Test record count limit - manually add without triggering flush
  const buffer1 = new WriteBuffer({ maxBufferRecords: 2, maxBufferSize: 1024 });
  buffer1.buffer.set(1, { buffer: Buffer.from('data'), position: 0 });
  buffer1.bufferSize += 4;
  assert.equal(buffer1.shouldFlush(), false);
  
  buffer1.buffer.set(2, { buffer: Buffer.from('data'), position: 10 });
  buffer1.bufferSize += 4;
  assert.equal(buffer1.shouldFlush(), true);
  
  // Test size limit
  const buffer2 = new WriteBuffer({ maxBufferRecords: 10, maxBufferSize: 10 });
  buffer2.buffer.set(1, { buffer: Buffer.alloc(15), position: 0 });
  buffer2.bufferSize += 15;
  assert.equal(buffer2.shouldFlush(), true);
});

test('empty buffer flush handling', async () => {
  let flushCalled = false;
  
  const buffer = new WriteBuffer({ maxBufferRecords: 10, maxBufferSize: 1024 });
  buffer.setFlushCallback(async () => {
    flushCalled = true;
  });
  
  // Flush empty buffer should not call callback
  await buffer.flush();
  assert.equal(flushCalled, false);
});