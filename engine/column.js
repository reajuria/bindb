/**
 * Column - Defines column types and basic column operations
 */

/**
 * Enum for Column Types
 * @readonly
 * @enum {string}
 */
export const Types = Object.freeze({
  UniqueIdentifier: 'UniqueIdentifier',
  Text: 'Text',
  Number: 'Number',
  Boolean: 'Boolean',
  Date: 'Date',
  UpdatedAt: 'UpdatedAt',
  Buffer: 'Buffer',
  Coordinates: 'Coordinates',
});

/**
 * Validate a column type
 * @param {string} type - Column type to validate
 * @returns {boolean} True if valid column type
 */
export function isValidColumnType(type) {
  return Object.values(Types).includes(type);
}

/**
 * Get column type information
 * @param {string} type - Column type
 * @returns {object} Column type metadata
 */
export function getColumnTypeInfo(type) {
  const typeInfo = {
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
 * @param {object} column - Column definition
 * @returns {object} Validation result with isValid and errors
 */
export function validateColumnDefinition(column) {
  const errors = [];
  
  if (!column.name || typeof column.name !== 'string') {
    errors.push('Column name is required and must be a string');
  }
  
  if (!column.type || !isValidColumnType(column.type)) {
    errors.push(`Invalid column type: ${column.type}`);
  } else {
    const typeInfo = getColumnTypeInfo(column.type);
    
    if (typeInfo.requiresLength && (!column.length || column.length <= 0)) {
      errors.push(`Column type ${column.type} requires a positive length`);
    }
    
    if (typeInfo.fixedSize && column.length && column.length !== typeInfo.defaultLength) {
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
 * @param {string} name - Column name
 * @param {string} type - Column type
 * @param {object} options - Additional options
 * @returns {object} Column definition
 */
export function createColumnDefinition(name, type, options = {}) {
  const typeInfo = getColumnTypeInfo(type);
  if (!typeInfo) {
    throw new Error(`Invalid column type: ${type}`);
  }
  
  const column = {
    name,
    type,
    ...options
  };
  
  // Set default length for fixed-size types
  if (typeInfo.fixedSize && !column.length) {
    column.length = typeInfo.defaultLength;
  }
  
  // Validate the column definition
  const validation = validateColumnDefinition(column);
  if (!validation.isValid) {
    throw new Error(`Invalid column definition: ${validation.errors.join(', ')}`);
  }
  
  return column;
}