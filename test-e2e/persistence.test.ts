import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs/promises';
import { HTTPClient, type HTTPResponse, type InsertResponse, type FindResponse } from './http-client.js';

// Test data persistence across server restarts
const TEST_PORT = 3002;
const STORAGE_PATH = `./test-data-persistence-${Date.now()}`;
let client: HTTPClient;

// interface ServerStartResult {
//   process: ChildProcess;
//   client: HTTPClient;
// }

// Helper to start server
function startServer(): Promise<ChildProcess> {
  return new Promise((resolve, reject) => {
    const serverProcess = spawn('node', ['dist/index.js'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd: process.cwd(),
      env: { 
        ...process.env, 
        PORT: TEST_PORT.toString(),
        BINDB_STORAGE_PATH: STORAGE_PATH
      }
    });

    let serverReady = false;
    
    serverProcess.stdout?.on('data', (data) => {
      const output = data.toString();
      if (output.includes('Server listening on port')) {
        if (!serverReady) {
          serverReady = true;
          client = new HTTPClient(`http://localhost:${TEST_PORT}`);
          setTimeout(() => resolve(serverProcess), 200);
        }
      }
    });

    serverProcess.stderr?.on('data', (data) => {
      console.error('Server error:', data.toString());
    });

    serverProcess.on('error', (error) => {
      reject(new Error(`Failed to start server: ${error.message}`));
    });

    setTimeout(() => {
      if (!serverReady) {
        reject(new Error('Server failed to start within 10 seconds'));
      }
    }, 10000);
  });
}

// Helper to stop server
function stopServer(serverProcess: ChildProcess): Promise<void> {
  return new Promise((resolve) => {
    if (!serverProcess || serverProcess.killed) {
      resolve();
      return;
    }

    serverProcess.on('exit', () => {
      resolve();
    });

    serverProcess.kill('SIGTERM');

    // Force kill after 5 seconds if graceful shutdown fails
    setTimeout(() => {
      if (!serverProcess.killed) {
        serverProcess.kill('SIGKILL');
        resolve();
      }
    }, 5000);
  });
}

test('data persistence across server restarts', async () => {
  const testDatabase = 'persistence_test_db';
  const testTable = 'test_records';
  let serverProcess: ChildProcess | null = null;
  let insertedId: string = '';

  try {
    // Start first server instance
    serverProcess = await startServer();

    // Create table and insert data
    const schema = [
      { name: 'title', type: 'text' },
      { name: 'count', type: 'number' },
      { name: 'active', type: 'boolean' }
    ];

    await client.createTable({
      database: testDatabase,
      table: testTable,
      schema
    });

    const testRecord = {
      title: 'Persistence Test Record',
      count: 42,
      active: true
    };

    const insertResponse: HTTPResponse<InsertResponse> = await client.insert({
      database: testDatabase,
      table: testTable,
      data: testRecord
    });

    assert.equal(insertResponse.status, 200);
    assert.ok(insertResponse.data.insertedId);
    insertedId = insertResponse.data.insertedId;

    // Verify data exists
    const findResponse: HTTPResponse<FindResponse> = await client.find(testDatabase, testTable, insertedId);
    assert.equal(findResponse.status, 200);
    assert.equal(findResponse.data.found, true);
    assert.equal(findResponse.data.record?.title, testRecord.title);
    assert.equal(findResponse.data.record?.count, testRecord.count);
    assert.equal(findResponse.data.record?.active, testRecord.active);

    // Stop server
    await stopServer(serverProcess);
    serverProcess = null;

    // Start second server instance
    serverProcess = await startServer();

    // Verify data persisted
    const persistedResponse: HTTPResponse<FindResponse> = await client.find(testDatabase, testTable, insertedId);
    assert.equal(persistedResponse.status, 200);
    assert.equal(persistedResponse.data.found, true);
    assert.equal(persistedResponse.data.record?.title, testRecord.title);
    assert.equal(persistedResponse.data.record?.count, testRecord.count);
    assert.equal(persistedResponse.data.record?.active, testRecord.active);

    // Verify table still exists
    const listResponse = await client.listTables(testDatabase);
    assert.equal(listResponse.status, 200);
    assert.ok(listResponse.data.tables.includes(testTable));

    // Insert additional data
    const secondRecord = {
      title: 'Second Record',
      count: 100,
      active: false
    };

    const secondInsertResponse: HTTPResponse<InsertResponse> = await client.insert({
      database: testDatabase,
      table: testTable,
      data: secondRecord
    });

    assert.equal(secondInsertResponse.status, 200);
    assert.ok(secondInsertResponse.data.insertedId);

    // Verify count is now 2
    const countResponse = await client.count(testDatabase, testTable);
    assert.equal(countResponse.status, 200);
    assert.ok(countResponse.data.count >= 2);

  } finally {
    // Cleanup
    if (serverProcess) {
      await stopServer(serverProcess);
    }
    
    // Remove test storage
    try {
      await fs.rm(STORAGE_PATH, { recursive: true, force: true });
    } catch (error) {
      console.warn('Failed to cleanup test storage:', error);
    }
  }
});

