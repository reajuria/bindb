import {
  readColumn,
  writeColumn,
  type BufferSchema,
  type ColumnValue,
} from './buffer-utils';

/**
 * RowSerializer - Handles row serialization and deserialization to/from binary format
 */

/**
 * Row status enumeration
 */
export enum RowStatus {
  Active = 0x00,
  Deleted = 0xff,
}

/**
 * Row data object
 */
export interface RowData {
  [key: string]: ColumnValue;
}

/**
 * Serialization result with generated values
 */
export interface SerializationResult {
  buffer: Buffer;
  generatedValues: Record<string, ColumnValue>;
}

/**
 * Row validation result
 */
export interface RowValidation {
  isValid: boolean;
  errors: string[];
}

/**
 * Serialization statistics
 */
export interface SerializationStats {
  bufferSize: number;
  columnCount: number;
  statusFlagSize: number;
  dataSize: number;
  averageColumnSize: number;
}

/**
 * Convert a row object to a binary buffer
 */
export function serializeRow(
  bufferSchema: BufferSchema,
  row: RowData,
  rowFlag: RowStatus = RowStatus.Active
): Buffer {
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
 */
export function serializeRowWithGenerated(
  bufferSchema: BufferSchema,
  row: RowData,
  rowFlag: RowStatus = RowStatus.Active
): SerializationResult {
  const { schema, size } = bufferSchema;
  const buffer = Buffer.alloc(size);
  const generatedValues: Record<string, ColumnValue> = {};

  // Write row status flag at position 0
  buffer.writeUInt8(rowFlag, 0);

  // Write each column and capture generated values
  for (const key in schema) {
    const column = schema[key];
    let value = row[key];

    // Handle default value generation (IDs, timestamps, etc.)
    if (
      value === undefined &&
      column.default &&
      typeof column.default === 'function'
    ) {
      value = column.default();
      generatedValues[key] = value;
    }

    writeColumn(buffer, schema, key, value);
  }

  return { buffer, generatedValues };
}

/**
 * Parse a row object from a binary buffer
 */
export function deserializeRow(
  bufferSchema: BufferSchema,
  buffer: Buffer
): RowData | null {
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
  const row: RowData = {};
  for (const key in schema) {
    row[key] = readColumn(buffer, bufferSchema, key);
  }

  return row;
}

/**
 * Create a buffer with deleted row status
 */
export function createDeletedRowBuffer(bufferSchema: BufferSchema): Buffer {
  const buffer = Buffer.alloc(bufferSchema.size);
  buffer.writeUInt8(RowStatus.Deleted, 0);
  return buffer;
}

/**
 * Check if a buffer represents a deleted row
 */
export function isDeletedRow(buffer: Buffer): boolean {
  if (buffer.length === 0) {
    return false;
  }
  return buffer.readUInt8(0) === RowStatus.Deleted;
}

/**
 * Check if a buffer represents an active row
 */
export function isActiveRow(buffer: Buffer): boolean {
  if (buffer.length === 0) {
    return false;
  }
  return buffer.readUInt8(0) === RowStatus.Active;
}

/**
 * Get row status from buffer
 */
export function getRowStatus(buffer: Buffer): RowStatus {
  if (buffer.length === 0) {
    throw new Error('Cannot get status from empty buffer');
  }
  return buffer.readUInt8(0) as RowStatus;
}

/**
 * Validate serialized row buffer
 */
export function validateSerializedRow(
  buffer: Buffer,
  bufferSchema: BufferSchema
): RowValidation {
  const errors: string[] = [];

  if (!Buffer.isBuffer(buffer)) {
    errors.push('Input must be a Buffer');
    return { isValid: false, errors };
  }

  if (buffer.length !== bufferSchema.size) {
    errors.push(
      `Buffer size mismatch. Expected ${bufferSchema.size}, got ${buffer.length}`
    );
  }

  if (buffer.length > 0) {
    const rowFlag = buffer.readUInt8(0);
    if (rowFlag !== RowStatus.Active && rowFlag !== RowStatus.Deleted) {
      errors.push(`Invalid row status flag: ${rowFlag}`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Get serialization statistics for performance monitoring
 */
export function getSerializationStats(
  bufferSchema: BufferSchema
): SerializationStats {
  const columnCount = Object.keys(bufferSchema.schema).length;

  return {
    bufferSize: bufferSchema.size,
    columnCount,
    statusFlagSize: 1,
    dataSize: bufferSchema.size - 1,
    averageColumnSize:
      columnCount > 0 ? (bufferSchema.size - 1) / columnCount : 0,
  };
}
