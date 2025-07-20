/**
 * High-performance write buffer manager
 * Batches write operations to reduce file I/O overhead
 */

/**
 * Write buffer configuration options
 */
export interface WriteBufferOptions {
  maxBufferSize?: number;
  maxBufferRecords?: number;
}

/**
 * Buffered write data
 */
export interface BufferedWrite {
  buffer: Buffer;
  position: number;
}

/**
 * Write operation with slot information
 */
export interface WriteOperation {
  slot: number;
  buffer: Buffer;
  position: number;
}

/**
 * Buffer statistics
 */
export interface BufferStats {
  recordCount: number;
  bufferSize: number;
  maxRecords: number;
  maxSize: number;
  recordUtilization: string;
  sizeUtilization: string;
  flushInProgress: boolean;
}

/**
 * Flush callback function type
 */
export type FlushCallback = (writes: WriteOperation[]) => Promise<void>;

export class WriteBuffer {
  private maxBufferSize: number;
  private maxBufferRecords: number;
  private buffer: Map<number, BufferedWrite> = new Map();
  private bufferSize: number = 0;
  private flushInProgress: boolean = false;
  private flushCallback: FlushCallback | null = null;

  constructor(options: WriteBufferOptions = {}) {
    this.maxBufferSize = options.maxBufferSize || 50 * 1024 * 1024; // 50MB
    this.maxBufferRecords = options.maxBufferRecords || 10000; // 10k records
  }

  /**
   * Set the flush callback function
   */
  setFlushCallback(callback: FlushCallback): void {
    this.flushCallback = callback;
  }

  /**
   * Add data to the write buffer
   */
  async add(slot: number, buffer: Buffer, position: number): Promise<boolean> {
    this.buffer.set(slot, { buffer, position });
    this.bufferSize += buffer.length;
    
    // Check if we need to auto-flush
    if (this.shouldFlush()) {
      await this.flush();
      return true;
    }
    
    return false;
  }

  /**
   * Get data from the write buffer
   */
  get(slot: number): BufferedWrite | undefined {
    return this.buffer.get(slot);
  }

  /**
   * Check if a slot exists in the buffer
   */
  has(slot: number): boolean {
    return this.buffer.has(slot);
  }

  /**
   * Check if buffer should be flushed
   */
  shouldFlush(): boolean {
    return this.buffer.size >= this.maxBufferRecords || 
           this.bufferSize >= this.maxBufferSize;
  }

  /**
   * Flush all buffered writes
   */
  async flush(): Promise<void> {
    if (this.flushInProgress || this.buffer.size === 0) {
      return;
    }
    
    this.flushInProgress = true;
    
    try {
      // Prepare writes for the callback
      const writes: WriteOperation[] = Array.from(this.buffer.entries())
        .map(([slot, data]) => ({ slot, ...data }));
      
      // Call the flush callback if provided
      if (this.flushCallback) {
        await this.flushCallback(writes);
      }
      
      // Clear buffer
      this.clear();
      
    } finally {
      this.flushInProgress = false;
    }
  }

  /**
   * Clear all buffered data
   */
  clear(): void {
    this.buffer.clear();
    this.bufferSize = 0;
  }

  /**
   * Get buffer statistics
   */
  getStats(): BufferStats {
    return {
      recordCount: this.buffer.size,
      bufferSize: this.bufferSize,
      maxRecords: this.maxBufferRecords,
      maxSize: this.maxBufferSize,
      recordUtilization: (this.buffer.size / this.maxBufferRecords * 100).toFixed(1) + '%',
      sizeUtilization: (this.bufferSize / this.maxBufferSize * 100).toFixed(1) + '%',
      flushInProgress: this.flushInProgress
    };
  }

  /**
   * Check if buffer is empty
   */
  isEmpty(): boolean {
    return this.buffer.size === 0;
  }

  /**
   * Get current buffer size in bytes
   */
  get currentSize(): number {
    return this.bufferSize;
  }

  /**
   * Get current number of buffered records
   */
  get currentRecords(): number {
    return this.buffer.size;
  }
}