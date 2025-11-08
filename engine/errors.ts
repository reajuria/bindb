/**
 * Error codes for BinDB operations
 * Categorized by HTTP status code ranges for API consistency
 */
/* eslint-disable no-unused-vars */
export enum ErrorCode {
  // Client errors (4xx)
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  TABLE_NOT_FOUND = 'TABLE_NOT_FOUND',
  DATABASE_NOT_FOUND = 'DATABASE_NOT_FOUND',
  RECORD_NOT_FOUND = 'RECORD_NOT_FOUND',
  DUPLICATE_KEY = 'DUPLICATE_KEY',
  INVALID_SCHEMA = 'INVALID_SCHEMA',
  INVALID_COLUMN_TYPE = 'INVALID_COLUMN_TYPE',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
  INVALID_BUFFER_SIZE = 'INVALID_BUFFER_SIZE',
  INVALID_ID_FORMAT = 'INVALID_ID_FORMAT',

  // Server errors (5xx)
  STORAGE_ERROR = 'STORAGE_ERROR',
  SERIALIZATION_ERROR = 'SERIALIZATION_ERROR',
  DESERIALIZATION_ERROR = 'DESERIALIZATION_ERROR',
  FILE_SYSTEM_ERROR = 'FILE_SYSTEM_ERROR',
  BUFFER_OVERFLOW = 'BUFFER_OVERFLOW',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}
/* eslint-enable no-unused-vars */

/**
 * Base error class for all BinDB errors
 * Extends Error with additional metadata and error codes
 */
export class BinDBError extends Error {
  public readonly timestamp: string;
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly metadata?: Record<string, any>;

