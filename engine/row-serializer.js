import { readColumn, writeColumn } from './buffer-utils.js';

/**
 * RowSerializer - Handles row serialization and deserialization to/from binary format
 */

export const RowStatus = Object.freeze({
  Active: 0x00,
  Deleted: 0xff,
});

/**
 * Convert a row object to a binary buffer
 * @param {object} bufferSchema - The buffer schema
 * @param {object} row - The row data to serialize
 * @param {number} rowFlag - Row status flag (default: Active)
 * @returns {Buffer} Serialized row buffer
 */
export function serializeRow(bufferSchema, row, rowFlag = RowStatus.Active) {
  const { schema, size } = bufferSchema;
  const buffer = Buffer.alloc(size);
  
  // Write row status flag at position 0
  buffer.writeUInt8(rowFlag, 0);
  
  // Write each column
  for (const key in schema) {
    writeColumn(buffer, schema, key, row[key]);
  }

  return buffer;
}

/**
 * Convert a row object to a binary buffer and capture generated values
 * More efficient for inserts - avoids full parsing round trip
 * @param {object} bufferSchema - The buffer schema
 * @param {object} row - The row data to serialize
 * @param {number} rowFlag - Row status flag (default: Active)
 * @returns {object} { buffer: Buffer, generatedValues: object }
 */
export function serializeRowWithGenerated(bufferSchema, row, rowFlag = RowStatus.Active) {
  const { schema, size } = bufferSchema;
  const buffer = Buffer.alloc(size);
  const generatedValues = {};
  
  // Write row status flag at position 0
  buffer.writeUInt8(rowFlag, 0);
  
  // Write each column and capture generated values
  for (const key in schema) {
    const column = schema[key];
    let value = row[key];
    
    // Handle default value generation (IDs, timestamps, etc.)
    if (value === undefined && column.default && typeof column.default === 'function') {
      value = column.default();
      generatedValues[key] = value;
    }
    
    writeColumn(buffer, schema, key, value);
  }

  return { buffer, generatedValues };
}

/**
 * Parse a row object from a binary buffer
 * @param {object} bufferSchema - The buffer schema
 * @param {Buffer} buffer - The buffer to deserialize
 * @returns {object|null} Parsed row object or null if deleted
 */
export function deserializeRow(bufferSchema, buffer) {
  const { schema } = bufferSchema;

  // Validate buffer size
  if (buffer.length !== bufferSchema.size) {
    throw new Error(
      `Buffer size mismatch. Expected ${bufferSchema.size}, got ${buffer.length}`
    );
  }

  // Read and validate row status flag
  const rowFlag = buffer.readUInt8(0);
  
  // Fast path: check for deleted first (most common check)
  if (rowFlag === RowStatus.Deleted) {
    return null;
  }
  
  // Validate row flag (error case is rare)
  if (rowFlag !== RowStatus.Active) {
    throw new Error(`Invalid row flag: ${rowFlag}`);
  }

  // Deserialize each column
  const row = {};
  for (const key in schema) {
    row[key] = readColumn(buffer, bufferSchema, key);
  }
  
  return row;
}

/**
 * Create a buffer with deleted row status
 * @param {object} bufferSchema - The buffer schema
 * @returns {Buffer} Buffer marked as deleted
 */
export function createDeletedRowBuffer(bufferSchema) {
  const buffer = Buffer.alloc(bufferSchema.size);
  buffer.writeUInt8(RowStatus.Deleted, 0);
  return buffer;
}

/**
 * Check if a buffer represents a deleted row
 * @param {Buffer} buffer - Buffer to check
 * @returns {boolean} True if row is deleted
 */
export function isDeletedRow(buffer) {
  if (buffer.length === 0) {
    return false;
  }
  return buffer.readUInt8(0) === RowStatus.Deleted;
}

/**
 * Check if a buffer represents an active row
 * @param {Buffer} buffer - Buffer to check
 * @returns {boolean} True if row is active
 */
export function isActiveRow(buffer) {
  if (buffer.length === 0) {
    return false;
  }
  return buffer.readUInt8(0) === RowStatus.Active;
}

/**
 * Get row status from buffer
 * @param {Buffer} buffer - Buffer to check
 * @returns {number} Row status flag
 */
export function getRowStatus(buffer) {
  if (buffer.length === 0) {
    throw new Error('Cannot get status from empty buffer');
  }
  return buffer.readUInt8(0);
}

/**
 * Validate serialized row buffer
 * @param {Buffer} buffer - Buffer to validate
 * @param {object} bufferSchema - Expected buffer schema
 * @returns {object} Validation result with isValid and errors
 */
export function validateSerializedRow(buffer, bufferSchema) {
  const errors = [];
  
  if (!Buffer.isBuffer(buffer)) {
    errors.push('Input must be a Buffer');
    return { isValid: false, errors };
  }
  
  if (buffer.length !== bufferSchema.size) {
    errors.push(`Buffer size mismatch. Expected ${bufferSchema.size}, got ${buffer.length}`);
  }
  
  if (buffer.length > 0) {
    const rowFlag = buffer.readUInt8(0);
    if (rowFlag !== RowStatus.Active && rowFlag !== RowStatus.Deleted) {
      errors.push(`Invalid row status flag: ${rowFlag}`);
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Get serialization statistics for performance monitoring
 * @param {object} bufferSchema - Buffer schema
 * @returns {object} Serialization statistics
 */
export function getSerializationStats(bufferSchema) {
  const columnCount = Object.keys(bufferSchema.schema).length;
  
  return {
    bufferSize: bufferSchema.size,
    columnCount,
    statusFlagSize: 1,
    dataSize: bufferSchema.size - 1,
    averageColumnSize: columnCount > 0 ? (bufferSchema.size - 1) / columnCount : 0
  };
}