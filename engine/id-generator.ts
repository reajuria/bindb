import { UNIQUE_IDENTIFIER_SIZE } from './constants';
import { ValidationError } from './errors';
import type { Schema } from './schema';
import { strHash } from './util';

/**
 * IdGenerator - Handles unique ID generation with timestamp and counter
 */

/**
 * Type for the optimized ID generator function
 */
export type SchemaIdGenerator = () => string;

let counter = 0;

/**
 * Generate a unique ID
 */
export function uniqueId(...args: string[]): string {
  const buffer = Buffer.alloc(UNIQUE_IDENTIFIER_SIZE);
  const hash = strHash(4, ...args);
  buffer.write(hash, 0, 4, 'hex');

  // Use high-resolution timestamp with counter for uniqueness
  const nowInMs = Date.now();

  // Combine timestamp + counter into 8 bytes
  // 6 bytes for timestamp (milliseconds), 2 bytes for counter
  const timestampBigInt = BigInt(nowInMs);
  const counterValue = counter++ % 65536;

  buffer.writeUIntBE(Number(timestampBigInt & 0xffffffffffffn), 4, 6);
  buffer.writeUInt16BE(counterValue, 10);

  return buffer.toString('hex');
}

/**
 * Create an optimized unique ID generator for a specific schema
 * Uses the schema's cached hash for maximum performance
 */
export function createSchemaIdGenerator(schema: Schema): SchemaIdGenerator {
  // Get pre-computed hash buffer from schema (bytes 0-3)
  const tableHashBuffer = schema.tableHashBuffer;

  if (!tableHashBuffer) {
    throw new ValidationError(
      'Schema must have database and table names set to generate IDs'
    );
  }

  // Return optimized generator that reuses the schema's cached hash
  return (): string => {
    const buffer = Buffer.alloc(UNIQUE_IDENTIFIER_SIZE);

    // Copy pre-computed hash (bytes 0-3) - ULTRA FAST!
    tableHashBuffer.copy(buffer, 0, 0, 4);

    // Only compute dynamic parts (bytes 4-11)
    const nowInMs = Date.now();
    const timestampBigInt = BigInt(nowInMs);
    const counterValue = counter++ % 65536;

    buffer.writeUIntBE(Number(timestampBigInt & 0xffffffffffffn), 4, 6);
    buffer.writeUInt16BE(counterValue, 10);

    return buffer.toString('hex');
  };
}

/**
 * Parse a date from a unique ID
 */
export function uniqueIdDate(id: string): Date {
  const buffer = Buffer.from(id, 'hex');
  const timestampMs = buffer.readUIntBE(4, 6);
  return new Date(timestampMs);
}
