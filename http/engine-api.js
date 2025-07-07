import { DatabaseManager } from './database-manager.js';

export class EngineAPI {
  constructor() {
    this.dbManager = new DatabaseManager();
  }

  /**
   * Register Engine API routes with the app
   * @param {import('./app.js').App} app
   */
  registerRoutes(app) {
    // BinDB Engine API endpoints
    
    // Insert one record
    app.post('/v1/insert', async (req) => {
      const { database, table, record } = req.body;
      
      if (!database || !table || !record) {
        return { error: 'Missing required fields: database, table, record' };
      }
      
      try {
        const result = await this.dbManager.insertOne(database, table, record);
        return { insertedId: result.id, record: result };
      } catch (error) {
        return { error: error.message };
      }
    });

    // Bulk insert records (with chunking)
    app.post('/v1/bulkInsert', async (req) => {
      const { database, table, records } = req.body;
      
      if (!database || !table || !Array.isArray(records)) {
        return { error: 'Missing required fields: database, table, records (array)' };
      }
      
      try {
        const results = await this.dbManager.insertMany(database, table, records);
        return { 
          insertedIds: results.map(record => record.id),
          insertedCount: results.length,
          records: results
        };
      } catch (error) {
        return { error: error.message };
      }
    });

    // Get one record by ID
    app.post('/v1/get', async (req) => {
      const { database, table, id } = req.body;
      
      if (!database || !table || !id) {
        return { error: 'Missing required fields: database, table, id' };
      }
      
      try {
        const result = await this.dbManager.findOne(database, table, { id });
        return { record: result };
      } catch (error) {
        return { error: error.message };
      }
    });

    // Update one record by ID
    app.post('/v1/update', async (req) => {
      const { database, table, id, update } = req.body;
      
      if (!database || !table || !id || !update) {
        return { error: 'Missing required fields: database, table, id, update' };
      }
      
      try {
        const result = await this.dbManager.updateOne(database, table, { id }, update);
        return result;
      } catch (error) {
        return { error: error.message };
      }
    });

    // Delete one record by ID
    app.post('/v1/delete', async (req) => {
      const { database, table, id } = req.body;
      
      if (!database || !table || !id) {
        return { error: 'Missing required fields: database, table, id' };
      }
      
      try {
        const result = await this.dbManager.deleteOne(database, table, { id });
        return result;
      } catch (error) {
        return { error: error.message };
      }
    });

    // Count records
    app.post('/v1/count', async (req) => {
      const { database, table } = req.body;
      
      if (!database || !table) {
        return { error: 'Missing required fields: database, table' };
      }
      
      try {
        const count = await this.dbManager.countRecords(database, table);
        return { count };
      } catch (error) {
        return { error: error.message };
      }
    });

    // Create table with schema
    app.post('/v1/createTable', async (req) => {
      const { database, table, schema } = req.body;
      
      if (!database || !table || !Array.isArray(schema)) {
        return { error: 'Missing required fields: database, table, schema (array)' };
      }
      
      try {
        const result = await this.dbManager.createTable(database, table, schema);
        return { table: result };
      } catch (error) {
        return { error: error.message };
      }
    });

    // Health check endpoint
    app.get('/v1/health', async () => {
      return { status: 'healthy', timestamp: new Date().toISOString() };
    });

    // API info endpoint
    app.get('/v1/info', async () => {
      return {
        name: 'BinDB Engine API',
        version: '1.0.0',
        description: 'Binary database engine with HTTP API for secondary data storage',
        endpoints: [
          'POST /v1/insert',
          'POST /v1/bulkInsert',
          'POST /v1/get',
          'POST /v1/update',
          'POST /v1/delete',
          'POST /v1/count',
          'POST /v1/createTable',
          'GET /v1/health',
          'GET /v1/info'
        ],
        limitations: [
          'Get operations require ID field',
          'No complex queries or indexes',
          'Designed for secondary storage use cases'
        ]
      };
    });
  }

  /**
   * Close all database connections
   */
  async close() {
    await this.dbManager.close();
  }
}