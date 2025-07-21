import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs/promises';
import {
  HTTPClient,
  type FindResponse,
  type HTTPResponse,
  type InsertResponse,
} from './http-client';

describe('Persistence', () => {
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
          BINDB_STORAGE_PATH: STORAGE_PATH,
        },
      });

      let serverReady = false;

      // Timeout (much longer in CI for resource-constrained environments)
      const startupTimeout = process.env.CI ? 60000 : 15000;
      let timeoutHandle: NodeJS.Timeout | null = setTimeout(() => {
        if (!serverReady) {
          reject(
            new Error(
              `Server failed to start within ${startupTimeout / 1000} seconds`
            )
          );
        }
      }, startupTimeout);

      serverProcess.stdout?.on('data', data => {
        const output = data.toString();
        if (
          output.includes('Server listening on port') ||
          output.includes('BinDB server ready')
        ) {
          if (!serverReady) {
            serverReady = true;
            if (timeoutHandle) {
              clearTimeout(timeoutHandle);
              timeoutHandle = null;
            }
            client = new HTTPClient(`http://localhost:${TEST_PORT}`);
            // Give server more time to fully initialize in CI
            const initDelay = process.env.CI ? 1000 : 200;
            setTimeout(() => resolve(serverProcess), initDelay);
          }
        }
      });

      serverProcess.stderr?.on('data', data => {
        console.error('Server error:', data.toString());
      });

      serverProcess.on('error', error => {
        reject(new Error(`Failed to start server: ${error.message}`));
      });
    });
  }

  // Helper to stop server
  function stopServer(serverProcess: ChildProcess): Promise<void> {
    return new Promise(resolve => {
      if (!serverProcess || serverProcess.killed) {
        resolve();
        return;
      }

      let killTimeoutHandle: NodeJS.Timeout | null = null;

      const cleanup = () => {
        if (killTimeoutHandle) {
          clearTimeout(killTimeoutHandle);
          killTimeoutHandle = null;
        }
        resolve();
      };

      serverProcess.on('exit', cleanup);
      serverProcess.on('close', cleanup);
      serverProcess.kill('SIGTERM');

      // Force kill after shorter timeout in CI
      const killTimeout = process.env.CI ? 2000 : 5000;
      killTimeoutHandle = setTimeout(() => {
        if (!serverProcess.killed) {
          serverProcess.kill('SIGKILL');
          cleanup();
        }
      }, killTimeout);
    });
  }

  it(
    'data persistence across server restarts',
    async () => {
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
          { name: 'active', type: 'boolean' },
        ];

        await client.createTable({
          database: testDatabase,
          table: testTable,
          schema,
        });

        const testRecord = {
          title: 'Persistence Test Record',
          count: 42,
          active: true,
        };

        const insertResponse: HTTPResponse<InsertResponse> =
          await client.insert({
            database: testDatabase,
            table: testTable,
            data: testRecord,
          });

        expect(insertResponse.status).toBe(200);
        expect(insertResponse.data.insertedId).toBeTruthy();
        insertedId = insertResponse.data.insertedId;

        // Verify data exists
        const findResponse: HTTPResponse<FindResponse> = await client.find(
          testDatabase,
          testTable,
          insertedId
        );
        expect(findResponse.status).toBe(200);
        expect(findResponse.data.found).toBe(true);
        expect(findResponse.data.record?.title).toBe(testRecord.title);
        expect(findResponse.data.record?.count).toBe(testRecord.count);
        expect(findResponse.data.record?.active).toBe(testRecord.active);

        // Stop server
        await stopServer(serverProcess);
        serverProcess = null;

        // Start second server instance
        serverProcess = await startServer();

        // Verify data persisted
        const persistedResponse: HTTPResponse<FindResponse> = await client.find(
          testDatabase,
          testTable,
          insertedId
        );
        expect(persistedResponse.status).toBe(200);
        expect(persistedResponse.data.found).toBe(true);
        expect(persistedResponse.data.record?.title).toBe(testRecord.title);
        expect(persistedResponse.data.record?.count).toBe(testRecord.count);
        expect(persistedResponse.data.record?.active).toBe(testRecord.active);

        // Verify table still exists
        const listResponse = await client.listTables(testDatabase);
        expect(listResponse.status).toBe(200);
        expect(listResponse.data.tables.includes(testTable)).toBeTruthy();

        // Insert additional data
        const secondRecord = {
          title: 'Second Record',
          count: 100,
          active: false,
        };

        const secondInsertResponse: HTTPResponse<InsertResponse> =
          await client.insert({
            database: testDatabase,
            table: testTable,
            data: secondRecord,
          });

        expect(secondInsertResponse.status).toBe(200);
        expect(secondInsertResponse.data.insertedId).toBeTruthy();

        // Verify count is now 2
        const countResponse = await client.count(testDatabase, testTable);
        expect(countResponse.status).toBe(200);
        expect(countResponse.data.count >= 2).toBeTruthy();
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
    },
    process.env.CI ? 120000 : 60000
  );

  it(
    'schema persistence and validation',
    async () => {
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
          { name: 'timestamp_field', type: 'date' },
        ];

        await client.createTable({
          database: testDatabase,
          table: testTable,
          schema: originalSchema,
        });

        // Restart server
        await stopServer(serverProcess);
        serverProcess = await startServer();

        // Verify schema persisted correctly
        const schemaResponse = await client.getTableSchema(
          testDatabase,
          testTable
        );
        expect(schemaResponse.status).toBe(200);
        expect(schemaResponse.data.database).toBe(testDatabase);
        expect(schemaResponse.data.table).toBe(testTable);
        expect(schemaResponse.data.schema).toBeTruthy();

        // Verify schema structure (may include auto-generated columns)
        const persistedSchema = schemaResponse.data.schema;
        expect(persistedSchema.columns.length).toBeGreaterThanOrEqual(
          originalSchema.length
        );

        // Test data insertion with schema validation
        const testData = {
          id_field: 'test-id-123',
          numeric_field: 99.99,
          flag_field: true,
          timestamp_field: new Date().toISOString(),
        };

        const insertResponse: HTTPResponse<InsertResponse> =
          await client.insert({
            database: testDatabase,
            table: testTable,
            data: testData,
          });

        expect(insertResponse.status).toBe(200);
        expect(insertResponse.data.insertedId).toBeTruthy();
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
    },
    process.env.CI ? 120000 : 60000
  );

  it(
    'large dataset persistence',
    async () => {
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
          { name: 'data', type: 'text' },
        ];

        await client.createTable({
          database: testDatabase,
          table: testTable,
          schema,
        });

        // Insert large dataset
        const records: Array<{ index: number; data: string }> = [];
        for (let i = 0; i < recordCount; i++) {
          records.push({
            index: i,
            data: `Test data record ${i} with some content`,
          });
        }

        const bulkInsertResponse = await client.bulkInsert(
          testDatabase,
          testTable,
          records
        );
        expect(bulkInsertResponse.status).toBe(200);
        expect(bulkInsertResponse.data.insertedCount).toBe(recordCount);

        // Restart server
        await stopServer(serverProcess);
        serverProcess = await startServer();

        // Verify all data persisted
        const countResponse = await client.count(testDatabase, testTable);
        expect(countResponse.status).toBe(200);
        expect(countResponse.data.count >= recordCount).toBeTruthy();

        // Sample some records to verify content
        const sampleIds = bulkInsertResponse.data.insertedIds.slice(0, 5);
        for (const id of sampleIds) {
          const findResponse: HTTPResponse<FindResponse> = await client.find(
            testDatabase,
            testTable,
            id
          );
          expect(findResponse.status).toBe(200);
          expect(findResponse.data.found).toBe(true);
          expect(
            findResponse.data.record?.data.includes('Test data record')
          ).toBeTruthy();
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
    },
    process.env.CI ? 180000 : 90000
  );

  it(
    'concurrent operations persistence',
    async () => {
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
          { name: 'timestamp', type: 'text' },
        ];

        await client.createTable({
          database: testDatabase,
          table: testTable,
          schema,
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
              timestamp: new Date().toISOString(),
            },
          });
          operations.push(operation);
        }

        const results = await Promise.all(operations);

        // Verify all operations succeeded
        for (const result of results) {
          expect(result.status).toBe(200);
          expect(result.data.insertedId).toBeTruthy();
        }

        // Restart server
        await stopServer(serverProcess);
        serverProcess = await startServer();

        // Verify all concurrent operations persisted
        const countResponse = await client.count(testDatabase, testTable);
        expect(countResponse.status).toBe(200);
        expect(countResponse.data.count >= operationCount).toBeTruthy();
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
    },
    process.env.CI ? 180000 : 90000
  );
});
