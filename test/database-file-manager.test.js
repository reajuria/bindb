import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { DatabaseFileManager } from '../engine/database-file-manager.js';

async function createTempDir() {
  return fs.mkdtemp(path.join(os.tmpdir(), 'bindb-dfm-'));
}

test('database directory initialization', async () => {
  const baseDir = await createTempDir();
  const dbName = 'testdb';
  const fileManager = new DatabaseFileManager(baseDir, dbName);
  
  try {
    await fileManager.initializeDatabase();
    
    // Verify database directory was created
    const dbDir = path.join(baseDir, dbName);
    const stat = await fs.stat(dbDir);
    assert.ok(stat.isDirectory());
    
    // Verify metadata file was created
    const metadataPath = path.join(dbDir, 'db_metadata.json');
    const metadataStat = await fs.stat(metadataPath);
    assert.ok(metadataStat.isFile());
    
  } finally {
    await fs.rm(baseDir, { recursive: true, force: true });
  }
});

test('metadata file operations', async () => {
  const baseDir = await createTempDir();
  const dbName = 'testdb';
  const fileManager = new DatabaseFileManager(baseDir, dbName);
  
  try {
    const initialMetadata = { tables: ['users', 'posts'] };
    await fileManager.initializeDatabase(initialMetadata);
    
    // Read metadata
    const metadata = await fileManager.readMetadata();
    assert.deepEqual(metadata, initialMetadata);
    
    // Update metadata
    const updatedMetadata = { tables: ['users', 'posts', 'comments'] };
    await fileManager.writeMetadata(updatedMetadata);
    
    // Verify update
    const newMetadata = await fileManager.readMetadata();
    assert.deepEqual(newMetadata, updatedMetadata);
    
  } finally {
    await fs.rm(baseDir, { recursive: true, force: true });
  }
});

test('path generation utilities', async () => {
  const baseDir = await createTempDir();
  const dbName = 'testdb';
  const fileManager = new DatabaseFileManager(baseDir, dbName);
  
  try {
    await fileManager.initializeDatabase();
    
    // Test table data path generation
    const dataPath = fileManager.getTableDataPath('users');
    const expectedDataPath = path.join(baseDir, dbName, 'users.data');
    assert.equal(dataPath, expectedDataPath);
    
    // Test table schema path generation
    const schemaPath = fileManager.getTableSchemaPath('users');
    const expectedSchemaPath = path.join(baseDir, dbName, 'users.schema.json');
    assert.equal(schemaPath, expectedSchemaPath);
    
  } finally {
    await fs.rm(baseDir, { recursive: true, force: true });
  }
});

test('file existence checks', async () => {
  const baseDir = await createTempDir();
  const dbName = 'testdb';
  const fileManager = new DatabaseFileManager(baseDir, dbName);
  
  try {
    // Before initialization
    assert.equal(await fileManager.metadataFileExists(), false);
    
    // After initialization
    await fileManager.initializeDatabase();
    assert.equal(await fileManager.metadataFileExists(), true);
    
  } finally {
    await fs.rm(baseDir, { recursive: true, force: true });
  }
});

test('database reinitialization handling', async () => {
  const baseDir = await createTempDir();
  const dbName = 'testdb';
  const fileManager = new DatabaseFileManager(baseDir, dbName);
  
  try {
    // First initialization
    const originalMetadata = { tables: ['original'] };
    await fileManager.initializeDatabase(originalMetadata);
    
    // Second initialization should not overwrite existing metadata
    const newMetadata = { tables: ['new'] };
    await fileManager.initializeDatabase(newMetadata);
    
    // Should still have original metadata
    const metadata = await fileManager.readMetadata();
    assert.deepEqual(metadata, originalMetadata);
    
  } finally {
    await fs.rm(baseDir, { recursive: true, force: true });
  }
});

test('error handling for invalid paths', async () => {
  const invalidDir = '/invalid/path/that/does/not/exist';
  const fileManager = new DatabaseFileManager(invalidDir, 'testdb');
  
  // Should handle creation errors gracefully
  await assert.rejects(
    async () => await fileManager.initializeDatabase(),
    /ENOENT/
  );
});

test('concurrent initialization safety', async () => {
  const baseDir = await createTempDir();
  const dbName = 'testdb';
  
  try {
    // Multiple file managers for same database
    const fm1 = new DatabaseFileManager(baseDir, dbName);
    const fm2 = new DatabaseFileManager(baseDir, dbName);
    
    // Concurrent initialization should be safe
    await Promise.all([
      fm1.initializeDatabase({ tables: ['table1'] }),
      fm2.initializeDatabase({ tables: ['table2'] })
    ]);
    
    // One of the metadata sets should win
    const metadata = await fm1.readMetadata();
    assert.ok(metadata.tables.length >= 1);
    
  } finally {
    await fs.rm(baseDir, { recursive: true, force: true });
  }
});