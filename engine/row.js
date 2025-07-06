// File: row.js
import { Types, createSchemaIdGenerator } from './column.js';
import { readColumn, writeColumn } from './buffer-utils.js';
import {
  BYTE_SIZE,
  DOUBLE_SIZE,
  ID_FIELD,
  COORDINATES_SIZE,
  UINT16_SIZE,
  UNIQUE_IDENTIFIER_SIZE,
} from './constants.js';

// Column size handlers for each type
const columnSizeHandlers = {
  [Types.UniqueIdentifier]: (column, bufferSchema, database, table) => {
    bufferSchema[column.name]['meta'] = { database, table };
    return UNIQUE_IDENTIFIER_SIZE;
  },
  [Types.Text]: (column) => UINT16_SIZE + (column.length ?? DEFAULT_TEXT_LENGTH) * 4,
  [Types.Number]: () => DOUBLE_SIZE,
  [Types.Date]: () => DOUBLE_SIZE,
  [Types.UpdatedAt]: () => DOUBLE_SIZE,
  [Types.Boolean]: () => BYTE_SIZE,
  [Types.Buffer]: (column) => column.length,
  [Types.Coordinates]: () => COORDINATES_SIZE,
};

export const DEFAULT_TEXT_LENGTH = 32;

export const RowStatus = Object.freeze({
  Active: 0x00,
  Deleted: 0xff,
});

/**
 * Compute the Buffer size for each column
 * @param {import('./schema.js').Schema} schema - The table schema
 * @returns {{schema: Object, size: number}}
 */
export function parseBufferSchema(schema) {
  const { database, table, columns } = schema;
  let position = 1;
  const bufferSchema = {};

  if (columns.length === 0) {
    throw new Error('No columns defined for the schema');
  }

  if (columns.find((column) => column.name === ID_FIELD) === undefined) {
    columns.unshift({
      name: ID_FIELD,
      type: Types.UniqueIdentifier,
      default: createSchemaIdGenerator(schema),
    });
  } else if (
    columns.find((column) => column.name === ID_FIELD).default === undefined
  ) {
    columns.find((column) => column.name === ID_FIELD).default = createSchemaIdGenerator(schema);
  }

  for (const column of columns) {
    const offset = position;
    bufferSchema[column.name] = {
      type: column.type,
      offset,
      default: column.default,
    };

    const handler = columnSizeHandlers[column.type];
    if (!handler) {
      throw new Error(`Unknown column type: ${column.type}`);
    }
    
    position += handler(column, bufferSchema, database, table);

    // Add null flag byte
    position += BYTE_SIZE;

    bufferSchema[column.name]['size'] = position - offset;
    bufferSchema[column.name]['nullFlag'] = position - 1;
  }
  return {
    schema: Object.freeze(bufferSchema),
    size: position,
  };
}

/**
 * Convert an object to a buffer
 * @param {Object} bufferSchema - The schema
 * @param {Object} row - The row to write
 */
export function dataRowToBuffer(bufferSchema, row, rowFlag = RowStatus.Active) {
  const { schema, size } = bufferSchema;
  const buffer = Buffer.alloc(size);
  buffer.writeUInt8(rowFlag, 0);
  for (const key in schema) {
    writeColumn(buffer, schema, key, row[key]);
  }

  return buffer;
}

/**
 * Convert an object to a buffer and return generated values
 * More efficient for inserts - avoids full parsing round trip
 * @param {Object} bufferSchema - The schema
 * @param {Object} row - The row to write
 * @returns {Object} { buffer, generatedValues }
 */
export function dataRowToBufferWithGenerated(bufferSchema, row, rowFlag = RowStatus.Active) {
  const { schema, size } = bufferSchema;
  const buffer = Buffer.alloc(size);
  const generatedValues = {};
  
  buffer.writeUInt8(rowFlag, 0);
  
  for (const key in schema) {
    const column = schema[key];
    let value = row[key];
    
    // Capture generated values (IDs, timestamps, etc.)
    if (value === undefined && column.default && typeof column.default === 'function') {
      value = column.default();
      generatedValues[key] = value;
    }
    
    writeColumn(buffer, schema, key, value);
  }

  return { buffer, generatedValues };
}

/**
 * Parse an object from a buffer
 * @param {Object} bufferSchema - The schema
 * @param {Buffer} buffer - The buffer to parse from
 */
export function parseDataRow(bufferSchema, buffer) {
  const { schema } = bufferSchema;

  if (buffer.length !== bufferSchema.size) {
    throw new Error(
      `Buffer size mismatch. Expected ${bufferSchema.size}, got ${buffer.length}`
    );
  }

  const rowFlag = buffer.readUInt8(0);
  
  // Fast path: check for deleted first (most common check)
  if (rowFlag === RowStatus.Deleted) {
    return null;
  }
  
  // Validate only if not active (error case is rare)
  if (rowFlag !== RowStatus.Active) {
    throw new Error(`Invalid row flag: ${rowFlag}`);
  }

  const row = {};
  for (const key in schema) {
    row[key] = readColumn(buffer, bufferSchema, key);
  }
  return row;
}

// EOF
