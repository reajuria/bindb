import { spawn, type ChildProcess } from 'node:child_process';
import {
  HTTPClient,
  type FindResponse,
  type HTTPResponse,
  type HealthResponse,
  type InsertResponse,
} from './http-client.js';

describe('Simple-api', () => {
  let serverProcess: ChildProcess | null = null;
  let client: HTTPClient;

  // Start server before tests
  it(
    'setup server',
    async () => {
      return new Promise<void>((resolve, reject) => {
        serverProcess = spawn('node', ['dist/index.js'], {
          stdio: ['ignore', 'pipe', 'pipe'],
          cwd: process.cwd(),
          env: { ...process.env, PORT: '3001' }, // Use different port for testing
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
              client = new HTTPClient('http://localhost:3001');
              // Give server more time to fully initialize in CI
              const initDelay = process.env.CI ? 1000 : 200;
              setTimeout(resolve, initDelay);
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
    },
    process.env.CI ? 90000 : 45000
  );

  it('health endpoint check', async () => {
    const response: HTTPResponse<HealthResponse> = await client.health();

    expect(response.status).toBe(200);
    expect(response.data.status).toBe('healthy');
    expect(typeof response.data.uptime).toBe('number');
    expect(response.data.uptime >= 0).toBeTruthy();
  });

  it('api info endpoint', async () => {
    const response: HTTPResponse<any> = await client.info();

    expect(response.status).toBe(200);
    expect(response.data.name).toBe('BinDB Engine API');
    expect(Array.isArray(response.data.endpoints)).toBeTruthy();
    expect(response.data.endpoints.length).toBeGreaterThan(0);
  });

  it('table creation and schema operations', async () => {
    const testTableName = `test_table_${Date.now()}`;

    // Create table
    const schema = [
      { name: 'name', type: 'text' },
      { name: 'age', type: 'number' },
      { name: 'active', type: 'boolean' },
    ];

    const createResponse = await client.createTable({
      database: 'e2e_test_db',
      table: testTableName,
      schema,
    });

    expect(createResponse.status).toBe(200);
    expect(createResponse.data.created).toBe(true);
    expect(createResponse.data.table.database).toBe('e2e_test_db');
    expect(createResponse.data.table.table).toBe(testTableName);

    // List tables
    const listResponse = await client.listTables('e2e_test_db');
    expect(listResponse.status).toBe(200);
    expect(Array.isArray(listResponse.data.tables)).toBeTruthy();
    expect(listResponse.data.tables.includes(testTableName)).toBeTruthy();

    // Get table schema
    const schemaResponse = await client.getTableSchema(
      'e2e_test_db',
      testTableName
    );
    expect(schemaResponse.status).toBe(200);
    expect(schemaResponse.data.database).toBe('e2e_test_db');
    expect(schemaResponse.data.table).toBe(testTableName);
    expect(schemaResponse.data.schema).toBeTruthy();
  });

  it('CRUD operations flow', async () => {
    const testTableName = `crud_test_${Date.now()}`;

    // Create table first
    const schema = [
      { name: 'name', type: 'text' },
      { name: 'age', type: 'number' },
    ];

    await client.createTable({
      database: 'e2e_test_db',
      table: testTableName,
      schema,
    });

    // Insert record
    const insertData = { name: 'John Doe', age: 25 };
    const insertResponse: HTTPResponse<InsertResponse> = await client.insert({
      database: 'e2e_test_db',
      table: testTableName,
      data: insertData,
    });

    expect(insertResponse.status).toBe(200);

    // Check if insert was successful and has expected data
    if (!insertResponse.data.insertedId) {
      console.log(
        'Insert response:',
        JSON.stringify(insertResponse.data, null, 2)
      );
    }
    expect(insertResponse.data.insertedId).toBeTruthy();
    expect(insertResponse.data.record.name).toBe('John Doe');
    expect(insertResponse.data.record.age).toBe(25);

    const recordId: string = insertResponse.data.insertedId;

    // Get record
    const getResponse: HTTPResponse<FindResponse> = await client.find(
      'e2e_test_db',
      testTableName,
      recordId
    );
    expect(getResponse.status).toBe(200);
    expect(getResponse.data.found).toBe(true);
    expect(getResponse.data.record).toBeTruthy();
    expect(getResponse.data.record?.name).toBe('John Doe');
    expect(getResponse.data.record?.age).toBe(25);

    // Update record
    const updateResponse = await client.update({
      database: 'e2e_test_db',
      table: testTableName,
      id: recordId,
      data: { age: 26 },
    });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.data.matchedCount).toBe(1);
    expect(updateResponse.data.record?.age).toBe(26);

    // Count records
    const countResponse = await client.count('e2e_test_db', testTableName);
    expect(countResponse.status).toBe(200);
    expect(typeof countResponse.data.count === 'number').toBeTruthy();

    // Delete record
    const deleteResponse = await client.deleteRecord({
      database: 'e2e_test_db',
      table: testTableName,
      id: recordId,
    });

    expect(deleteResponse.status).toBe(200);
    expect(deleteResponse.data.deletedCount).toBe(1);

    // Verify deleted
    const getDeletedResponse: HTTPResponse<FindResponse> = await client.find(
      'e2e_test_db',
      testTableName,
      recordId
    );
    expect(getDeletedResponse.status).toBe(200);
    expect(getDeletedResponse.data.record).toBeNull();
  });

  it('bulk insert operations', async () => {
    const testTableName = `bulk_test_${Date.now()}`;

    // Create table first
    const schema = [{ name: 'value', type: 'number' }];
    await client.createTable({
      database: 'e2e_test_db',
      table: testTableName,
      schema,
    });

    // Bulk insert
    const records: Array<{ value: number }> = Array.from(
      { length: 50 },
      (_, i) => ({ value: i })
    );
    const response = await client.bulkInsert(
      'e2e_test_db',
      testTableName,
      records
    );

    expect(response.status).toBe(200);
    expect(response.data.insertedCount).toBe(50);
    expect(response.data.insertedIds.length).toBe(50);

    // Verify count
    const countResponse = await client.count('e2e_test_db', testTableName);
    expect(countResponse.status).toBe(200);
    expect(countResponse.data.count >= 50).toBeTruthy();
  });

  it('error handling - missing fields', async () => {
    // Missing database field
    const response = await client.post('/v1/insert', {
      table: 'test',
      data: {},
    });
    expect(response.status).toBe(200);
    expect(response.data.error).toBeTruthy();
    expect(response.data.error.includes('Missing required field')).toBeTruthy();
  });

  it('error handling - nonexistent record', async () => {
    const response: HTTPResponse<FindResponse> = await client.find(
      'e2e_test_db',
      'nonexistent_table',
      'fake-id'
    );

    expect(response.status).toBe(200);

    // Check if it's an error or null record
    if ('error' in response.data && response.data.error) {
      expect(response.data.error).toBeTruthy(); // Error is expected for nonexistent table
    } else {
      expect(response.data.record).toBeNull();
    }
  });

  it('metrics and stats endpoints', async () => {
    // Get API metrics
    const metricsResponse = await client.metrics();
    expect(metricsResponse.status).toBe(200);
    expect(metricsResponse.data.api).toBeTruthy();
    expect(
      typeof metricsResponse.data.api.requestCount === 'number'
    ).toBeTruthy();
    expect(typeof metricsResponse.data.api.uptime === 'number').toBeTruthy();

    // Get database stats
    const statsResponse = await client.stats('e2e_test_db');
    expect(statsResponse.status).toBe(200);
    expect(statsResponse.data.data || statsResponse.data.name).toBeTruthy();
  });

  it('type safety validation', async () => {
    const testTableName = `type_test_${Date.now()}`;

    // Create table with typed schema
    const schema = [
      { name: 'text_field', type: 'text' },
      { name: 'number_field', type: 'number' },
      { name: 'boolean_field', type: 'boolean' },
    ];

    await client.createTable({
      database: 'e2e_test_db',
      table: testTableName,
      schema,
    });

    // Insert record with correct types
    const typedData = {
      text_field: 'Hello World',
      number_field: 42.5,
      boolean_field: true,
    };

    const insertResponse: HTTPResponse<InsertResponse> = await client.insert({
      database: 'e2e_test_db',
      table: testTableName,
      data: typedData,
    });

    expect(insertResponse.status).toBe(200);
    expect(typeof insertResponse.data.record.text_field).toBe('string');
    expect(typeof insertResponse.data.record.number_field).toBe('number');
    expect(typeof insertResponse.data.record.boolean_field).toBe('boolean');

    // Verify values are preserved correctly
    expect(insertResponse.data.record.text_field).toBe('Hello World');
    expect(insertResponse.data.record.number_field).toBe(42.5);
    expect(insertResponse.data.record.boolean_field).toBe(true);
  });

  // Cleanup after tests
  it('cleanup server', async () => {
    if (serverProcess) {
      return new Promise<void>(resolve => {
        let killTimeoutHandle: NodeJS.Timeout | null = null;

        const cleanup = () => {
          if (killTimeoutHandle) {
            clearTimeout(killTimeoutHandle);
            killTimeoutHandle = null;
          }
          serverProcess = null;
          resolve();
        };

        if (serverProcess) {
          serverProcess.on('exit', cleanup);
          serverProcess.on('close', cleanup);

          // Try graceful shutdown first
          serverProcess.kill('SIGTERM');

          // Force kill after shorter timeout in CI
          const killTimeout = process.env.CI ? 2000 : 5000;
          killTimeoutHandle = setTimeout(() => {
            if (serverProcess && !serverProcess.killed) {
              serverProcess.kill('SIGKILL');
              cleanup();
            }
          }, killTimeout);
        }
      });
    }
  });
});
