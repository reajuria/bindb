import { Types } from './column.js';
import {
  DOUBLE_SIZE,
  UINT16_SIZE,
  UNIQUE_IDENTIFIER_SIZE,
} from './constants.js';

// Write handlers for each column type
const writeHandlers = {
  [Types.UniqueIdentifier]: (buffer, column, value) => {
    buffer.write(value, column.offset, UNIQUE_IDENTIFIER_SIZE, 'hex');
  },
  [Types.Text]: (buffer, column, value) => {
    const length = value.length;
    buffer.writeUInt16BE(length, column.offset);
    if (length > 0) {
      buffer.write(
        value,
        column.offset + UINT16_SIZE,
        column.size - UINT16_SIZE,
        'utf8'
      );
    }
  },
  [Types.Number]: (buffer, column, value) => {
    buffer.writeDoubleBE(value, column.offset);
  },
  [Types.Date]: (buffer, column, value) => {
    const date = value instanceof Date ? value : new Date(value);
    buffer.writeDoubleBE(date.getTime(), column.offset);
  },
  [Types.UpdatedAt]: (buffer, column, value) => {
    const date = new Date();
    buffer.writeDoubleBE(date.getTime(), column.offset);
  },
  [Types.Boolean]: (buffer, column, value) => {
    buffer.writeUInt8(value ? 1 : 0, column.offset);
  },
  [Types.Buffer]: (buffer, column, value) => {
    value?.copy(buffer, column.offset, 0, column.size - 1);
  },
  [Types.Coordinates]: (buffer, column, value) => {
    buffer.writeDoubleBE(value.lat, column.offset);
    buffer.writeDoubleBE(value.lng, column.offset + DOUBLE_SIZE);
  },
};

// Read handlers for each column type
const readHandlers = {
  [Types.UniqueIdentifier]: (buffer, column) => {
    return buffer
      .slice(column.offset, column.offset + UNIQUE_IDENTIFIER_SIZE)
      .toString('hex');
  },
  [Types.Text]: (buffer, column) => {
    const length = buffer.readUInt16BE(column.offset);
    const text = buffer.slice(
      column.offset + UINT16_SIZE,
      column.offset + UINT16_SIZE + length
    );
    return text.toString('utf8');
  },
  [Types.Number]: (buffer, column) => {
    return buffer.readDoubleBE(column.offset);
  },
  [Types.Date]: (buffer, column) => {
    const date = buffer.readDoubleBE(column.offset);
    return new Date(date);
  },
  [Types.UpdatedAt]: (buffer, column) => {
    const date = buffer.readDoubleBE(column.offset);
    return new Date(date);
  },
  [Types.Boolean]: (buffer, column) => {
    return buffer.readUInt8(column.offset) === 1;
  },
  [Types.Buffer]: (buffer, column) => {
    return Buffer.from(
      buffer.slice(column.offset, column.offset + column.size - 1)
    );
  },
  [Types.Coordinates]: (buffer, column) => {
    const lat = buffer.readDoubleBE(column.offset);
    const lng = buffer.readDoubleBE(column.offset + DOUBLE_SIZE);
    return { lat, lng };
  },
};

/**
 * Write a value to a buffer
 * @param {Buffer} buffer - The buffer to write to
 * @param {Object} bufferSchema - The schema
 * @param {string} key - The key of the value to write
 * @param {any} value - The value to write
 */
export function writeColumn(buffer, bufferSchema, key, value) {
  // Get the column schema
  const column = bufferSchema[key];

  // Check if the value is null and set the null flag byte accordingly
  const isNull = value === null;
  const isUndefined = value === undefined;
  let isNil = isNull || isUndefined;

  if (
    isUndefined &&
    column.default !== undefined &&
    typeof column.default === 'function'
  ) {
    value = column.default();
  }

  isNil = isNil && value === undefined;

  buffer.writeUInt8(isNil ? 1 : 0, column.nullFlag);
  if (isNil) {
    return;
  }

  const handler = writeHandlers[column.type];
  if (!handler) {
    throw new Error(`Unknown column type: ${column.type}`);
  }

  handler(buffer, column, value);
}

/**
 * Read a value from a buffer
 * @param {Buffer} buffer - The buffer to read from
 * @param {Object} bufferSchema - The schema
 * @param {string} key - The key of the value to read
 * @returns {any}
 */
export function readColumn(buffer, bufferSchema, key) {
  const { schema } = bufferSchema;
  const column = schema[key];

  const isNull = buffer.readUInt8(column.nullFlag) === 1;

  if (isNull) {
    return null;
  }

  const handler = readHandlers[column.type];
  if (!handler) {
    throw new Error(`Unknown column type: ${column.type}`);
  }

  return handler(buffer, column);
}
