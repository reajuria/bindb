import fs, { type FileHandle } from 'node:fs/promises';
import type { Stats } from 'node:fs';

/**
 * Write operation descriptor
 */
export interface WriteOperation {
  buffer: Buffer;
  position: number;
}

/**
 * High-performance file operations manager
 * Handles file handle reuse and optimized read/write operations
 */
export class FileManager {
  private filePath: string;
  private readHandle: FileHandle | null = null;
  private writeHandle: FileHandle | null = null;

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  /**
   * Get or create a read file handle
   */
  async getReadHandle(): Promise<FileHandle> {
    if (!this.readHandle) {
      this.readHandle = await fs.open(this.filePath, 'r');
    }
    return this.readHandle;
  }

  /**
   * Get or create a write file handle
   */
  async getWriteHandle(): Promise<FileHandle> {
    if (!this.writeHandle) {
      this.writeHandle = await fs.open(this.filePath, 'r+');
    }
    return this.writeHandle;
  }

  /**
   * Read data from a specific position in the file
   */
  async read(size: number, position: number): Promise<Buffer> {
    const handle = await this.getReadHandle();
    const { buffer } = await handle.read(Buffer.alloc(size), 0, size, position);
    return buffer;
  }

  /**
   * Write data to a specific position in the file
   */
  async write(buffer: Buffer, position: number): Promise<void> {
    const handle = await this.getWriteHandle();
    await handle.write(buffer, 0, buffer.length, position);
  }

  /**
   * Write multiple buffers to consecutive positions
   * Optimizes for sequential writes by grouping them
   */
  async writeMultiple(writes: WriteOperation[]): Promise<void> {
    if (writes.length === 0) return;

    const handle = await this.getWriteHandle();

    // Sort by position for better disk performance
    const sortedWrites = writes.sort((a, b) => a.position - b.position);

    // Group consecutive writes
    const groups: WriteOperation[][] = [];
    let currentGroup = [sortedWrites[0]];

    for (let i = 1; i < sortedWrites.length; i++) {
      const current = sortedWrites[i];
      const previous = currentGroup[currentGroup.length - 1];

      // If writes are consecutive, group them
      if (current.position === previous.position + previous.buffer.length) {
        currentGroup.push(current);
      } else {
        groups.push(currentGroup);
        currentGroup = [current];
      }
    }
    groups.push(currentGroup);

    // Write each group as a single operation
    for (const group of groups) {
      if (group.length === 1) {
        // Single write
        await handle.write(
          group[0].buffer,
          0,
          group[0].buffer.length,
          group[0].position
        );
      } else {
        // Concatenate buffers for single write
        const totalLength = group.reduce(
          (sum, write) => sum + write.buffer.length,
          0
        );
        const combinedBuffer = Buffer.allocUnsafe(totalLength);
        let offset = 0;

        for (const write of group) {
          write.buffer.copy(combinedBuffer, offset);
          offset += write.buffer.length;
        }

        await handle.write(combinedBuffer, 0, totalLength, group[0].position);
      }
    }
  }

  /**
   * Get file statistics
   */
  async stat(): Promise<Stats> {
    const handle = await this.getReadHandle();
    return await handle.stat();
  }

  /**
   * Close all file handles
   */
  async close(): Promise<void> {
    const promises: Promise<void>[] = [];

    if (this.readHandle) {
      promises.push(this.readHandle.close());
      this.readHandle = null;
    }

    if (this.writeHandle) {
      promises.push(this.writeHandle.close());
      this.writeHandle = null;
    }

    await Promise.all(promises);
  }

  /**
   * Check if file exists
   */
  static async exists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Create an empty file if it doesn't exist
   */
  static async ensureFile(filePath: string): Promise<void> {
    if (!(await FileManager.exists(filePath))) {
      await fs.writeFile(filePath, '');
    }
  }
}
