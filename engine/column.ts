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
 * Validate a column type
 */
function isValidColumnType(type: string): type is Types {
  return Object.values(Types).includes(type as Types);
}

/**
 * Get column type information
 */
function getColumnTypeInfo(type: Types): any {
  const typeInfo: Record<Types, any> = {
    [Types.UniqueIdentifier]: {
      name: 'UniqueIdentifier',
      description: 'Unique identifier with timestamp and hash',
      fixedSize: true,
      defaultLength: 12,
      nullable: false,
    },
    [Types.Text]: {
      name: 'Text',
      description: 'Variable length text string',
      fixedSize: false,
      nullable: true,
      requiresLength: true,
    },
    [Types.Number]: {
      name: 'Number',
      description: 'Double precision floating point number',
      fixedSize: true,
      defaultLength: 8,
      nullable: true,
    },
    [Types.Boolean]: {
      name: 'Boolean',
      description: 'Boolean true/false value',
      fixedSize: true,
      defaultLength: 1,
      nullable: true,
    },
    [Types.Date]: {
      name: 'Date',
      description: 'Date and time value',
      fixedSize: true,
      defaultLength: 8,
      nullable: true,
    },
    [Types.UpdatedAt]: {
      name: 'UpdatedAt',
      description: 'Auto-updating timestamp',
      fixedSize: true,
      defaultLength: 8,
      nullable: false,
    },
    [Types.Buffer]: {
      name: 'Buffer',
      description: 'Binary data buffer',
      fixedSize: false,
      nullable: true,
      requiresLength: true,
    },
    [Types.Coordinates]: {
      name: 'Coordinates',
      description: 'Geographic coordinates (lat, lng)',
      fixedSize: true,
      defaultLength: 16,
      nullable: true,
    },
  };

  return typeInfo[type] || null;
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
    ...options,
  };

  // Set default length for fixed-size types
  if (
    typeInfo.fixedSize &&
    !column.length &&
    typeInfo.defaultLength !== undefined
  ) {
    column.length = typeInfo.defaultLength;
  }

  // Basic validation
  if (!column.name || typeof column.name !== 'string') {
    throw new Error('Column name is required and must be a string');
  }

  if (!column.type || !isValidColumnType(column.type)) {
    throw new Error(`Invalid column type: ${column.type}`);
  }

  return column;
}
