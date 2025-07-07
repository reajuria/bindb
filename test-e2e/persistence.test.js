import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import { HTTPClient } from './http-client.js';

// Test data persistence across server restarts
const TEST_PORT = 3002;
const STORAGE_PATH = `./test-data-persistence-${Date.now()}`;
let client;

// Helper to start server
function startServer() {
  return new Promise((resolve, reject) => {
    const serverProcess = spawn('node', ['index.js'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd: process.cwd(),
      env: { 
        ...process.env, 
        PORT: TEST_PORT,
        BINDB_STORAGE_PATH: STORAGE_PATH
      }
    });

    let serverReady = false;
    
    serverProcess.stdout.on('data', (data) => {
      const output = data.toString();
      if (output.includes('Server listening on port')) {
        if (!serverReady) {
          serverReady = true;
          client = new HTTPClient(`http://localhost:${TEST_PORT}`);
          setTimeout(() => resolve(serverProcess), 200);
        }
      }
    });

    serverProcess.stderr.on('data', (data) => {
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

// Helper to stop server gracefully
function stopServer(serverProcess) {
  return new Promise((resolve) => {
    if (!serverProcess) {
      resolve();
      return;
    }

    serverProcess.kill('SIGTERM');
    
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

test('data persistence across server restarts', async () => {
  const persistenceDbName = 'persistence_test_db';
  const persistenceTableName = 'users';
  let recordIds = [];
  
  console.log('🔄 Starting first server instance...');
  let serverProcess = await startServer();
  
  try {
    // Phase 1: Create database, table, and initial records
    console.log('📝 Creating table and inserting initial records...');
    
    // Create table with schema
    const schema = [
      { name: 'username', type: 'text', length: 30 },
      { name: 'email', type: 'text', length: 50 },
      { name: 'age', type: 'number' },
      { name: 'active', type: 'boolean' }
    ];
    
    const createResponse = await client.createTable(persistenceDbName, persistenceTableName, schema);
    assert.equal(createResponse.status, 200);
    assert.equal(createResponse.data.table.database, persistenceDbName);
    
    // Insert multiple records
    const initialRecords = [
      { username: 'alice', email: 'alice@example.com', age: 25, active: true },
      { username: 'bob', email: 'bob@example.com', age: 30, active: false },
      { username: 'charlie', email: 'charlie@example.com', age: 35, active: true }
    ];
    
    const bulkInsertResponse = await client.bulkInsert(persistenceDbName, persistenceTableName, initialRecords);
    assert.equal(bulkInsertResponse.status, 200);
    assert.equal(bulkInsertResponse.data.insertedCount, 3);
    
    recordIds = bulkInsertResponse.data.insertedIds;
    console.log(`✅ Inserted ${recordIds.length} records with IDs: ${recordIds.slice(0, 2).join(', ')}...`);
    
    // Verify initial count
    const initialCountResponse = await client.count(persistenceDbName, persistenceTableName);
    assert.equal(initialCountResponse.status, 200);
    assert.equal(initialCountResponse.data.count, 3);
    
    // Verify we can read the records
    const firstRecord = await client.getRecord(persistenceDbName, persistenceTableName, recordIds[0]);
    assert.equal(firstRecord.status, 200);
    assert.equal(firstRecord.data.record.username, 'alice');
    
    console.log('🛑 Stopping server gracefully...');
    
  } finally {
    // Stop the server gracefully
    await stopServer(serverProcess);
  }
  
  // Wait a moment for cleanup
  await new Promise(resolve => setTimeout(resolve, 500));
  
  console.log('🔄 Starting second server instance...');
  serverProcess = await startServer();
  
  try {
    // Phase 2: Verify data persistence and continue operations
    console.log('🔍 Verifying data persistence...');
    
    // Check that our records still exist
    const countAfterRestartResponse = await client.count(persistenceDbName, persistenceTableName);
    assert.equal(countAfterRestartResponse.status, 200);
    assert.equal(countAfterRestartResponse.data.count, 3);
    console.log(`✅ Found ${countAfterRestartResponse.data.count} records after restart`);
    
    // Verify specific records exist and have correct data
    for (let i = 0; i < recordIds.length; i++) {
      const recordResponse = await client.getRecord(persistenceDbName, persistenceTableName, recordIds[i]);
      assert.equal(recordResponse.status, 200);
      assert.ok(recordResponse.data.record);
      assert.equal(recordResponse.data.record.id, recordIds[i]);
      console.log(`✅ Record ${i + 1}: ${recordResponse.data.record.username} - ${recordResponse.data.record.email}`);
    }
    
    // Phase 3: Perform additional operations on persisted data
    console.log('🔧 Performing additional operations...');
    
    // Update a record
    const updateResponse = await client.update(persistenceDbName, persistenceTableName, recordIds[0], { age: 26, active: false });
    assert.equal(updateResponse.status, 200);
    assert.equal(updateResponse.data.modifiedCount, 1);
    assert.equal(updateResponse.data.record.age, 26);
    assert.equal(updateResponse.data.record.active, false);
    console.log('✅ Updated alice\'s age and status');
    
    // Add a new record
    const newRecord = { username: 'diana', email: 'diana@example.com', age: 28, active: true };
    const insertResponse = await client.insert(persistenceDbName, persistenceTableName, newRecord);
    assert.equal(insertResponse.status, 200);
    assert.ok(insertResponse.data.insertedId);
    console.log(`✅ Added new record: ${insertResponse.data.record.username}`);
    
    // Delete a record
    const deleteResponse = await client.delete(persistenceDbName, persistenceTableName, recordIds[1]);
    assert.equal(deleteResponse.status, 200);
    assert.equal(deleteResponse.data.deletedCount, 1);
    console.log('✅ Deleted bob\'s record');
    
    // Verify final state
    const finalCountResponse = await client.count(persistenceDbName, persistenceTableName);
    assert.equal(finalCountResponse.status, 200);
    assert.equal(finalCountResponse.data.count, 3); // 3 original - 1 deleted + 1 new = 3
    console.log(`✅ Final count: ${finalCountResponse.data.count} records`);
    
    // Verify deleted record is gone
    const deletedRecordResponse = await client.getRecord(persistenceDbName, persistenceTableName, recordIds[1]);
    assert.equal(deletedRecordResponse.status, 200);
    assert.equal(deletedRecordResponse.data.record, null);
    
    // Verify updated record has new values
    const updatedRecordResponse = await client.getRecord(persistenceDbName, persistenceTableName, recordIds[0]);
    assert.equal(updatedRecordResponse.status, 200);
    assert.equal(updatedRecordResponse.data.record.age, 26);
    assert.equal(updatedRecordResponse.data.record.active, false);
    
    console.log('🎉 Data persistence test completed successfully!');
    
  } finally {
    // Final cleanup
    await stopServer(serverProcess);
    
    // Clean up test data directory
    try {
      await fs.rm(STORAGE_PATH, { recursive: true, force: true });
      console.log('🧹 Cleaned up test data directory');
    } catch (error) {
      console.log('⚠️ Could not clean up test data directory:', error.message);
    }
  }
});