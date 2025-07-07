import { Types } from './column.js';
import { createSchemaIdGenerator } from './id-generator.js';
import { ID_FIELD } from './constants.js';

/**
 * IdFieldManager - Handles ID field injection and management in schemas
 */

/**
 * Ensure a schema has a properly configured ID field
 * @param {Array} columns - Schema columns array (will be modified)
 * @param {import('./schema.js').Schema} schema - Schema instance for ID generator
 * @returns {object} Information about ID field configuration
 */
export function ensureIdField(columns, schema) {
  const existingIdColumn = findIdColumn(columns);
  
  if (!existingIdColumn) {
    return addIdField(columns, schema);
  } else {
    return configureExistingIdField(existingIdColumn, schema);
  }
}

/**
 * Find the ID column in a columns array
 * @param {Array} columns - Schema columns array
 * @returns {object|null} ID column definition or null if not found
 */
export function findIdColumn(columns) {
  return columns.find(column => column.name === ID_FIELD) || null;
}

/**
 * Add a new ID field to the beginning of columns array
 * @param {Array} columns - Schema columns array (will be modified)
 * @param {import('./schema.js').Schema} schema - Schema instance for ID generator
 * @returns {object} Information about the added ID field
 */
export function addIdField(columns, schema) {
  const idColumn = createIdColumnDefinition(schema);
  columns.unshift(idColumn);
  
  return {
    action: 'added',
    column: idColumn,
    position: 0
  };
}

/**
 * Configure an existing ID field with proper default generator
 * @param {object} idColumn - Existing ID column definition
 * @param {import('./schema.js').Schema} schema - Schema instance for ID generator
 * @returns {object} Information about the configuration
 */
export function configureExistingIdField(idColumn, schema) {
  const hadDefault = !!idColumn.default;
  
  if (!idColumn.default) {
    idColumn.default = createSchemaIdGenerator(schema);
  }
  
  return {
    action: hadDefault ? 'already_configured' : 'configured',
    column: idColumn,
    hadPreviousDefault: hadDefault
  };
}

/**
 * Create a standard ID column definition
 * @param {import('./schema.js').Schema} schema - Schema instance for ID generator
 * @returns {object} ID column definition
 */
export function createIdColumnDefinition(schema) {
  return {
    name: ID_FIELD,
    type: Types.UniqueIdentifier,
    default: createSchemaIdGenerator(schema),
    nullable: false,
    description: 'Auto-generated unique identifier'
  };
}

/**
 * Validate ID field configuration
 * @param {object} idColumn - ID column definition to validate
 * @returns {object} Validation result with isValid and errors
 */
export function validateIdField(idColumn) {
  const errors = [];
  
  if (!idColumn) {
    errors.push('ID column is required');
    return { isValid: false, errors };
  }
  
  if (idColumn.name !== ID_FIELD) {
    errors.push(`ID column must be named '${ID_FIELD}'`);
  }
  
  if (idColumn.type !== Types.UniqueIdentifier) {
    errors.push(`ID column must be of type '${Types.UniqueIdentifier}'`);
  }
  
  if (!idColumn.default || typeof idColumn.default !== 'function') {
    errors.push('ID column must have a default value generator function');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Check if a column definition is an ID field
 * @param {object} column - Column definition to check
 * @returns {boolean} True if column is an ID field
 */
export function isIdField(column) {
  return column && column.name === ID_FIELD;
}

/**
 * Get ID field requirements for documentation/validation
 * @returns {object} ID field requirements
 */
export function getIdFieldRequirements() {
  return {
    name: ID_FIELD,
    type: Types.UniqueIdentifier,
    nullable: false,
    hasDefault: true,
    defaultType: 'function',
    description: 'Unique identifier automatically generated for each record',
    position: 'first',
    size: 12, // bytes
    format: 'hex string'
  };
}

/**
 * Create ID field configuration options
 * @param {object} options - Configuration options
 * @returns {object} ID field configuration
 */
export function createIdFieldConfig(options = {}) {
  const {
    customGenerator = null,
    nullable = false,
    description = 'Auto-generated unique identifier'
  } = options;
  
  return {
    name: ID_FIELD,
    type: Types.UniqueIdentifier,
    nullable,
    description,
    customGenerator
  };
}

/**
 * Apply ID field configuration to a schema
 * @param {Array} columns - Schema columns array
 * @param {import('./schema.js').Schema} schema - Schema instance
 * @param {object} config - ID field configuration
 * @returns {object} Application result
 */
export function applyIdFieldConfig(columns, schema, config) {
  const existingId = findIdColumn(columns);
  
  if (existingId) {
    // Update existing ID field
    Object.assign(existingId, {
      nullable: config.nullable,
      description: config.description,
      default: config.customGenerator || createSchemaIdGenerator(schema)
    });
    
    return {
      action: 'updated',
      column: existingId
    };
  } else {
    // Add new ID field
    const idColumn = {
      ...createIdColumnDefinition(schema),
      nullable: config.nullable,
      description: config.description,
      default: config.customGenerator || createSchemaIdGenerator(schema)
    };
    
    columns.unshift(idColumn);
    
    return {
      action: 'added',
      column: idColumn
    };
  }
}