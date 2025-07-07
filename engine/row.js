/**
 * Row - Provides row data structure and coordination between specialized components
 */

// Re-export specialized components for backward compatibility
export { 
  calculateBufferSchema as parseBufferSchema,
  DEFAULT_TEXT_LENGTH,
  validateBufferSchema,
  getBufferSchemaStats
} from './buffer-schema-calculator.js';

export {
  serializeRow as dataRowToBuffer,
  serializeRowWithGenerated as dataRowToBufferWithGenerated,
  deserializeRow as parseDataRow,
  RowStatus,
  createDeletedRowBuffer,
  isDeletedRow,
  isActiveRow,
  getRowStatus,
  validateSerializedRow
} from './row-serializer.js';

export {
  ensureIdField,
  findIdColumn,
  addIdField,
  configureExistingIdField,
  createIdColumnDefinition,
  validateIdField,
  isIdField,
  getIdFieldRequirements
} from './id-field-manager.js';