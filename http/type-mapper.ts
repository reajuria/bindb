import { Types } from '../engine/column.js';

/**
 * External schema field definition
 */
export interface ExternalSchemaField {
  name: string;
  type: string;
  length?: number;
  default?: any;
  nullable?: boolean;
  description?: string;
  [key: string]: any;
}

/**
 * External schema type
 */
export type ExternalSchema = ExternalSchemaField[];

/**
 * BinDB schema field definition
 */
export interface BinDBSchemaField {
  name: string;
  type: string;
  length?: number;
  default?: any;
  nullable: boolean;
  description?: string;
}

/**
 * Schema validation result
 */
export interface SchemaValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Type mapping information
 */
export interface TypeInfo {
  externalType: string;
  bindbType: string;
  isSupported: boolean;
  isDefaultMapping: boolean;
}

/**
 * Type mappings from external to BinDB types
 */
export type TypeMappings = Record<string, string>;

/**
 * TypeMapper - Handles type mapping between external APIs and BinDB internal types
 */
export class TypeMapper {
  private typeMap: TypeMappings;

  constructor() {
    // Default type mapping from common API types to BinDB types
    this.typeMap = {
      string: Types.Text,
      text: Types.Text,
      varchar: Types.Text,
      char: Types.Text,
      number: Types.Number,
      double: Types.Number,
      float: Types.Number,
      int: Types.Number,
      integer: Types.Number,
      decimal: Types.Number,
      boolean: Types.Boolean,
      bool: Types.Boolean,
      date: Types.Date,
      datetime: Types.Date,
      timestamp: Types.Date,
      time: Types.Date,
      coordinates: Types.Coordinates,
      location: Types.Coordinates,
      gps: Types.Coordinates,
      point: Types.Coordinates,
      buffer: Types.Buffer,
      binary: Types.Buffer,
      blob: Types.Buffer,
      unique_identifier: Types.UniqueIdentifier,
      uuid: Types.UniqueIdentifier,
      id: Types.UniqueIdentifier,
      updated_at: Types.UpdatedAt,
      modified_at: Types.UpdatedAt,
    };
  }

  /**
   * Map external type to BinDB type
   */
  mapType(externalType: string): string {
    if (!externalType || typeof externalType !== 'string') {
      return Types.Text; // Default fallback
    }

    const normalizedType = externalType.toLowerCase().trim();
    return this.typeMap[normalizedType] || Types.Text;
  }

  /**
   * Map BinDB type back to external type
   */
  mapTypeReverse(bindbType: string): string {
    const reverseMap: Record<string, string> = {
      [Types.Text]: 'text',
      [Types.Number]: 'number',
      [Types.Boolean]: 'boolean',
      [Types.Date]: 'date',
      [Types.Coordinates]: 'coordinates',
      [Types.Buffer]: 'buffer',
      [Types.UniqueIdentifier]: 'id',
      [Types.UpdatedAt]: 'updated_at',
    };

    return reverseMap[bindbType] || 'text';
  }

  /**
   * Convert external schema to BinDB schema format
   */
  convertSchema(externalSchema: ExternalSchema): BinDBSchemaField[] {
    if (!Array.isArray(externalSchema)) {
      throw new Error('Schema must be an array');
    }

    return externalSchema.map(field => this.convertFieldDefinition(field));
  }

