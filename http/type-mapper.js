import { Types } from '../engine/column.js';

/**
 * TypeMapper - Handles type mapping between external APIs and BinDB internal types
 */
export class TypeMapper {
  constructor() {
    // Default type mapping from common API types to BinDB types
    this.typeMap = {
      'string': Types.Text,
      'text': Types.Text,
      'varchar': Types.Text,
      'char': Types.Text,
      'number': Types.Number,
      'double': Types.Number,
      'float': Types.Number,
      'int': Types.Number,
      'integer': Types.Number,
      'decimal': Types.Number,
      'boolean': Types.Boolean,
      'bool': Types.Boolean,
      'date': Types.Date,
      'datetime': Types.Date,
      'timestamp': Types.Date,
      'time': Types.Date,
      'coordinates': Types.Coordinates,
      'location': Types.Coordinates,
      'gps': Types.Coordinates,
      'point': Types.Coordinates,
      'buffer': Types.Buffer,
      'binary': Types.Buffer,
      'blob': Types.Buffer,
      'unique_identifier': Types.UniqueIdentifier,
      'uuid': Types.UniqueIdentifier,
      'id': Types.UniqueIdentifier,
      'updated_at': Types.UpdatedAt,
      'modified_at': Types.UpdatedAt
    };
  }

  /**
   * Map external type to BinDB type
   * @param {string} externalType - External type name
   * @returns {string} BinDB type
   */
  mapType(externalType) {
    if (!externalType || typeof externalType !== 'string') {
      return Types.Text; // Default fallback
    }

    const normalizedType = externalType.toLowerCase().trim();
    return this.typeMap[normalizedType] || Types.Text;
  }

  /**
   * Map BinDB type back to external type
   * @param {string} bindbType - BinDB type
   * @returns {string} External type name
   */
  mapTypeReverse(bindbType) {
    const reverseMap = {
      [Types.Text]: 'text',
      [Types.Number]: 'number',
      [Types.Boolean]: 'boolean',
      [Types.Date]: 'date',
      [Types.Coordinates]: 'coordinates',
      [Types.Buffer]: 'buffer',
      [Types.UniqueIdentifier]: 'id',
      [Types.UpdatedAt]: 'updated_at'
    };

    return reverseMap[bindbType] || 'text';
  }

  /**
   * Convert external schema to BinDB schema format
   * @param {Array<object>} externalSchema - External schema definition
   * @returns {Array<object>} BinDB compatible schema
   */
  convertSchema(externalSchema) {
    if (!Array.isArray(externalSchema)) {
      throw new Error('Schema must be an array');
    }

    return externalSchema.map(field => this.convertFieldDefinition(field));
  }

  /**
   * Convert single field definition
   * @param {object} field - External field definition
   * @returns {object} BinDB field definition
   */
  convertFieldDefinition(field) {
    if (!field || typeof field !== 'object') {
      throw new Error('Field definition must be an object');
    }

    if (!field.name) {
      throw new Error('Field definition must have a name');
    }

    return {
      name: field.name,
      type: this.mapType(field.type),
      length: field.length,
      default: field.default,
      nullable: field.nullable !== false, // Default to nullable
      description: field.description
    };
  }

  /**
   * Add custom type mapping
   * @param {string} externalType - External type name
   * @param {string} bindbType - BinDB type to map to
   */
  addTypeMapping(externalType, bindbType) {
    if (!Object.values(Types).includes(bindbType)) {
      throw new Error(`Invalid BinDB type: ${bindbType}`);
    }

    this.typeMap[externalType.toLowerCase().trim()] = bindbType;
  }

  /**
   * Remove custom type mapping
   * @param {string} externalType - External type name to remove
   */
  removeTypeMapping(externalType) {
    delete this.typeMap[externalType.toLowerCase().trim()];
  }

  /**
   * Get all supported type mappings
   * @returns {object} All type mappings
   */
  getTypeMappings() {
    return { ...this.typeMap };
  }

  /**
   * Check if external type is supported
   * @param {string} externalType - External type to check
   * @returns {boolean} True if type is supported
   */
  isTypeSupported(externalType) {
    const normalizedType = externalType?.toLowerCase()?.trim();
    return normalizedType && this.typeMap.hasOwnProperty(normalizedType);
  }

  /**
   * Get type information for an external type
   * @param {string} externalType - External type name
   * @returns {object} Type information
   */
  getTypeInfo(externalType) {
    const bindbType = this.mapType(externalType);
    const isSupported = this.isTypeSupported(externalType);

    return {
      externalType,
      bindbType,
      isSupported,
      isDefaultMapping: !isSupported && bindbType === Types.Text
    };
  }

  /**
   * Validate schema before conversion
   * @param {Array<object>} schema - Schema to validate
   * @returns {object} Validation result
   */
  validateSchema(schema) {
    const errors = [];
    const warnings = [];

    if (!Array.isArray(schema)) {
      errors.push('Schema must be an array');
      return { isValid: false, errors, warnings };
    }

    if (schema.length === 0) {
      warnings.push('Schema is empty');
    }

    const fieldNames = new Set();

    for (let i = 0; i < schema.length; i++) {
      const field = schema[i];

      if (!field || typeof field !== 'object') {
        errors.push(`Field at index ${i} must be an object`);
        continue;
      }

      if (!field.name || typeof field.name !== 'string') {
        errors.push(`Field at index ${i} must have a string name`);
        continue;
      }

      if (fieldNames.has(field.name)) {
        errors.push(`Duplicate field name: ${field.name}`);
      }
      fieldNames.add(field.name);

      if (!this.isTypeSupported(field.type)) {
        warnings.push(`Unknown type '${field.type}' for field '${field.name}', will default to 'text'`);
      }

      if (field.length !== undefined && (typeof field.length !== 'number' || field.length <= 0)) {
        errors.push(`Field '${field.name}' length must be a positive number`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Clear all custom type mappings (reset to defaults)
   */
  resetToDefaults() {
    this.typeMap = {
      'string': Types.Text,
      'text': Types.Text,
      'varchar': Types.Text,
      'char': Types.Text,
      'number': Types.Number,
      'double': Types.Number,
      'float': Types.Number,
      'int': Types.Number,
      'integer': Types.Number,
      'decimal': Types.Number,
      'boolean': Types.Boolean,
      'bool': Types.Boolean,
      'date': Types.Date,
      'datetime': Types.Date,
      'timestamp': Types.Date,
      'time': Types.Date,
      'coordinates': Types.Coordinates,
      'location': Types.Coordinates,
      'gps': Types.Coordinates,
      'point': Types.Coordinates,
      'buffer': Types.Buffer,
      'binary': Types.Buffer,
      'blob': Types.Buffer,
      'unique_identifier': Types.UniqueIdentifier,
      'uuid': Types.UniqueIdentifier,
      'id': Types.UniqueIdentifier,
      'updated_at': Types.UpdatedAt,
      'modified_at': Types.UpdatedAt
    };
  }
}