test('schema persistence and validation', async () => {
  const testDatabase = 'schema_test_db';
  const testTable = 'schema_test_table';
  let serverProcess: ChildProcess | null = null;

  try {
    // Start server
    serverProcess = await startServer();

    // Create table with specific schema
    const originalSchema = [
      { name: 'id_field', type: 'text' },
      { name: 'numeric_field', type: 'number' },
      { name: 'flag_field', type: 'boolean' },
      { name: 'timestamp_field', type: 'date' }
    ];

    await client.createTable({
      database: testDatabase,
      table: testTable,
      schema: originalSchema
    });

    // Restart server
    await stopServer(serverProcess);
    serverProcess = await startServer();

    // Verify schema persisted correctly
    const schemaResponse = await client.getTableSchema(testDatabase, testTable);
    assert.equal(schemaResponse.status, 200);
    assert.equal(schemaResponse.data.database, testDatabase);
    assert.equal(schemaResponse.data.table, testTable);
    assert.ok(schemaResponse.data.schema);

    // Verify schema structure
    const persistedSchema = schemaResponse.data.schema;
    assert.equal(persistedSchema.columns.length, originalSchema.length);

    // Test data insertion with schema validation
    const testData = {
      id_field: 'test-id-123',
      numeric_field: 99.99,
      flag_field: true,
      timestamp_field: new Date().toISOString()
    };

    const insertResponse: HTTPResponse<InsertResponse> = await client.insert({
      database: testDatabase,
      table: testTable,
      data: testData
    });

    assert.equal(insertResponse.status, 200);
    assert.ok(insertResponse.data.insertedId);

  } finally {
    if (serverProcess) {
      await stopServer(serverProcess);
    }
    
    try {
      await fs.rm(STORAGE_PATH, { recursive: true, force: true });
    } catch (error) {
      console.warn('Failed to cleanup test storage:', error);
    }
  }
});

test('large dataset persistence', async () => {
  const testDatabase = 'large_data_test';
  const testTable = 'large_table';
  let serverProcess: ChildProcess | null = null;
  const recordCount = 100;

  try {
    // Start server
    serverProcess = await startServer();

    // Create table
    const schema = [
      { name: 'index', type: 'number' },
      { name: 'data', type: 'text' }
    ];

    await client.createTable({
      database: testDatabase,
      table: testTable,
      schema
    });

    // Insert large dataset
    const records: Array<{ index: number; data: string }> = [];
    for (let i = 0; i < recordCount; i++) {
      records.push({
        index: i,
        data: `Test data record ${i} with some content`
      });
    }

    const bulkInsertResponse = await client.bulkInsert(testDatabase, testTable, records);
    assert.equal(bulkInsertResponse.status, 200);
    assert.equal(bulkInsertResponse.data.insertedCount, recordCount);

    // Restart server
    await stopServer(serverProcess);
    serverProcess = await startServer();

    // Verify all data persisted
    const countResponse = await client.count(testDatabase, testTable);
    assert.equal(countResponse.status, 200);
    assert.ok(countResponse.data.count >= recordCount);

    // Sample some records to verify content
    const sampleIds = bulkInsertResponse.data.insertedIds.slice(0, 5);
    for (const id of sampleIds) {
      const findResponse: HTTPResponse<FindResponse> = await client.find(testDatabase, testTable, id);
      assert.equal(findResponse.status, 200);
      assert.equal(findResponse.data.found, true);
      assert.ok(findResponse.data.record?.data.includes('Test data record'));
    }

  } finally {
    if (serverProcess) {
      await stopServer(serverProcess);
    }
    
    try {
      await fs.rm(STORAGE_PATH, { recursive: true, force: true });
    } catch (error) {
      console.warn('Failed to cleanup test storage:', error);
    }
  }
});

test('concurrent operations persistence', async () => {
  const testDatabase = 'concurrent_test';
  const testTable = 'concurrent_table';
  let serverProcess: ChildProcess | null = null;

  try {
    // Start server
    serverProcess = await startServer();

    // Create table
    const schema = [
      { name: 'thread_id', type: 'number' },
      { name: 'operation_id', type: 'number' },
      { name: 'timestamp', type: 'text' }
    ];

    await client.createTable({
      database: testDatabase,
      table: testTable,
      schema
    });

    // Perform concurrent operations
    const operations: Promise<HTTPResponse<InsertResponse>>[] = [];
    const operationCount = 20;

    for (let i = 0; i < operationCount; i++) {
      const operation = client.insert({
        database: testDatabase,
        table: testTable,
        data: {
          thread_id: Math.floor(i / 5),
          operation_id: i,
          timestamp: new Date().toISOString()
        }
      });
      operations.push(operation);
    }

    const results = await Promise.all(operations);
    
    // Verify all operations succeeded
    for (const result of results) {
      assert.equal(result.status, 200);
      assert.ok(result.data.insertedId);
    }

    // Restart server
    await stopServer(serverProcess);
    serverProcess = await startServer();

    // Verify all concurrent operations persisted
    const countResponse = await client.count(testDatabase, testTable);
    assert.equal(countResponse.status, 200);
    assert.ok(countResponse.data.count >= operationCount);

  } finally {
    if (serverProcess) {
      await stopServer(serverProcess);
    }
    
    try {
      await fs.rm(STORAGE_PATH, { recursive: true, force: true });
    } catch (error) {
      console.warn('Failed to cleanup test storage:', error);
    }
  }
});