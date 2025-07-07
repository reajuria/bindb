import { Types } from './column.js';
import { ensureIdField } from './id-field-manager.js';
import {
  BYTE_SIZE,
  DOUBLE_SIZE,
  ID_FIELD,
  COORDINATES_SIZE,
  UINT16_SIZE,
  UNIQUE_IDENTIFIER_SIZE,
} from './constants.js';

/**
 * BufferSchemaCalculator - Calculates buffer schema and sizes for table columns
 */

export const DEFAULT_TEXT_LENGTH = 32;

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

/**
 * Compute the buffer size and layout for each column in a schema
 * @param {import('./schema.js').Schema} schema - The table schema
 * @returns {{schema: Object, size: number}} Buffer schema with column layout
 */
export function calculateBufferSchema(schema) {
  const { database, table, columns } = schema;
  let position = 1; // Start at position 1 to leave space for row status flag
  const bufferSchema = {};

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

// ID field management is now handled by IdFieldManager

/**
 * Get column size information for a specific column type
 * @param {string} columnType - Column type
 * @param {object} column - Column definition
 * @param {string} database - Database name
 * @param {string} table - Table name
 * @returns {number} Column size in bytes
 */
export function getColumnSize(columnType, column, database = null, table = null) {
  const handler = columnSizeHandlers[columnType];
  if (!handler) {
    throw new Error(`Unknown column type: ${columnType}`);
  }
  
  // Create minimal buffer schema for size calculation
  const tempBufferSchema = {
    [column.name]: {}
  };
  
  return handler(column, tempBufferSchema, database, table);
}

/**
 * Validate buffer schema structure
 * @param {object} bufferSchema - Buffer schema to validate
 * @returns {object} Validation result with isValid and errors
 */
export function validateBufferSchema(bufferSchema) {
  const errors = [];
  
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
    
    if (!Types[columnInfo.type]) {
      errors.push(`Column ${columnName} has invalid type: ${columnInfo.type}`);
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Get buffer schema statistics
 * @param {object} bufferSchema - Buffer schema
 * @returns {object} Schema statistics
 */
export function getBufferSchemaStats(bufferSchema) {
  const columnCount = Object.keys(bufferSchema.schema).length;
  const columnSizes = Object.values(bufferSchema.schema).map(col => col.size);
  
  return {
    totalSize: bufferSchema.size,
    columnCount,
    averageColumnSize: columnCount > 0 ? columnSizes.reduce((a, b) => a + b, 0) / columnCount : 0,
    largestColumnSize: columnCount > 0 ? Math.max(...columnSizes) : 0,
    smallestColumnSize: columnCount > 0 ? Math.min(...columnSizes) : 0,
    overhead: bufferSchema.size - columnSizes.reduce((a, b) => a + b, 0) // Includes status flag and null flags
  };
}