import fs from 'node:fs/promises';

/**
 * High-performance file operations manager
 * Handles file handle reuse and optimized read/write operations
 */
export class FileManager {
  constructor(filePath) {
    this.filePath = filePath;
    this.readHandle = null;
    this.writeHandle = null;
  }

  /**
   * Get or create a read file handle
   * @returns {Promise<FileHandle>} File handle for reading
   */
  async getReadHandle() {
    if (!this.readHandle) {
      this.readHandle = await fs.open(this.filePath, 'r');
    }
    return this.readHandle;
  }

  /**
   * Get or create a write file handle
   * @returns {Promise<FileHandle>} File handle for writing
   */
  async getWriteHandle() {
    if (!this.writeHandle) {
      this.writeHandle = await fs.open(this.filePath, 'r+');
    }
    return this.writeHandle;
  }

  /**
   * Read data from a specific position in the file
   * @param {number} size - Number of bytes to read
   * @param {number} position - File position to read from
   * @returns {Promise<Buffer>} The read data
   */
  async read(size, position) {
    const handle = await this.getReadHandle();
    const { buffer } = await handle.read(
      Buffer.alloc(size),
      0,
      size,
      position
    );
    return buffer;
  }

  /**
   * Write data to a specific position in the file
   * @param {Buffer} buffer - Data to write
   * @param {number} position - File position to write to
   * @returns {Promise<void>}
   */
  async write(buffer, position) {
    const handle = await this.getWriteHandle();
    await handle.write(buffer, 0, buffer.length, position);
  }

  /**
   * Write multiple buffers to consecutive positions
   * Optimizes for sequential writes by grouping them
   * @param {Array} writes - Array of {buffer, position} objects
   * @returns {Promise<void>}
   */
  async writeMultiple(writes) {
    if (writes.length === 0) return;

    const handle = await this.getWriteHandle();
    
    // Sort by position for better disk performance
    const sortedWrites = writes.sort((a, b) => a.position - b.position);
    
    // Group consecutive writes
    const groups = [];
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
        await handle.write(group[0].buffer, 0, group[0].buffer.length, group[0].position);
      } else {
        // Concatenate buffers for single write
        const totalLength = group.reduce((sum, write) => sum + write.buffer.length, 0);
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
   * @returns {Promise<fs.Stats>} File stats
   */
  async stat() {
    const handle = await this.getReadHandle();
    return await handle.stat();
  }

  /**
   * Close all file handles
   * @returns {Promise<void>}
   */
  async close() {
    const promises = [];
    
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
   * @param {string} filePath - Path to check
   * @returns {Promise<boolean>} True if file exists
   */
  static async exists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Create an empty file if it doesn't exist
   * @param {string} filePath - Path to create
   * @returns {Promise<void>}
   */
  static async ensureFile(filePath) {
    if (!(await FileManager.exists(filePath))) {
      await fs.writeFile(filePath, '');
    }
  }
}