  /**
   * Convert single field definition
   */
  convertFieldDefinition(field: ExternalSchemaField): BinDBSchemaField {
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
      description: field.description,
    } as BinDBSchemaField;
  }

  /**
   * Add custom type mapping
   */
  addTypeMapping(externalType: string, bindbType: string): void {
    if (!Object.values(Types).includes(bindbType as any)) {
      throw new Error(`Invalid BinDB type: ${bindbType}`);
    }

    this.typeMap[externalType.toLowerCase().trim()] = bindbType;
  }

  /**
   * Remove custom type mapping
   */
  removeTypeMapping(externalType: string): void {
    delete this.typeMap[externalType.toLowerCase().trim()];
  }

  /**
   * Get all supported type mappings
   */
  getTypeMappings(): TypeMappings {
    return { ...this.typeMap };
  }

  /**
   * Check if external type is supported
   */
  isTypeSupported(externalType: string): boolean {
    const normalizedType = externalType?.toLowerCase()?.trim();
    return normalizedType
      ? Object.prototype.hasOwnProperty.call(this.typeMap, normalizedType)
      : false;
  }

  /**
   * Get type information for an external type
   */
  getTypeInfo(externalType: string): TypeInfo {
    const bindbType = this.mapType(externalType);
    const isSupported = this.isTypeSupported(externalType);

    return {
      externalType,
      bindbType,
      isSupported,
      isDefaultMapping: !isSupported && bindbType === Types.Text,
    };
  }

  /**
   * Validate schema before conversion
   */
  validateSchema(schema: ExternalSchema): SchemaValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!Array.isArray(schema)) {
      errors.push('Schema must be an array');
      return { isValid: false, errors, warnings };
    }

    if (schema.length === 0) {
      warnings.push('Schema is empty');
    }

    const fieldNames = new Set<string>();

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
        warnings.push(
          `Unknown type '${field.type}' for field '${field.name}', will default to 'text'`
        );
      }

      if (
        field.length !== undefined &&
        (typeof field.length !== 'number' || field.length <= 0)
      ) {
        errors.push(`Field '${field.name}' length must be a positive number`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Get supported external types
   */
  getSupportedTypes(): string[] {
    return Object.keys(this.typeMap);
  }

  /**
   * Get supported BinDB types
   */
  getSupportedBinDBTypes(): string[] {
    return Array.from(new Set(Object.values(this.typeMap)));
  }

  /**
   * Validate individual field
   */
  validateField(field: ExternalSchemaField): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!field || typeof field !== 'object') {
      errors.push('Field must be an object');
      return { isValid: false, errors };
    }

    if (!field.name || typeof field.name !== 'string') {
      errors.push('Field must have a string name');
    }

    if (
      field.length !== undefined &&
      (typeof field.length !== 'number' || field.length <= 0)
    ) {
      errors.push('Field length must be a positive number');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Clear all custom type mappings (reset to defaults)
   */
  resetToDefaults(): void {
    this.typeMap = {
      string: Types.Text,
      text: Types.Text,
      varchar: Types.Text,
      char: Types.Text,
      number: Types.Number,
      double: Types.Number,
      float: Types.Number,
      int: Types.Number,
      integer: Types.Number,
      decimal: Types.Number,
      boolean: Types.Boolean,
      bool: Types.Boolean,
      date: Types.Date,
      datetime: Types.Date,
      timestamp: Types.Date,
      time: Types.Date,
      coordinates: Types.Coordinates,
      location: Types.Coordinates,
      gps: Types.Coordinates,
      point: Types.Coordinates,
      buffer: Types.Buffer,
      binary: Types.Buffer,
      blob: Types.Buffer,
      unique_identifier: Types.UniqueIdentifier,
      uuid: Types.UniqueIdentifier,
      id: Types.UniqueIdentifier,
      updated_at: Types.UpdatedAt,
      modified_at: Types.UpdatedAt,
    };
  }

  /**
   * Get type mapping statistics
   */
  getStats(): {
    totalMappings: number;
    externalTypes: number;
    bindbTypes: number;
    customMappings: number;
  } {
    const defaultMappingsCount = 29; // Number of default mappings
    const bindbTypes = new Set(Object.values(this.typeMap));

    return {
      totalMappings: Object.keys(this.typeMap).length,
      externalTypes: Object.keys(this.typeMap).length,
      bindbTypes: bindbTypes.size,
      customMappings: Math.max(
        0,
        Object.keys(this.typeMap).length - defaultMappingsCount
      ),
    };
  }
}
