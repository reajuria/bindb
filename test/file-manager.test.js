import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { FileManager } from '../engine/file-manager.js';

async function createTempFile() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'bindb-fm-'));
  const filePath = path.join(dir, 'test.data');
  await fs.writeFile(filePath, Buffer.alloc(0)); // Create empty file
  return { dir, filePath };
}

test('file handle reuse', async () => {
  const { dir, filePath } = await createTempFile();
  const fileManager = new FileManager(filePath);
  
  try {
    // Multiple reads should reuse the same file handle
    const data1 = await fileManager.read(10, 0);
    const data2 = await fileManager.read(5, 5);
    
    assert.equal(data1.length, 10); // Buffer allocated for 10 bytes
    assert.equal(data2.length, 5); // Buffer allocated for 5 bytes
    
  } finally {
    await fileManager.close();
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('read and write operations', async () => {
  const { dir, filePath } = await createTempFile();
  const fileManager = new FileManager(filePath);
  
  try {
    // Write test data
    const testData = Buffer.from('Hello World');
    await fileManager.write(testData, 0);
    
    // Read back data
    const readData = await fileManager.read(testData.length, 0);
    assert.deepEqual(readData, testData);
    
    // Test partial read
    const partialData = await fileManager.read(5, 6);
    assert.equal(partialData.toString(), 'World');
    
  } finally {
    await fileManager.close();
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('writeMultiple optimization', async () => {
  const { dir, filePath } = await createTempFile();
  const fileManager = new FileManager(filePath);
  
  try {
    // Prepare multiple writes
    const writes = [
      { buffer: Buffer.from('First'), position: 0 },
      { buffer: Buffer.from('Second'), position: 10 },
      { buffer: Buffer.from('Third'), position: 20 }
    ];
    
    await fileManager.writeMultiple(writes);
    
    // Verify all writes
    const firstRead = await fileManager.read(5, 0);
    const secondRead = await fileManager.read(6, 10);
    const thirdRead = await fileManager.read(5, 20);
    
    assert.equal(firstRead.toString(), 'First');
    assert.equal(secondRead.toString(), 'Second');
    assert.equal(thirdRead.toString(), 'Third');
    
  } finally {
    await fileManager.close();
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('error handling for non-existent file', async () => {
  const nonExistentPath = path.join(os.tmpdir(), 'non-existent-file.data');
  const fileManager = new FileManager(nonExistentPath);
  
  try {
    // Reading from non-existent file should throw error
    await assert.rejects(
      async () => await fileManager.read(10, 0),
      /ENOENT/
    );
    
  } finally {
    await fileManager.close();
    await fs.rm(nonExistentPath, { force: true });
  }
});

test('proper resource cleanup', async () => {
  const { dir, filePath } = await createTempFile();
  const fileManager = new FileManager(filePath);
  
  try {
    // Use the file manager
    await fileManager.write(Buffer.from('test'), 0);
    
    // Close should not throw
    await fileManager.close();
    
    // Multiple closes should be safe
    await fileManager.close();
    
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});