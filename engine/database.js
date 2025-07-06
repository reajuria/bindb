import { Table } from './table.js';
import { DatabaseFileManager } from './database-file-manager.js';

export class Database {
  static async create(storageBasePath, name) {
    const database = new Database(storageBasePath, name);
    await database.initDatabase();
    return database;
  }

  /**
   * @param {string} storageBasePath
   * @param {string} name
   */
  constructor(storageBasePath, name) {
    this.storageBasePath = storageBasePath;
    this.name = name;

    // Initialize database file manager
    this.fileManager = new DatabaseFileManager(storageBasePath, name);
    
    // Get paths from file manager
    const paths = this.fileManager.getPaths();
    this.databaseBasePath = paths.databaseBasePath;
    this.metadataFilePath = paths.metadataFilePath;

    /** @type {Map<string, import('./table').Table>} */
    this.tables = new Map();

    this.metadata = {
      tables: [],
    };
  }

  async initDatabase() {
    await this.fileManager.initializeDatabase(this.metadata);
    await this.loadMetadata();
  }

  async loadMetadata() {
    const metadata = await this.fileManager.readMetadata();
    
    this.metadata = {
      ...this.metadata,
      ...metadata,
      tables: [
        ...this.metadata.tables,
        ...metadata.tables.map((table) => ({
          ...table,
        })),
      ],
    };

    for (const tableRef of this.metadata.tables) {
      const table = new Table(this.storageBasePath, this, tableRef.name);
      this.tables.set(tableRef.name, table);
      await table.loadTable();
    }
  }

  async saveMetadata() {
    const metadataToSave = {
      ...this.metadata,
      tables: this.metadata.tables.map((table) => ({
        ...table,
      })),
    };
    
    await this.fileManager.writeMetadata(metadataToSave);
  }

  /**
   * @param {string} name
   * @param {import('./schema').Schema} schema
   * @returns {Promise<import('./table.js').Table>}
   */
  async createTable(name, schema) {
    if (this.tables.has(name)) {
      return this.tables.get(name);
    }
    const table = new Table(this.storageBasePath, this, name);
    await table.initTable(schema);
    if (!this.metadata.tables.find((table) => table.name === name)) {
      this.metadata.tables.push({
        name,
        schema: `${name}.schema.json`,
      });
    }
    this.tables.set(name, table);
    await this.saveMetadata();
    return table;
  }

  table(name) {
    return this.tables.get(name);
  }

  async close() {
    // Close all tables
    for (const table of this.tables.values()) {
      await table.close();
    }
    this.tables.clear();
  }
}
