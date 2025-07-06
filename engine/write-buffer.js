/**
 * High-performance write buffer manager
 * Batches write operations to reduce file I/O overhead
 */
export class WriteBuffer {
  /**
   * @param {object} options - Buffer configuration
   * @param {number} options.maxBufferSize - Maximum buffer size in bytes (default: 50MB)
   * @param {number} options.maxBufferRecords - Maximum number of records to buffer (default: 10000)
   */
  constructor(options = {}) {
    this.maxBufferSize = options.maxBufferSize || 50 * 1024 * 1024; // 50MB
    this.maxBufferRecords = options.maxBufferRecords || 10000; // 10k records
    
    this.buffer = new Map(); // slot -> {buffer, position}
    this.bufferSize = 0;
    this.flushInProgress = false;
    this.flushCallback = null;
  }

  /**
   * Set the flush callback function
   * @param {Function} callback - Function to call when flushing (receives array of writes)
   */
  setFlushCallback(callback) {
    this.flushCallback = callback;
  }

  /**
   * Add data to the write buffer
   * @param {number} slot - Slot identifier
   * @param {Buffer} buffer - Data buffer
   * @param {number} position - File position
   * @returns {Promise<boolean>} True if auto-flush was triggered
   */
  async add(slot, buffer, position) {
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
   * @param {number} slot - Slot identifier
   * @returns {object|undefined} Buffer data or undefined if not found
   */
  get(slot) {
    return this.buffer.get(slot);
  }

  /**
   * Check if a slot exists in the buffer
   * @param {number} slot - Slot identifier
   * @returns {boolean} True if slot exists in buffer
   */
  has(slot) {
    return this.buffer.has(slot);
  }

  /**
   * Check if buffer should be flushed
   * @returns {boolean} True if buffer should be flushed
   */
  shouldFlush() {
    return this.buffer.size >= this.maxBufferRecords || 
           this.bufferSize >= this.maxBufferSize;
  }

  /**
   * Flush all buffered writes
   * @returns {Promise<void>}
   */
  async flush() {
    if (this.flushInProgress || this.buffer.size === 0) {
      return;
    }
    
    this.flushInProgress = true;
    
    try {
      // Prepare writes for the callback
      const writes = Array.from(this.buffer.entries())
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
  clear() {
    this.buffer.clear();
    this.bufferSize = 0;
  }

  /**
   * Get buffer statistics
   * @returns {object} Buffer statistics
   */
  getStats() {
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
   * @returns {boolean} True if buffer is empty
   */
  isEmpty() {
    return this.buffer.size === 0;
  }

  /**
   * Get current buffer size in bytes
   * @returns {number} Buffer size in bytes
   */
  get currentSize() {
    return this.bufferSize;
  }

  /**
   * Get current number of buffered records
   * @returns {number} Number of buffered records
   */
  get currentRecords() {
    return this.buffer.size;
  }
}