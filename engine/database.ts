import {
  DatabaseFileManager,
  type DatabaseMetadata,
} from './database-file-manager';
import { TableNotFoundError } from './errors';
import type { Schema } from './schema';
import { Table } from './table';

interface TableReference {
  name: string;
  schema: string;
  [key: string]: any;
}

interface DatabaseMetadataWithTables extends DatabaseMetadata {
  tables: TableReference[];
}

/**
 * Database class - Main database operations and table management
 */
export class Database {
  public readonly storageBasePath: string;
  public readonly name: string;
  public readonly databaseBasePath: string;
  public readonly metadataFilePath: string;

  private fileManager: DatabaseFileManager;
  private tables: Map<string, Table> = new Map();
  private metadata: DatabaseMetadataWithTables;

  /**
   * Create and initialize a new database
   */
  static async create(
    storageBasePath: string,
    name: string
  ): Promise<Database> {
    const database = new Database(storageBasePath, name);
    await database.initDatabase();
    return database;
  }

  constructor(storageBasePath: string, name: string) {
    this.storageBasePath = storageBasePath;
    this.name = name;

    // Initialize database file manager
    this.fileManager = new DatabaseFileManager(storageBasePath, name);

    // Get paths from file manager
    const paths = this.fileManager.getPaths();
    this.databaseBasePath = paths.databaseBasePath;
    this.metadataFilePath = paths.metadataFilePath;

    this.metadata = {
      tables: [],
    };
  }

  /**
   * Initialize database and load existing data
   */
  async initDatabase(): Promise<void> {
    await this.fileManager.initializeDatabase(this.metadata);
    await this.loadMetadata();
  }

  /**
   * Load metadata and initialize tables
   */
  async loadMetadata(): Promise<void> {
    const metadata = await this.fileManager.readMetadata();

    this.metadata = {
      ...this.metadata,
      ...metadata,
      tables: [
        ...this.metadata.tables,
        ...metadata.tables.map(
          table =>
            ({
              name: table.name || '',
              schema: table.schema || `${table.name}.schema.json`,
              ...table,
            }) as TableReference
        ),
      ],
    };

    for (const tableRef of this.metadata.tables) {
      const table = new Table(this.storageBasePath, this, tableRef.name);
      this.tables.set(tableRef.name, table);
      await table.loadTable();
    }
  }

  /**
   * Save metadata to file
   */
  async saveMetadata(): Promise<void> {
    const metadataToSave: DatabaseMetadataWithTables = {
      ...this.metadata,
      tables: this.metadata.tables.map(table => ({
        ...table,
      })),
    };

    await this.fileManager.writeMetadata(metadataToSave);
  }

  /**
   * Create a new table with schema
   */
  async createTable(name: string, schema: Schema): Promise<Table> {
    if (this.tables.has(name)) {
      return this.tables.get(name)!;
    }

    const table = new Table(this.storageBasePath, this, name);
    await table.initTable(schema);

    if (!this.metadata.tables.find(table => table.name === name)) {
      this.metadata.tables.push({
        name,
        schema: `${name}.schema.json`,
      });
    }

    this.tables.set(name, table);
    await this.saveMetadata();
    return table;
  }

  /**
   * Get a table by name
   */
  table(name: string): Table | undefined {
    return this.tables.get(name);
  }

  getTable(name: string): Table {
    const table = this.tables.get(name);
    if (!table) {
      throw new TableNotFoundError(this.name, name);
    }
    return table;
  }

  /**
   * Check if table exists
   */
  hasTable(name: string): boolean {
    return this.tables.has(name);
  }

  getTableNames(): string[] {
    return Array.from(this.tables.keys());
  }

  getTables(): Table[] {
    return Array.from(this.tables.values());
  }

  /**
   * Delete a table
   */
  async deleteTable(name: string): Promise<boolean> {
    const table = this.tables.get(name);
    if (!table) {
      return false;
    }

    // Close the table first
    await table.close();

    // Remove from tables map
    this.tables.delete(name);

    // Remove from metadata
    this.metadata.tables = this.metadata.tables.filter(t => t.name !== name);

    // Delete table files
    await this.fileManager.deleteTableFiles(name);

    // Save updated metadata
    await this.saveMetadata();

    return true;
  }

  getStats(): {
    name: string;
    tableCount: number;
    tables: Array<{
      name: string;
      recordCount: number;
      isLoaded: boolean;
    }>;
  } {
    const tables = Array.from(this.tables.entries()).map(([name, table]) => ({
      name,
      recordCount: table.recordCount,
      isLoaded: table.isLoaded,
    }));

    return {
      name: this.name,
      tableCount: this.tables.size,
      tables,
    };
  }

  /**
   * Get database size in bytes
   */
  async getDatabaseSize(): Promise<number> {
    return await this.fileManager.getDatabaseSize();
  }

  /**
   * Close database and all tables
   */
  async close(): Promise<void> {
    // Close all tables
    for (const table of this.tables.values()) {
      await table.close();
    }
    this.tables.clear();
  }

  getMetadata(): DatabaseMetadataWithTables {
    return { ...this.metadata };
  }

  get isInitialized(): boolean {
    return this.tables.size > 0 || this.metadata.tables.length === 0;
  }

  get tableCount(): number {
    return this.tables.size;
  }
}
