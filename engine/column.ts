/**
 * Column - Defines column types and basic column operations
 */

/**
 * Enum for Column Types
 */
export enum Types {
  UniqueIdentifier = 'UniqueIdentifier',
  Text = 'Text',
  Number = 'Number',
  Boolean = 'Boolean',
  Date = 'Date',
  UpdatedAt = 'UpdatedAt',
  Buffer = 'Buffer',
  Coordinates = 'Coordinates',
}

/**
 * Column type information interface
 */
export interface ColumnTypeInfo {
  name: string;
  description: string;
  fixedSize: boolean;
  defaultLength?: number;
  nullable: boolean;
  requiresLength?: boolean;
}

/**
 * Column definition interface
 */
export interface ColumnDefinition {
  name: string;
  type: Types;
  length?: number;
  nullable?: boolean;
  [key: string]: any;
}

/**
 * Validation result interface
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Validate a column type
 */
export function isValidColumnType(type: string): type is Types {
  return Object.values(Types).includes(type as Types);
}

/**
 * Get column type information
 */
export function getColumnTypeInfo(type: Types): ColumnTypeInfo | null {
  const typeInfo: Record<Types, ColumnTypeInfo> = {
    [Types.UniqueIdentifier]: {
      name: 'UniqueIdentifier',
      description: 'Unique identifier with timestamp and hash',
      fixedSize: true,
      defaultLength: 12,
      nullable: false
    },
    [Types.Text]: {
      name: 'Text',
      description: 'Variable length text string',
      fixedSize: false,
      nullable: true,
      requiresLength: true
    },
    [Types.Number]: {
      name: 'Number',
      description: 'Double precision floating point number',
      fixedSize: true,
      defaultLength: 8,
      nullable: true
    },
    [Types.Boolean]: {
      name: 'Boolean',
      description: 'Boolean true/false value',
      fixedSize: true,
      defaultLength: 1,
      nullable: true
    },
    [Types.Date]: {
      name: 'Date',
      description: 'Date and time value',
      fixedSize: true,
      defaultLength: 8,
      nullable: true
    },
    [Types.UpdatedAt]: {
      name: 'UpdatedAt',
      description: 'Auto-updating timestamp',
      fixedSize: true,
      defaultLength: 8,
      nullable: false
    },
    [Types.Buffer]: {
      name: 'Buffer',
      description: 'Binary data buffer',
      fixedSize: false,
      nullable: true,
      requiresLength: true
    },
    [Types.Coordinates]: {
      name: 'Coordinates',
      description: 'Geographic coordinates (lat, lng)',
      fixedSize: true,
      defaultLength: 16,
      nullable: true
    }
  };

  return typeInfo[type] || null;
}

/**
 * Validate column definition
 */
export function validateColumnDefinition(column: Partial<ColumnDefinition>): ValidationResult {
  const errors: string[] = [];
  
  if (!column.name || typeof column.name !== 'string') {
    errors.push('Column name is required and must be a string');
  }
  
  if (!column.type || !isValidColumnType(column.type)) {
    errors.push(`Invalid column type: ${column.type}`);
  } else {
    const typeInfo = getColumnTypeInfo(column.type);
    
    if (typeInfo?.requiresLength && (!column.length || column.length <= 0)) {
      errors.push(`Column type ${column.type} requires a positive length`);
    }
    
    if (typeInfo?.fixedSize && column.length && column.length !== typeInfo.defaultLength) {
      errors.push(`Column type ${column.type} has fixed size of ${typeInfo.defaultLength}`);
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Create a standard column definition
 */
export function createColumnDefinition(
  name: string, 
  type: Types, 
  options: Partial<ColumnDefinition> = {}
): ColumnDefinition {
  const typeInfo = getColumnTypeInfo(type);
  if (!typeInfo) {
    throw new Error(`Invalid column type: ${type}`);
  }
  
  const column: ColumnDefinition = {
    name,
    type,
    ...options
  };
  
  // Set default length for fixed-size types
  if (typeInfo.fixedSize && !column.length && typeInfo.defaultLength !== undefined) {
    column.length = typeInfo.defaultLength;
  }
  
  // Validate the column definition
  const validation = validateColumnDefinition(column);
  if (!validation.isValid) {
    throw new Error(`Invalid column definition: ${validation.errors.join(', ')}`);
  }
  
  return column;
}