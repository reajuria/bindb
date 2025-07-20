import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * Database metadata structure
 */
export interface DatabaseMetadata {
  tables: Array<Record<string, any>>;
  [key: string]: any;
}

interface DatabasePaths {
  databaseBasePath: string;
  metadataFilePath: string;
  storageBasePath: string;
}

/**
 * Database-level file operations manager
 * Handles database directory setup and metadata file operations
 */
export class DatabaseFileManager {
  public readonly storageBasePath: string;
  public readonly databaseName: string;
  public readonly databaseBasePath: string;
  public readonly metadataFilePath: string;

  constructor(storageBasePath: string, databaseName: string) {
    this.storageBasePath = storageBasePath;
    this.databaseName = databaseName;
    this.databaseBasePath = path.join(storageBasePath, databaseName);
    this.metadataFilePath = path.join(
      this.databaseBasePath,
      'db_metadata.json'
    );
  }

  /**
   * Check if a directory exists
   */
  static async directoryExists(dirPath: string): Promise<boolean> {
    try {
      await fs.access(dirPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if a file exists
   */
  static async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Create directory if it doesn't exist
   */
  static async ensureDirectory(dirPath: string): Promise<void> {
    if (!(await DatabaseFileManager.directoryExists(dirPath))) {
      await fs.mkdir(dirPath, { recursive: true });
    }
  }

  /**
   * Initialize database directory structure
   */
  async initializeDatabaseDirectory(): Promise<void> {
    await DatabaseFileManager.ensureDirectory(this.databaseBasePath);
  }

  /**
   * Check if database directory exists
   */
  async databaseDirectoryExists(): Promise<boolean> {
    return DatabaseFileManager.directoryExists(this.databaseBasePath);
  }

  /**
   * Check if metadata file exists
   */
  async metadataFileExists(): Promise<boolean> {
    return DatabaseFileManager.fileExists(this.metadataFilePath);
  }

  /**
   * Create metadata file with initial content
   */
  async createMetadataFile(
    initialMetadata: DatabaseMetadata = { tables: [] }
  ): Promise<void> {
    await fs.writeFile(this.metadataFilePath, JSON.stringify(initialMetadata));
  }

  /**
   * Read metadata from file
   */
  async readMetadata(): Promise<DatabaseMetadata> {
    const content = await fs.readFile(this.metadataFilePath, 'utf8');
    return JSON.parse(content) as DatabaseMetadata;
  }

  /**
   * Write metadata to file
   */
  async writeMetadata(metadata: DatabaseMetadata): Promise<void> {
    await fs.writeFile(
      this.metadataFilePath,
      JSON.stringify(metadata, null, 2)
    );
  }

  /**
   * Initialize database files and directory structure
   */
  async initializeDatabase(
    initialMetadata: DatabaseMetadata = { tables: [] }
  ): Promise<void> {
    // Ensure database directory exists
    await this.initializeDatabaseDirectory();

    // Create metadata file if it doesn't exist
    if (!(await this.metadataFileExists())) {
      await this.createMetadataFile(initialMetadata);
    }
  }

  /**
   * Get database file paths
   */
  getPaths(): DatabasePaths {
    return {
      databaseBasePath: this.databaseBasePath,
      metadataFilePath: this.metadataFilePath,
      storageBasePath: this.storageBasePath,
    };
  }

  /**
   * Get table schema file path
   */
  getTableSchemaPath(tableName: string): string {
    return path.join(this.databaseBasePath, `${tableName}.schema.json`);
  }

  /**
   * Get table data file path
   */
  getTableDataPath(tableName: string): string {
    return path.join(this.databaseBasePath, `${tableName}.data`);
  }

  /**
   * Delete a table's files
   */
  async deleteTableFiles(tableName: string): Promise<void> {
    const schemaPath = this.getTableSchemaPath(tableName);
    const dataPath = this.getTableDataPath(tableName);

    const deletePromises: Promise<void>[] = [];

    if (await DatabaseFileManager.fileExists(schemaPath)) {
      deletePromises.push(fs.unlink(schemaPath));
    }

    if (await DatabaseFileManager.fileExists(dataPath)) {
      deletePromises.push(fs.unlink(dataPath));
    }

    await Promise.all(deletePromises);
  }

  /**
   * Check if table files exist
   */
  async tableFilesExist(
    tableName: string
  ): Promise<{ schema: boolean; data: boolean }> {
    const schemaPath = this.getTableSchemaPath(tableName);
    const dataPath = this.getTableDataPath(tableName);

    const [schemaExists, dataExists] = await Promise.all([
      DatabaseFileManager.fileExists(schemaPath),
      DatabaseFileManager.fileExists(dataPath),
    ]);

    return {
      schema: schemaExists,
      data: dataExists,
    };
  }

  /**
   * Get database directory size in bytes
   */
  async getDatabaseSize(): Promise<number> {
    if (!(await this.databaseDirectoryExists())) {
      return 0;
    }

    const files = await fs.readdir(this.databaseBasePath);
    let totalSize = 0;

    for (const file of files) {
      const filePath = path.join(this.databaseBasePath, file);
      const stats = await fs.stat(filePath);
      if (stats.isFile()) {
        totalSize += stats.size;
      }
    }

    return totalSize;
  }
}