  constructor(
    code: ErrorCode,
    message: string,
    statusCode: number = 500,
    metadata?: Record<string, any>
  ) {
    super(message);
    this.name = 'BinDBError';
    this.code = code;
    this.statusCode = statusCode;
    this.metadata = metadata;
    this.timestamp = new Date().toISOString();

    // Maintains proper stack trace for where our error was thrown
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Convert error to JSON format for API responses
   */
  toJSON(): Record<string, any> {
    return {
      error: this.name,
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
      timestamp: this.timestamp,
      ...(this.metadata && { metadata: this.metadata }),
    };
  }

  /**
   * Check if an error is a BinDBError
   */
  static isBinDBError(error: any): error is BinDBError {
    return error instanceof BinDBError;
  }
}

/**
 * Error thrown when a table is not found
 */
export class TableNotFoundError extends BinDBError {
  constructor(database: string, table: string) {
    super(
      ErrorCode.TABLE_NOT_FOUND,
      `Table '${table}' not found in database '${database}'`,
      404,
      { database, table }
    );
    this.name = 'TableNotFoundError';
  }
}

/**
 * Error thrown when a database is not found
 */
export class DatabaseNotFoundError extends BinDBError {
  constructor(database: string) {
    super(
      ErrorCode.DATABASE_NOT_FOUND,
      `Database '${database}' not found`,
      404,
      { database }
    );
    this.name = 'DatabaseNotFoundError';
  }
}

/**
 * Error thrown when a record is not found
 */
export class RecordNotFoundError extends BinDBError {
  constructor(id: string, table?: string, database?: string) {
    super(
      ErrorCode.RECORD_NOT_FOUND,
      `Record with ID '${id}' not found${table ? ` in table '${table}'` : ''}${database ? ` in database '${database}'` : ''}`,
      404,
      { id, table, database }
    );
    this.name = 'RecordNotFoundError';
  }
}

/**
 * Error thrown when validation fails
 */
export class ValidationError extends BinDBError {
  constructor(message: string, field?: string, value?: any) {
    super(ErrorCode.VALIDATION_ERROR, message, 400, { field, value });
    this.name = 'ValidationError';
  }
}

/**
 * Error thrown when a schema is invalid
 */
export class InvalidSchemaError extends BinDBError {
  constructor(message: string, errors?: string[]) {
    super(ErrorCode.INVALID_SCHEMA, message, 400, { errors });
    this.name = 'InvalidSchemaError';
  }
}

/**
 * Error thrown when a column type is invalid
 */
export class InvalidColumnTypeError extends BinDBError {
  constructor(columnName: string, type: string, supportedTypes?: string[]) {
    super(
      ErrorCode.INVALID_COLUMN_TYPE,
      `Invalid column type '${type}' for column '${columnName}'${supportedTypes ? `. Supported types: ${supportedTypes.join(', ')}` : ''}`,
      400,
      { columnName, type, supportedTypes }
    );
    this.name = 'InvalidColumnTypeError';
  }
}

/**
 * Error thrown when a required field is missing
 */
export class MissingRequiredFieldError extends BinDBError {
  constructor(field: string, operation?: string) {
    super(
      ErrorCode.MISSING_REQUIRED_FIELD,
      `Missing required field: ${field}${operation ? ` for operation '${operation}'` : ''}`,
      400,
      { field, operation }
    );
    this.name = 'MissingRequiredFieldError';
  }
}

/**
 * Error thrown when a duplicate key is detected
 */
export class DuplicateKeyError extends BinDBError {
  constructor(key: string, table?: string) {
    super(
      ErrorCode.DUPLICATE_KEY,
      `Duplicate key '${key}'${table ? ` in table '${table}'` : ''}`,
      409,
      { key, table }
    );
    this.name = 'DuplicateKeyError';
  }
}

/**
 * Error thrown when storage operations fail
 */
export class StorageError extends BinDBError {
  constructor(message: string, operation?: string, path?: string) {
    super(ErrorCode.STORAGE_ERROR, message, 500, { operation, path });
    this.name = 'StorageError';
  }
}

/**
 * Error thrown when file system operations fail
 */
export class FileSystemError extends BinDBError {
  constructor(
    message: string,
    path?: string,
    operation?: string,
    originalError?: Error
  ) {
    super(ErrorCode.FILE_SYSTEM_ERROR, message, 500, {
      path,
      operation,
      originalError: originalError?.message,
    });
    this.name = 'FileSystemError';
  }
}

/**
 * Error thrown when serialization fails
 */
export class SerializationError extends BinDBError {
  constructor(message: string, data?: any) {
    super(ErrorCode.SERIALIZATION_ERROR, message, 500, { data });
    this.name = 'SerializationError';
  }
}

/**
 * Error thrown when deserialization fails
 */
export class DeserializationError extends BinDBError {
  constructor(message: string, buffer?: Buffer) {
    super(ErrorCode.DESERIALIZATION_ERROR, message, 500, {
      bufferSize: buffer?.length,
    });
    this.name = 'DeserializationError';
  }
}

/**
 * Error thrown when buffer operations fail
 */
export class BufferError extends BinDBError {
  constructor(message: string, expectedSize?: number, actualSize?: number) {
    super(ErrorCode.BUFFER_OVERFLOW, message, 500, {
      expectedSize,
      actualSize,
    });
    this.name = 'BufferError';
  }
}

/**
 * Error thrown when ID format is invalid
 */
export class InvalidIdFormatError extends BinDBError {
  constructor(id: string, expectedFormat?: string) {
    super(
      ErrorCode.INVALID_ID_FORMAT,
      `Invalid ID format: '${id}'${expectedFormat ? `. Expected format: ${expectedFormat}` : ''}`,
      400,
      { id, expectedFormat }
    );
    this.name = 'InvalidIdFormatError';
  }
}

/**
 * Error thrown when buffer size is invalid
 */
export class InvalidBufferSizeError extends BinDBError {
  constructor(expectedSize: number, actualSize: number, context?: string) {
    super(
      ErrorCode.INVALID_BUFFER_SIZE,
      `Invalid buffer size${context ? ` for ${context}` : ''}: expected ${expectedSize}, got ${actualSize}`,
      400,
      { expectedSize, actualSize, context }
    );
    this.name = 'InvalidBufferSizeError';
  }
}
