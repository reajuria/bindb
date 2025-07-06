// File: column.js
import { UNIQUE_IDENTIFIER_SIZE } from './constants.js';
import { strHash } from './util.js';

/**
 * Enum for Column Types
 * @readonly
 * @enum {string}
 */
export const Types = Object.freeze({
  UniqueIdentifier: 'UniqueIdentifier',
  Text: 'Text',
  Number: 'Number',
  Boolean: 'Boolean',
  Date: 'Date',
  UpdatedAt: 'UpdatedAt',
  Buffer: 'Buffer',
  Coordinates: 'Coordinates',
});

let counter = 0;


export function getNanoseconds(dateMs = Date.now()) {
  const hrtimeInNs = process.hrtime.bigint();
  const dateNs = BigInt(dateMs) * BigInt(1000000);
  const dateInNs = dateNs + hrtimeInNs;

  // Calculate the remainder when dividing by 1 millisecond (in nanoseconds)
  const nsPerMillisecond = BigInt(1000000);
  const currentNanosecondsBigInt = dateInNs % nsPerMillisecond;

  // Convert BigInt to a Number (integer)
  return Number(currentNanosecondsBigInt);
}

/**
 * Generate a unique ID
 * @param {string[]} args - Additional arguments to include in the hash
 * @returns {string}
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
 * @returns {Date}
 */
export function uniqueIdDate(id) {
  const buffer = Buffer.from(id, 'hex');
  const timestampMs = buffer.readUIntBE(4, 6);
  return new Date(timestampMs);
}
