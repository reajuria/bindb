import fs from 'node:fs/promises';
import path from 'node:path';
import { Table } from './table.js';

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

    this.databaseBasePath = path.join(this.storageBasePath, this.name);

    this.metadataFilePath = path.join(
      this.databaseBasePath,
      'db_metadata.json'
    );

    /** @type {Map<string, import('./table').Table>} */
    this.tables = new Map();

    this.metadata = {
      tables: [],
    };
  }

  async initDatabase() {
    const dbDirExists = await fs.access(this.databaseBasePath).then(
      () => true,
      () => false
    );
    if (!dbDirExists) {
      await fs.mkdir(this.databaseBasePath, { recursive: true });
    }

    const metadataFileExists = await fs.access(this.metadataFilePath).then(
      () => true,
      () => false
    );
    if (!metadataFileExists) {
      await fs.writeFile(this.metadataFilePath, JSON.stringify(this.metadata));
    }

    await this.loadMetadata();
  }

  async loadMetadata() {
    const metadata = JSON.parse(
      await fs.readFile(this.metadataFilePath, 'utf8')
    );
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
    await fs.writeFile(
      this.metadataFilePath,
      JSON.stringify({
        ...this.metadata,
        tables: this.metadata.tables.map((table) => ({
          ...table,
        })),
      })
    );
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
}
