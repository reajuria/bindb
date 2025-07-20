import { Types } from './column.js';
import {
  DOUBLE_SIZE,
  UINT16_SIZE,
  UNIQUE_IDENTIFIER_SIZE,
} from './constants.js';

/**
 * Buffer schema column definition
 */
export interface BufferSchemaColumn {
  type: Types;
  offset: number;
  size: number;
  nullFlag: number;
  default?: () => any;
  meta?: Record<string, any>;
  [key: string]: any; // Allow additional properties
}

/**
 * Buffer schema definition
 */
export interface BufferSchema {
  schema: Record<string, BufferSchemaColumn>;
  size: number;
}

/**
 * Coordinates value type
 */
export interface Coordinates {
  lat: number;
  lng: number;
}

/**
 * Column value types
 */
export type ColumnValue =
  | string
  | number
  | boolean
  | Date
  | Buffer
  | Coordinates
  | null
  | undefined;

/**
 * Write handler function type
 */
type WriteHandler = (
  buffer: Buffer,
  column: BufferSchemaColumn,
  value: any
) => void;

/**
 * Read handler function type
 */
type ReadHandler = (buffer: Buffer, column: BufferSchemaColumn) => any;

// Write handlers for each column type
const writeHandlers: Record<Types, WriteHandler> = {
  [Types.UniqueIdentifier]: (buffer, column, value: string) => {
    buffer.write(value, column.offset, UNIQUE_IDENTIFIER_SIZE, 'hex');
  },
  [Types.Text]: (buffer, column, value: string | null | undefined) => {
    const text = value || '';
    const byteLength = Buffer.byteLength(text, 'utf8');
    const maxBytes = column.size - UINT16_SIZE;

    if (byteLength <= maxBytes) {
      buffer.writeUInt16BE(byteLength, column.offset);
      if (byteLength > 0) {
        buffer.write(text, column.offset + UINT16_SIZE, maxBytes, 'utf8');
      }
    } else {
      // Truncate to fit, ensuring we don't break UTF-8 characters
      let truncated = text;
      let currentByteLength = byteLength;

      while (currentByteLength > maxBytes && truncated.length > 0) {
        truncated = truncated.slice(0, -1);
        currentByteLength = Buffer.byteLength(truncated, 'utf8');
      }

      buffer.writeUInt16BE(currentByteLength, column.offset);
      if (currentByteLength > 0) {
        buffer.write(truncated, column.offset + UINT16_SIZE, maxBytes, 'utf8');
      }
    }
  },
  [Types.Number]: (buffer, column, value: number) => {
    buffer.writeDoubleBE(value, column.offset);
  },
  [Types.Date]: (buffer, column, value: Date | string | number) => {
    const date = value instanceof Date ? value : new Date(value);
    buffer.writeDoubleBE(date.getTime(), column.offset);
  },
  [Types.UpdatedAt]: (buffer, column, _value: any) => {
    const date = new Date();
    buffer.writeDoubleBE(date.getTime(), column.offset);
  },
  [Types.Boolean]: (buffer, column, value: boolean) => {
    buffer.writeUInt8(value ? 1 : 0, column.offset);
  },
  [Types.Buffer]: (buffer, column, value: Buffer) => {
    value?.copy(buffer, column.offset, 0, column.size - 1);
  },
  [Types.Coordinates]: (buffer, column, value: Coordinates) => {
    buffer.writeDoubleBE(value.lat, column.offset);
    buffer.writeDoubleBE(value.lng, column.offset + DOUBLE_SIZE);
  },
};

// Read handlers for each column type
const readHandlers: Record<Types, ReadHandler> = {
  [Types.UniqueIdentifier]: (buffer, column): string => {
    return buffer
      .slice(column.offset, column.offset + UNIQUE_IDENTIFIER_SIZE)
      .toString('hex');
  },
  [Types.Text]: (buffer, column): string => {
    const byteLength = buffer.readUInt16BE(column.offset);
    if (byteLength === 0) return '';
    const textBuffer = buffer.slice(
      column.offset + UINT16_SIZE,
      column.offset + UINT16_SIZE + byteLength
    );
    return textBuffer.toString('utf8');
  },
  [Types.Number]: (buffer, column): number => {
    return buffer.readDoubleBE(column.offset);
  },
  [Types.Date]: (buffer, column): Date => {
    const date = buffer.readDoubleBE(column.offset);
    return new Date(date);
  },
  [Types.UpdatedAt]: (buffer, column): Date => {
    const date = buffer.readDoubleBE(column.offset);
    return new Date(date);
  },
  [Types.Boolean]: (buffer, column): boolean => {
    return buffer.readUInt8(column.offset) === 1;
  },
  [Types.Buffer]: (buffer, column): Buffer => {
    return Buffer.from(
      buffer.slice(column.offset, column.offset + column.size - 1)
    );
  },
  [Types.Coordinates]: (buffer, column): Coordinates => {
    const lat = buffer.readDoubleBE(column.offset);
    const lng = buffer.readDoubleBE(column.offset + DOUBLE_SIZE);
    return { lat, lng };
  },
};

/**
 * Write a value to a buffer
 */
export function writeColumn(
  buffer: Buffer,
  bufferSchema: Record<string, BufferSchemaColumn>,
  key: string,
  value: ColumnValue
): void {
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
 */
export function readColumn(
  buffer: Buffer,
  bufferSchema: BufferSchema,
  key: string
): ColumnValue {
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
