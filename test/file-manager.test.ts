import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { FileManager } from '../engine/file-manager';

describe('File-manager', () => {
  interface TempFileSetup {
    dir: string;
    filePath: string;
  }

  async function createTempFile(): Promise<TempFileSetup> {
    const dir: string = await fs.mkdtemp(path.join(os.tmpdir(), 'bindb-fm-'));
    const filePath: string = path.join(dir, 'test.data');
    await fs.writeFile(filePath, Buffer.alloc(0)); // Create empty file
    return { dir, filePath };
  }

  it('file handle reuse', async () => {
    const { dir, filePath }: TempFileSetup = await createTempFile();
    const fileManager = new FileManager(filePath);

    try {
      // Multiple reads should reuse the same file handle
      const data1: Buffer = await fileManager.read(10, 0);
      const data2: Buffer = await fileManager.read(5, 5);

      expect(data1.length).toBe(10); // Buffer allocated for 10 bytes
      expect(data2.length).toBe(5); // Buffer allocated for 5 bytes
    } finally {
      await fileManager.close();
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  it('read and write operations', async () => {
    const { dir, filePath }: TempFileSetup = await createTempFile();
    const fileManager = new FileManager(filePath);

    try {
      // Write test data
      const testData: Buffer = Buffer.from('Hello World');
      await fileManager.write(testData, 0);

      // Read back data
      const readData: Buffer = await fileManager.read(testData.length, 0);
      expect(readData).toEqual(testData);

      // Test partial read
      const partialData: Buffer = await fileManager.read(5, 6);
      expect(partialData.toString()).toBe('World');
    } finally {
      await fileManager.close();
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  it('write beyond current file size', async () => {
    const { dir, filePath }: TempFileSetup = await createTempFile();
    const fileManager = new FileManager(filePath);

    try {
      // Write at offset 100 (beyond current file size of 0)
      const testData: Buffer = Buffer.from('Test Data');
      await fileManager.write(testData, 100);

      // Read back the data
      const readData: Buffer = await fileManager.read(testData.length, 100);
      expect(readData).toEqual(testData);

      // Verify file was extended
      const stats = await fs.stat(filePath);
      expect(stats.size >= 109).toBeTruthy(); // At least 100 + 9 bytes
    } finally {
      await fileManager.close();
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  it('concurrent operations', async () => {
    const { dir, filePath }: TempFileSetup = await createTempFile();
    const fileManager = new FileManager(filePath);

    try {
      // Perform multiple concurrent operations
      const operations: Promise<void>[] = [];

      for (let i = 0; i < 5; i++) {
        const data: Buffer = Buffer.from(`Data ${i}`);
        const offset: number = i * 10;
        operations.push(fileManager.write(data, offset));
      }

      await Promise.all(operations);

      // Verify all writes
      for (let i = 0; i < 5; i++) {
        const offset: number = i * 10;
        const readData: Buffer = await fileManager.read(6, offset);
        expect(readData.toString()).toBe(`Data ${i}`);
      }
    } finally {
      await fileManager.close();
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  it('file manager error handling', async () => {
    const invalidPath: string = '/nonexistent/directory/file.data';
    const fileManager = new FileManager(invalidPath);

    try {
      // Should handle file access errors gracefully
      await expect(fileManager.read(10, 0)).rejects.toThrow(
        /ENOENT|EACCES|EPERM/
      );
    } finally {
      await fileManager.close();
    }
  });

  it('large file operations', async () => {
    const { dir, filePath }: TempFileSetup = await createTempFile();
    const fileManager = new FileManager(filePath);

    try {
      // Write a larger chunk of data
      const largeData: Buffer = Buffer.alloc(1024 * 10, 'A'); // 10KB of 'A's
      await fileManager.write(largeData, 0);

      // Read back in chunks
      const chunk1: Buffer = await fileManager.read(1024, 0);
      const chunk2: Buffer = await fileManager.read(1024, 1024);

      expect(chunk1.length).toBe(1024);
      expect(chunk2.length).toBe(1024);
      expect(chunk1.toString()).toBe('A'.repeat(1024));
      expect(chunk2.toString()).toBe('A'.repeat(1024));
    } finally {
      await fileManager.close();
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  it('file manager resource cleanup', async () => {
    const { dir, filePath }: TempFileSetup = await createTempFile();
    const fileManager = new FileManager(filePath);

    try {
      // Perform some operations
      await fileManager.write(Buffer.from('test'), 0);
      await fileManager.read(4, 0);

      // Close should clean up resources
      await fileManager.close();

      // Multiple close calls should be safe
      await fileManager.close();
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });
});
