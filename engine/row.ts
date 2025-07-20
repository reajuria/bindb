/**
 * Row - Provides row data structure and coordination between specialized components
 */

// Re-export specialized components for backward compatibility
export {
  calculateBufferSchema as parseBufferSchema,
  DEFAULT_TEXT_LENGTH,
  validateBufferSchema,
  getBufferSchemaStats,
  type BufferSchemaStats,
  type SchemaValidation,
  type ColumnSizeInfo,
} from './buffer-schema-calculator.js';

export {
  writeColumn,
  readColumn,
  type BufferSchema,
  type BufferSchemaColumn,
  type Coordinates,
  type ColumnValue,
} from './buffer-utils.js';

export {
  ensureIdField,
  findIdColumn,
  addIdField,
  configureExistingIdField,
  createIdColumnDefinition,
  validateIdField,
  isIdField,
  getIdFieldRequirements,
  type IdFieldResult,
  type IdFieldValidation,
  type IdFieldRequirements,
  type IdFieldConfig,
  type IdFieldConfigOptions,
} from './id-field-manager.js';

export {
  serializeRow as dataRowToBuffer,
  serializeRowWithGenerated as dataRowToBufferWithGenerated,
  deserializeRow as parseDataRow,
  RowStatus,
  createDeletedRowBuffer,
  isDeletedRow,
  isActiveRow,
  getRowStatus,
  validateSerializedRow,
  getSerializationStats,
  type RowData,
  type SerializationResult,
  type RowValidation,
  type SerializationStats,
} from './row-serializer.js';
