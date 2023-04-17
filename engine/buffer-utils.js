import { Types } from './column.js';
import {
  DOUBLE_SIZE,
  UINT16_SIZE,
  UNIQUE_IDENTIFIER_SIZE,
} from './constants.js';

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

  switch (column.type) {
    case Types.UniqueIdentifier:
      buffer.write(value, column.offset, UNIQUE_IDENTIFIER_SIZE, 'hex');
      break;
    case Types.Text:
      // Handle the case of an empty string
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
      break;
    case Types.Number:
      buffer.writeDoubleBE(value, column.offset);
      break;
    case Types.Date:
    case Types.UpdatedAt:
      const dateInput = column.type === Types.Date ? value : new Date();
      const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
      buffer.writeDoubleBE(date.getTime(), column.offset);
      break;
    case Types.Boolean:
      buffer.writeUInt8(value ? 1 : 0, column.offset);
      break;
    case Types.Buffer:
      value?.copy(buffer, column.offset, 0, column.size - 1);
      break;
    case Types.Coordinates:
      buffer.writeDoubleBE(value.lat, column.offset);
      buffer.writeDoubleBE(value.lng, column.offset + DOUBLE_SIZE);
      break;
    default:
      throw new Error(`Unknown column type: ${column.type}`);
  }

  return;
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

  switch (column.type) {
    case Types.UniqueIdentifier:
      return buffer
        .slice(column.offset, column.offset + UNIQUE_IDENTIFIER_SIZE)
        .toString('hex');
    case Types.Text:
      const length = buffer.readUInt16BE(column.offset);
      const text = buffer.slice(
        column.offset + UINT16_SIZE,
        column.offset + UINT16_SIZE + length
      );
      return text.toString('utf8');
    case Types.Number:
      return buffer.readDoubleBE(column.offset);
    case Types.Date:
      const date = buffer.readDoubleBE(column.offset);
      return new Date(date);
    case Types.Boolean:
      return buffer.readUInt8(column.offset) === 1;
    case Types.Buffer:
      return Buffer.from(
        buffer.slice(column.offset, column.offset + column.size - 1)
      );
    case Types.Coordinates:
      const lat = buffer.readDoubleBE(column.offset);
      const lng = buffer.readDoubleBE(column.offset + DOUBLE_SIZE);
      return {
        lat,
        lng,
      };
    default:
      throw new Error(`Unknown column type: ${column.type}`);
  }
}
