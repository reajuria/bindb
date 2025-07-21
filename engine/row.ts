/**
 * Row - Provides row data structure and coordination between specialized components
 */

// Re-export specialized components for backward compatibility
export {
  DEFAULT_TEXT_LENGTH,
  getBufferSchemaStats,
  calculateBufferSchema as parseBufferSchema,
  validateBufferSchema,
  type BufferSchemaStats,
  type ColumnSizeInfo,
  type SchemaValidation,
} from './buffer-schema-calculator';

export {
  readColumn,
  writeColumn,
  type BufferSchema,
  type BufferSchemaColumn,
  type ColumnValue,
  type Coordinates,
} from './buffer-utils';

export {
  addIdField,
  configureExistingIdField,
  createIdColumnDefinition,
  ensureIdField,
  findIdColumn,
  getIdFieldRequirements,
  isIdField,
  validateIdField,
  type IdFieldConfig,
  type IdFieldConfigOptions,
  type IdFieldRequirements,
  type IdFieldResult,
  type IdFieldValidation,
} from './id-field-manager';

export {
  RowStatus,
  createDeletedRowBuffer,
  serializeRow as dataRowToBuffer,
  serializeRowWithGenerated as dataRowToBufferWithGenerated,
  getRowStatus,
  getSerializationStats,
  isActiveRow,
  isDeletedRow,
  deserializeRow as parseDataRow,
  validateSerializedRow,
  type RowData,
  type RowValidation,
  type SerializationResult,
  type SerializationStats,
} from './row-serializer';
