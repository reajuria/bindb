import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { HTTPClient } from './http-client.js';

let serverProcess;
let client;

// Start server before tests
test('setup server', async () => {
  return new Promise((resolve, reject) => {
    serverProcess = spawn('node', ['index.js'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd: process.cwd(),
      env: { ...process.env, PORT: '3001' } // Use different port for testing
    });

    let serverReady = false;
    
    serverProcess.stdout.on('data', (data) => {
      const output = data.toString();
      if (output.includes('Server listening on port')) {
        if (!serverReady) {
          serverReady = true;
          client = new HTTPClient('http://localhost:3001');
          // Give server a moment to fully initialize
          setTimeout(resolve, 200);
        }
      }
    });

    serverProcess.stderr.on('data', (data) => {
      console.error('Server error:', data.toString());
    });

    serverProcess.on('error', (error) => {
      reject(new Error(`Failed to start server: ${error.message}`));
    });

    // Timeout after 10 seconds
    setTimeout(() => {
      if (!serverReady) {
        reject(new Error('Server failed to start within 10 seconds'));
      }
    }, 10000);
  });
});

test('health endpoint check', async () => {
  const response = await client.health();
  assert.equal(response.status, 200);
  assert.equal(response.data.status, 'healthy');
  assert.ok(response.data.timestamp);
});

test('info endpoint check', async () => {
  const response = await client.info();
  
  assert.equal(response.status, 200);
  assert.equal(response.data.name, 'BinDB Engine API');
  assert.equal(response.data.version, '1.0.0');
  assert.ok(Array.isArray(response.data.endpoints));
  assert.ok(response.data.endpoints.includes('POST /v1/insert'));
});

test('create table and basic operations', async () => {
  const testTableName = `test_table_${Date.now()}`;
  
  // Create table
  const schema = [
    { name: 'name', type: 'text', length: 50 },
    { name: 'age', type: 'number' },
    { name: 'active', type: 'boolean' }
  ];
  
  const createResponse = await client.createTable('e2e_test_db', testTableName, schema);
  assert.equal(createResponse.status, 200);
  assert.equal(createResponse.data.table.database, 'e2e_test_db');
  assert.equal(createResponse.data.table.table, testTableName);
  
  // Insert record
  const record = { name: 'Test User', age: 25, active: true };
  const insertResponse = await client.insert('e2e_test_db', testTableName, record);
  
  assert.equal(insertResponse.status, 200);
  assert.ok(insertResponse.data.insertedId);
  assert.equal(insertResponse.data.record.name, 'Test User');
  
  const recordId = insertResponse.data.insertedId;
  
  // Get record
  const getResponse = await client.getRecord('e2e_test_db', testTableName, recordId);
  assert.equal(getResponse.status, 200);
  assert.equal(getResponse.data.record.id, recordId);
  assert.equal(getResponse.data.record.name, 'Test User');
  
  // Update record
  const updateResponse = await client.update('e2e_test_db', testTableName, recordId, { age: 26 });
  assert.equal(updateResponse.status, 200);
  assert.equal(updateResponse.data.matchedCount, 1);
  assert.equal(updateResponse.data.record.age, 26);
  
  // Count records
  const countResponse = await client.count('e2e_test_db', testTableName);
  assert.equal(countResponse.status, 200);
  assert.ok(typeof countResponse.data.count === 'number');
  
  // Delete record
  const deleteResponse = await client.delete('e2e_test_db', testTableName, recordId);
  assert.equal(deleteResponse.status, 200);
  assert.equal(deleteResponse.data.deletedCount, 1);
  
  // Verify deleted
  const getDeletedResponse = await client.getRecord('e2e_test_db', testTableName, recordId);
  assert.equal(getDeletedResponse.status, 200);
  assert.equal(getDeletedResponse.data.record, null);
});

test('bulk insert operations', async () => {
  const testTableName = `bulk_test_${Date.now()}`;
  
  // Create table first
  const schema = [{ name: 'value', type: 'number' }];
  await client.createTable('e2e_test_db', testTableName, schema);
  
  // Bulk insert
  const records = Array.from({ length: 50 }, (_, i) => ({ value: i }));
  const response = await client.bulkInsert('e2e_test_db', testTableName, records);
  
  assert.equal(response.status, 200);
  assert.equal(response.data.insertedCount, 50);
  assert.equal(response.data.insertedIds.length, 50);
  
  // Verify count
  const countResponse = await client.count('e2e_test_db', testTableName);
  assert.equal(countResponse.status, 200);
  assert.ok(countResponse.data.count >= 50);
});

test('error handling - missing fields', async () => {
  // Missing database field
  const response = await client.post('/v1/insert', { table: 'test', record: {} });
  assert.equal(response.status, 200);
  assert.ok(response.data.error);
  assert.ok(response.data.error.includes('Missing required fields'));
});

test('error handling - nonexistent record', async () => {
  const response = await client.getRecord('e2e_test_db', 'nonexistent_table', 'fake-id');
  
  assert.equal(response.status, 200);
  
  // Check if it's an error or null record
  if (response.data.error) {
    assert.ok(response.data.error); // Error is expected for nonexistent table
  } else {
    assert.equal(response.data.record, null);
  }
});

// Cleanup after tests
test('cleanup server', async () => {
  if (serverProcess) {
    serverProcess.kill('SIGTERM');
    
    return new Promise((resolve) => {
      serverProcess.on('exit', () => {
        resolve();
      });
      
      // Force kill after 5 seconds if graceful shutdown fails
      setTimeout(() => {
        if (!serverProcess.killed) {
          serverProcess.kill('SIGKILL');
          resolve();
        }
      }, 5000);
    });
  }
});