import { UNIQUE_IDENTIFIER_SIZE } from './constants.js';
import { strHash } from './util.js';

/**
 * IdGenerator - Handles unique ID generation with timestamp and counter
 */

let counter = 0;

/**
 * Generate a unique ID
 * @param {string[]} args - Additional arguments to include in the hash
 * @returns {string} Unique identifier as hex string
 */
export function uniqueId(...args) {
  const buffer = Buffer.alloc(UNIQUE_IDENTIFIER_SIZE);
  const hash = strHash(4, ...args);
  buffer.write(hash, 0, 4, 'hex');
  
  // Use high-resolution timestamp with counter for uniqueness
  const nowInMs = Date.now();
  
  // Combine timestamp + counter into 8 bytes
  // 6 bytes for timestamp (milliseconds), 2 bytes for counter
  const timestampBigInt = BigInt(nowInMs);
  const counterValue = counter++ % 65536;
  
  buffer.writeUIntBE(Number(timestampBigInt & 0xFFFFFFFFFFFFn), 4, 6);
  buffer.writeUInt16BE(counterValue, 10);

  return buffer.toString('hex');
}

/**
 * Create an optimized unique ID generator for a specific schema
 * Uses the schema's cached hash for maximum performance
 * @param {import('./schema.js').Schema} schema - Schema instance with cached hash
 * @returns {Function} Optimized ID generator function
 */
export function createSchemaIdGenerator(schema) {
  // Get pre-computed hash buffer from schema (bytes 0-3)
  const tableHashBuffer = schema.tableHashBuffer;
  
  if (!tableHashBuffer) {
    throw new Error('Schema must have database and table names set to generate IDs');
  }
  
  // Return optimized generator that reuses the schema's cached hash
  return () => {
    const buffer = Buffer.alloc(UNIQUE_IDENTIFIER_SIZE);
    
    // Copy pre-computed hash (bytes 0-3) - ULTRA FAST!
    tableHashBuffer.copy(buffer, 0, 0, 4);
    
    // Only compute dynamic parts (bytes 4-11)
    const nowInMs = Date.now();
    const timestampBigInt = BigInt(nowInMs);
    const counterValue = counter++ % 65536;
    
    buffer.writeUIntBE(Number(timestampBigInt & 0xFFFFFFFFFFFFn), 4, 6);
    buffer.writeUInt16BE(counterValue, 10);
    
    return buffer.toString('hex');
  };
}

/**
 * Parse a date from a unique ID
 * @param {string} id - The unique ID
 * @returns {Date} Date extracted from the ID
 */
export function uniqueIdDate(id) {
  const buffer = Buffer.from(id, 'hex');
  const timestampMs = buffer.readUIntBE(4, 6);
  return new Date(timestampMs);
}

/**
 * Reset the global counter (useful for testing)
 * @param {number} value - Value to reset counter to (default: 0)
 */
export function resetCounter(value = 0) {
  counter = value;
}

/**
 * Get the current counter value (useful for testing)
 * @returns {number} Current counter value
 */
export function getCounter() {
  return counter;
}