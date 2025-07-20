import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { HTTPClient, type HTTPResponse, type HealthResponse, type FindResponse, type InsertResponse } from './http-client.js';

let serverProcess: ChildProcess | null = null;
let client: HTTPClient;

// Start server before tests
test('setup server', async () => {
  return new Promise<void>((resolve, reject) => {
    serverProcess = spawn('node', ['dist/index.js'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd: process.cwd(),
      env: { ...process.env, PORT: '3001' } // Use different port for testing
    });

    let serverReady = false;
    
    serverProcess.stdout?.on('data', (data) => {
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

    serverProcess.stderr?.on('data', (data) => {
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
  const response: HTTPResponse<HealthResponse> = await client.health();
  
  assert.equal(response.status, 200);
  assert.equal(response.data.status, 'healthy');
  assert.equal(typeof response.data.uptime, 'number');
  assert.ok(response.data.uptime >= 0);
});

test('api info endpoint', async () => {
  const response: HTTPResponse<any> = await client.info();
  
  assert.equal(response.status, 200);
  assert.equal(response.data.name, 'BinDB Engine API');
  assert.ok(Array.isArray(response.data.endpoints));
  assert.ok(response.data.endpoints.length > 0);
});

test('table creation and schema operations', async () => {
  const testTableName = `test_table_${Date.now()}`;
  
  // Create table
  const schema = [
    { name: 'name', type: 'text' },
    { name: 'age', type: 'number' },
    { name: 'active', type: 'boolean' }
  ];
  
  const createResponse = await client.createTable({
    database: 'e2e_test_db',
    table: testTableName,
    schema
  });
  
  assert.equal(createResponse.status, 200);
  assert.equal(createResponse.data.created, true);
  assert.equal(createResponse.data.table.database, 'e2e_test_db');
  assert.equal(createResponse.data.table.table, testTableName);
  
  // List tables
  const listResponse = await client.listTables('e2e_test_db');
  assert.equal(listResponse.status, 200);
  assert.ok(Array.isArray(listResponse.data.tables));
  assert.ok(listResponse.data.tables.includes(testTableName));
  
  // Get table schema
  const schemaResponse = await client.getTableSchema('e2e_test_db', testTableName);
  assert.equal(schemaResponse.status, 200);
  assert.equal(schemaResponse.data.database, 'e2e_test_db');
  assert.equal(schemaResponse.data.table, testTableName);
  assert.ok(schemaResponse.data.schema);
});

test('CRUD operations flow', async () => {
  const testTableName = `crud_test_${Date.now()}`;
  
  // Create table first
  const schema = [
    { name: 'name', type: 'text' },
    { name: 'age', type: 'number' }
  ];
  
  await client.createTable({
    database: 'e2e_test_db',
    table: testTableName,
    schema
  });
  
  // Insert record
  const insertData = { name: 'John Doe', age: 25 };
  const insertResponse: HTTPResponse<InsertResponse> = await client.insert({
    database: 'e2e_test_db',
    table: testTableName,
    data: insertData
  });
  
  assert.equal(insertResponse.status, 200);
  assert.ok(insertResponse.data.insertedId);
  assert.equal(insertResponse.data.record.name, 'John Doe');
  assert.equal(insertResponse.data.record.age, 25);
  
  const recordId: string = insertResponse.data.insertedId;
  
  // Get record
  const getResponse: HTTPResponse<FindResponse> = await client.find('e2e_test_db', testTableName, recordId);
  assert.equal(getResponse.status, 200);
  assert.equal(getResponse.data.found, true);
  assert.ok(getResponse.data.record);
  assert.equal(getResponse.data.record?.name, 'John Doe');
  assert.equal(getResponse.data.record?.age, 25);
  
  // Update record
  const updateResponse = await client.update({
    database: 'e2e_test_db',
    table: testTableName,
    id: recordId,
    data: { age: 26 }
  });
  
  assert.equal(updateResponse.status, 200);
  assert.equal(updateResponse.data.matchedCount, 1);
  assert.equal(updateResponse.data.record?.age, 26);
  
  // Count records
  const countResponse = await client.count('e2e_test_db', testTableName);
  assert.equal(countResponse.status, 200);
  assert.ok(typeof countResponse.data.count === 'number');
  
  // Delete record
  const deleteResponse = await client.deleteRecord({
    database: 'e2e_test_db',
    table: testTableName,
    id: recordId
  });
  
  assert.equal(deleteResponse.status, 200);
  assert.equal(deleteResponse.data.deletedCount, 1);
  
  // Verify deleted
  const getDeletedResponse: HTTPResponse<FindResponse> = await client.find('e2e_test_db', testTableName, recordId);
  assert.equal(getDeletedResponse.status, 200);
  assert.equal(getDeletedResponse.data.record, null);
});

test('bulk insert operations', async () => {
  const testTableName = `bulk_test_${Date.now()}`;
  
  // Create table first
  const schema = [{ name: 'value', type: 'number' }];
  await client.createTable({
    database: 'e2e_test_db',
    table: testTableName,
    schema
  });
  
  // Bulk insert
  const records: Array<{ value: number }> = Array.from({ length: 50 }, (_, i) => ({ value: i }));
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
  const response = await client.post('/v1/insert', { table: 'test', data: {} });
  assert.equal(response.status, 200);
  assert.ok(response.data.error);
  assert.ok(response.data.error.includes('Missing required field'));
});

test('error handling - nonexistent record', async () => {
  const response: HTTPResponse<FindResponse> = await client.find('e2e_test_db', 'nonexistent_table', 'fake-id');
  
  assert.equal(response.status, 200);
  
  // Check if it's an error or null record
  if (response.data.error) {
    assert.ok(response.data.error); // Error is expected for nonexistent table
  } else {
    assert.equal(response.data.record, null);
  }
});

test('metrics and stats endpoints', async () => {
  // Get API metrics
  const metricsResponse = await client.metrics();
  assert.equal(metricsResponse.status, 200);
  assert.ok(metricsResponse.data.api);
  assert.ok(typeof metricsResponse.data.api.requestCount === 'number');
  assert.ok(typeof metricsResponse.data.api.uptime === 'number');
  
  // Get database stats
  const statsResponse = await client.stats('e2e_test_db');
  assert.equal(statsResponse.status, 200);
  assert.ok(statsResponse.data.data || statsResponse.data.name);
});

test('type safety validation', async () => {
  const testTableName = `type_test_${Date.now()}`;
  
  // Create table with typed schema
  const schema = [
    { name: 'text_field', type: 'text' },
    { name: 'number_field', type: 'number' },
    { name: 'boolean_field', type: 'boolean' }
  ];
  
  await client.createTable({
    database: 'e2e_test_db',
    table: testTableName,
    schema
  });
  
  // Insert record with correct types
  const typedData = {
    text_field: 'Hello World',
    number_field: 42.5,
    boolean_field: true
  };
  
  const insertResponse: HTTPResponse<InsertResponse> = await client.insert({
    database: 'e2e_test_db',
    table: testTableName,
    data: typedData
  });
  
  assert.equal(insertResponse.status, 200);
  assert.equal(typeof insertResponse.data.record.text_field, 'string');
  assert.equal(typeof insertResponse.data.record.number_field, 'number');
  assert.equal(typeof insertResponse.data.record.boolean_field, 'boolean');
  
  // Verify values are preserved correctly
  assert.equal(insertResponse.data.record.text_field, 'Hello World');
  assert.equal(insertResponse.data.record.number_field, 42.5);
  assert.equal(insertResponse.data.record.boolean_field, true);
});

// Cleanup after tests
test('cleanup server', async () => {
  if (serverProcess) {
    serverProcess.kill('SIGTERM');
    
    return new Promise<void>((resolve) => {
      serverProcess?.on('exit', () => {
        resolve();
      });
      
      // Force kill after 5 seconds if graceful shutdown fails
      setTimeout(() => {
        if (serverProcess && !serverProcess.killed) {
          serverProcess.kill('SIGKILL');
          resolve();
        }
      }, 5000);
    });
  }
});