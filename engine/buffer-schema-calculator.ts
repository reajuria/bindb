import type { BufferSchema, BufferSchemaColumn } from './buffer-utils';
import { Types, type ColumnDefinition } from './column';
import {
  BYTE_SIZE,
  COORDINATES_SIZE,
  DOUBLE_SIZE,
  ID_FIELD,
  UINT16_SIZE,
  UNIQUE_IDENTIFIER_SIZE,
} from './constants';
import { ensureIdField } from './id-field-manager';
import type { Schema } from './schema';

/**
 * BufferSchemaCalculator - Calculates buffer schema and sizes for table columns
 */

export const DEFAULT_TEXT_LENGTH = 32;

/**
 * Column size calculation result
 */
export interface ColumnSizeInfo {
  size: number;
  metadata?: Record<string, any>;
}

/**
 * Buffer schema statistics
 */
export interface BufferSchemaStats {
  totalSize: number;
  columnCount: number;
  averageColumnSize: number;
  largestColumnSize: number;
  smallestColumnSize: number;
  overhead: number;
}

/**
 * Schema validation result
 */
export interface SchemaValidation {
  isValid: boolean;
  errors: string[];
}

/**
 * Column size handler function type
 */
type ColumnSizeHandler = (
  column: ColumnDefinition,
  bufferSchema: Record<string, BufferSchemaColumn>,
  database?: string,
  table?: string
) => number;

// Column size handlers for each type
const columnSizeHandlers: Record<Types, ColumnSizeHandler> = {
  [Types.UniqueIdentifier]: (_column, _bufferSchema, _database, _table) => {
    return UNIQUE_IDENTIFIER_SIZE;
  },
  [Types.Text]: column =>
    UINT16_SIZE + (column.length ?? DEFAULT_TEXT_LENGTH) * 4,
  [Types.Number]: () => DOUBLE_SIZE,
  [Types.Date]: () => DOUBLE_SIZE,
  [Types.UpdatedAt]: () => DOUBLE_SIZE,
  [Types.Boolean]: () => BYTE_SIZE,
  [Types.Buffer]: column => column.length || 0,
  [Types.Coordinates]: () => COORDINATES_SIZE,
};

/**
 * Compute the buffer size and layout for each column in a schema
 */
export function calculateBufferSchema(schema: Schema): BufferSchema {
  const { database: _database, table: _table, columns } = schema;
  let position = 1; // Start at position 1 to leave space for row status flag
  const bufferSchema: Record<string, BufferSchemaColumn> = {};

  if (columns.length === 0) {
    throw new Error('No columns defined for the schema');
  }

  // Ensure ID field exists and has proper default generator
  ensureIdField(columns, schema);

  // Calculate buffer layout for each column
  for (const column of columns) {
    const offset = position;
    bufferSchema[column.name] = {
      type: column.type,
      offset,
      size: 0, // Will be set below
      nullFlag: 0, // Will be set below
      default: column.default,
    };

    const handler = columnSizeHandlers[column.type];
    if (!handler) {
      throw new Error(`Unknown column type: ${column.type}`);
    }

    position += handler(column, bufferSchema, _database, _table);

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
 * Validate buffer schema structure
 */
export function validateBufferSchema(
  bufferSchema: BufferSchema
): SchemaValidation {
  const errors: string[] = [];

  if (!bufferSchema.schema || !bufferSchema.size) {
    errors.push('Buffer schema must have schema and size properties');
    return { isValid: false, errors };
  }

  if (typeof bufferSchema.size !== 'number' || bufferSchema.size <= 0) {
    errors.push('Buffer schema size must be a positive number');
  }

  // Check if ID field exists
  if (!bufferSchema.schema[ID_FIELD]) {
    errors.push(`Buffer schema must include ${ID_FIELD} field`);
  }

  // Validate each column in schema
  for (const [columnName, columnInfo] of Object.entries(bufferSchema.schema)) {
    if (typeof columnInfo.offset !== 'number' || columnInfo.offset < 0) {
      errors.push(`Column ${columnName} must have valid offset`);
    }

    if (typeof columnInfo.size !== 'number' || columnInfo.size <= 0) {
      errors.push(`Column ${columnName} must have positive size`);
    }

    if (!Object.values(Types).includes(columnInfo.type)) {
      errors.push(`Column ${columnName} has invalid type: ${columnInfo.type}`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Get buffer schema statistics
 */
export function getBufferSchemaStats(
  bufferSchema: BufferSchema
): BufferSchemaStats {
  const columnCount = Object.keys(bufferSchema.schema).length;
  const columnSizes = Object.values(bufferSchema.schema).map(col => col.size);

  return {
    totalSize: bufferSchema.size,
    columnCount,
    averageColumnSize:
      columnCount > 0
        ? columnSizes.reduce((a, b) => a + b, 0) / columnCount
        : 0,
    largestColumnSize: columnCount > 0 ? Math.max(...columnSizes) : 0,
    smallestColumnSize: columnCount > 0 ? Math.min(...columnSizes) : 0,
    overhead: bufferSchema.size - columnSizes.reduce((a, b) => a + b, 0), // Includes status flag and null flags
  };
}
