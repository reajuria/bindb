import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * Database-level file operations manager
 * Handles database directory setup and metadata file operations
 */
export class DatabaseFileManager {
  constructor(storageBasePath, databaseName) {
    this.storageBasePath = storageBasePath;
    this.databaseName = databaseName;
    this.databaseBasePath = path.join(storageBasePath, databaseName);
    this.metadataFilePath = path.join(this.databaseBasePath, 'db_metadata.json');
  }

  /**
   * Check if a directory exists
   * @param {string} dirPath - Directory path to check
   * @returns {Promise<boolean>} True if directory exists
   */
  static async directoryExists(dirPath) {
    try {
      await fs.access(dirPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if a file exists
   * @param {string} filePath - File path to check
   * @returns {Promise<boolean>} True if file exists
   */
  static async fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Create directory if it doesn't exist
   * @param {string} dirPath - Directory path to create
   * @returns {Promise<void>}
   */
  static async ensureDirectory(dirPath) {
    if (!(await DatabaseFileManager.directoryExists(dirPath))) {
      await fs.mkdir(dirPath, { recursive: true });
    }
  }

  /**
   * Initialize database directory structure
   * @returns {Promise<void>}
   */
  async initializeDatabaseDirectory() {
    await DatabaseFileManager.ensureDirectory(this.databaseBasePath);
  }

  /**
   * Check if database directory exists
   * @returns {Promise<boolean>} True if database directory exists
   */
  async databaseDirectoryExists() {
    return DatabaseFileManager.directoryExists(this.databaseBasePath);
  }

  /**
   * Check if metadata file exists
   * @returns {Promise<boolean>} True if metadata file exists
   */
  async metadataFileExists() {
    return DatabaseFileManager.fileExists(this.metadataFilePath);
  }

  /**
   * Create metadata file with initial content
   * @param {object} initialMetadata - Initial metadata object
   * @returns {Promise<void>}
   */
  async createMetadataFile(initialMetadata = { tables: [] }) {
    await fs.writeFile(this.metadataFilePath, JSON.stringify(initialMetadata));
  }

  /**
   * Read metadata from file
   * @returns {Promise<object>} Parsed metadata object
   */
  async readMetadata() {
    const content = await fs.readFile(this.metadataFilePath, 'utf8');
    return JSON.parse(content);
  }

  /**
   * Write metadata to file
   * @param {object} metadata - Metadata object to write
   * @returns {Promise<void>}
   */
  async writeMetadata(metadata) {
    await fs.writeFile(this.metadataFilePath, JSON.stringify(metadata, null, 2));
  }

  /**
   * Initialize database files and directory structure
   * @param {object} initialMetadata - Initial metadata object
   * @returns {Promise<void>}
   */
  async initializeDatabase(initialMetadata = { tables: [] }) {
    // Ensure database directory exists
    await this.initializeDatabaseDirectory();

    // Create metadata file if it doesn't exist
    if (!(await this.metadataFileExists())) {
      await this.createMetadataFile(initialMetadata);
    }
  }

  /**
   * Get database file paths
   * @returns {object} Object containing various file paths
   */
  getPaths() {
    return {
      databaseBasePath: this.databaseBasePath,
      metadataFilePath: this.metadataFilePath,
      storageBasePath: this.storageBasePath
    };
  }

  /**
   * Get table schema file path
   * @param {string} tableName - Table name
   * @returns {string} Schema file path
   */
  getTableSchemaPath(tableName) {
    return path.join(this.databaseBasePath, `${tableName}.schema.json`);
  }

  /**
   * Get table data file path
   * @param {string} tableName - Table name
   * @returns {string} Data file path
   */
  getTableDataPath(tableName) {
    return path.join(this.databaseBasePath, `${tableName}.data`);
  }
}