// File: row.js
import { Types, uniqueId } from './column.js';
import { readColumn, writeColumn } from './buffer-utils.js';
import {
  BYTE_SIZE,
  DOUBLE_SIZE,
  ID_FIELD,
  COORDINATES_SIZE,
  UINT16_SIZE,
  UNIQUE_IDENTIFIER_SIZE,
} from './constants.js';

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
      default: () => uniqueId(database, table),
    });
  } else if (
    columns.find((column) => column.name === ID_FIELD).default === undefined
  ) {
    columns.find((column) => column.name === ID_FIELD).default = () =>
      uniqueId(database, table);
  }

  for (const column of columns) {
    const offset = position;
    bufferSchema[column.name] = {
      type: column.type,
      offset,
      default: column.default,
    };

    switch (column.type) {
      case Types.UniqueIdentifier:
        position += UNIQUE_IDENTIFIER_SIZE;
        bufferSchema[column.name]['meta'] = {
          database,
          table,
        };
        break;
      case Types.Text:
        position += UINT16_SIZE + (column.length ?? DEFAULT_TEXT_LENGTH) * 4;
        break;
      case Types.Number:
      case Types.Date:
      case Types.UpdatedAt:
        position += DOUBLE_SIZE;
        break;
      case Types.Boolean:
        position += BYTE_SIZE;
        break;
      case Types.Buffer:
        position += column.length;
        break;
      case Types.Coordinates:
        position += COORDINATES_SIZE;
        break;
      default:
        throw new Error(`Unknown column type: ${column.type}`);
    }

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
  if (Object.values(RowStatus).indexOf(rowFlag) === -1) {
    throw new Error(`Invalid row flag: ${rowFlag}`);
  } else if (rowFlag === RowStatus.Deleted) {
    return null;
  }

  const row = {};
  for (const key in schema) {
    row[key] = readColumn(buffer, bufferSchema, key);
  }
  return row;
}

// EOF
