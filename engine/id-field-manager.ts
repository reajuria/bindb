import { Types, type ColumnDefinition } from './column.js';
import { ID_FIELD } from './constants.js';
import {
  createSchemaIdGenerator,
  type SchemaIdGenerator,
} from './id-generator.js';
import type { Schema } from './schema.js';

/**
 * IdFieldManager - Handles ID field injection and management in schemas
 */

/**
 * ID field configuration result
 */
export interface IdFieldResult {
  action: 'added' | 'configured' | 'already_configured' | 'updated';
  column: ColumnDefinition;
  position?: number;
  hadPreviousDefault?: boolean;
}

/**
 * ID field validation result
 */
export interface IdFieldValidation {
  isValid: boolean;
  errors: string[];
}

/**
 * ID field requirements
 */
export interface IdFieldRequirements {
  name: string;
  type: Types;
  nullable: boolean;
  hasDefault: boolean;
  defaultType: string;
  description: string;
  position: string;
  size: number;
  format: string;
}

/**
 * ID field configuration options
 */
export interface IdFieldConfigOptions {
  customGenerator?: SchemaIdGenerator | null;
  nullable?: boolean;
  description?: string;
}

/**
 * ID field configuration
 */
export interface IdFieldConfig {
  name: string;
  type: Types;
  nullable: boolean;
  description: string;
  customGenerator?: SchemaIdGenerator | null;
}

/**
 * Ensure a schema has a properly configured ID field
 */
export function ensureIdField(
  columns: ColumnDefinition[],
  schema: Schema
): IdFieldResult {
  const existingIdColumn = findIdColumn(columns);

  if (!existingIdColumn) {
    return addIdField(columns, schema);
  } else {
    return configureExistingIdField(existingIdColumn, schema);
  }
}

/**
 * Find the ID column in a columns array
 */
export function findIdColumn(
  columns: ColumnDefinition[]
): ColumnDefinition | null {
  return columns.find(column => column.name === ID_FIELD) || null;
}

/**
 * Add a new ID field to the beginning of columns array
 */
export function addIdField(
  columns: ColumnDefinition[],
  schema: Schema
): IdFieldResult {
  const idColumn = createIdColumnDefinition(schema);
  columns.unshift(idColumn);

  return {
    action: 'added',
    column: idColumn,
    position: 0,
  };
}

/**
 * Configure an existing ID field with proper default generator
 */
export function configureExistingIdField(
  idColumn: ColumnDefinition,
  schema: Schema
): IdFieldResult {
  const hadDefault = !!idColumn.default;

  if (!idColumn.default) {
    idColumn.default = createSchemaIdGenerator(schema);
  }

  return {
    action: hadDefault ? 'already_configured' : 'configured',
    column: idColumn,
    hadPreviousDefault: hadDefault,
  };
}

/**
 * Create a standard ID column definition
 */
export function createIdColumnDefinition(schema: Schema): ColumnDefinition {
  return {
    name: ID_FIELD,
    type: Types.UniqueIdentifier,
    default: createSchemaIdGenerator(schema),
    nullable: false,
    description: 'Auto-generated unique identifier',
  };
}

/**
 * Validate ID field configuration
 */
export function validateIdField(
  idColumn: ColumnDefinition | null
): IdFieldValidation {
  const errors: string[] = [];

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
    errors,
  };
}

/**
 * Check if a column definition is an ID field
 */
export function isIdField(column: ColumnDefinition | null): boolean {
  return !!(column && column.name === ID_FIELD);
}

/**
 * Get ID field requirements for documentation/validation
 */
export function getIdFieldRequirements(): IdFieldRequirements {
  return {
    name: ID_FIELD,
    type: Types.UniqueIdentifier,
    nullable: false,
    hasDefault: true,
    defaultType: 'function',
    description: 'Unique identifier automatically generated for each record',
    position: 'first',
    size: 12, // bytes
    format: 'hex string',
  };
}

/**
 * Create ID field configuration options
 */
export function createIdFieldConfig(
  options: IdFieldConfigOptions = {}
): IdFieldConfig {
  const {
    customGenerator = null,
    nullable = false,
    description = 'Auto-generated unique identifier',
  } = options;

  return {
    name: ID_FIELD,
    type: Types.UniqueIdentifier,
    nullable,
    description,
    customGenerator,
  };
}

/**
 * Apply ID field configuration to a schema
 */
export function applyIdFieldConfig(
  columns: ColumnDefinition[],
  schema: Schema,
  config: IdFieldConfig
): IdFieldResult {
  const existingId = findIdColumn(columns);

  if (existingId) {
    // Update existing ID field
    Object.assign(existingId, {
      nullable: config.nullable,
      description: config.description,
      default: config.customGenerator || createSchemaIdGenerator(schema),
    });

    return {
      action: 'updated',
      column: existingId,
    };
  } else {
    // Add new ID field
    const idColumn: ColumnDefinition = {
      ...createIdColumnDefinition(schema),
      nullable: config.nullable,
      description: config.description,
      default: config.customGenerator || createSchemaIdGenerator(schema),
    };

    columns.unshift(idColumn);

    return {
      action: 'added',
      column: idColumn,
    };
  }
}
