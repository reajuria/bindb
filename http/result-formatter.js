/**
 * ResultFormatter - Handles formatting of database operation results for API responses
 */
export class ResultFormatter {
  constructor(options = {}) {
    this.config = {
      includeMetadata: options.includeMetadata !== false,
      includeTiming: options.includeTiming !== false,
      includeStats: options.includeStats !== false,
      dateFormat: options.dateFormat || 'iso', // 'iso', 'timestamp', 'unix'
      ...options
    };
  }

  /**
   * Format insert operation result
   * @param {object} result - Insert result from database
   * @param {object} metadata - Operation metadata
   * @returns {object} Formatted insert response
   */
  formatInsertResult(result, metadata = {}) {
    const response = {
      insertedId: result.id,
      record: this.formatRecord(result)
    };

    if (this.config.includeMetadata) {
      response.metadata = {
        operation: 'insert',
        table: metadata.table,
        database: metadata.database,
        ...this.getTimingInfo(metadata)
      };
    }

    return response;
  }

  /**
   * Format bulk insert operation result
   * @param {Array} results - Bulk insert results from database
   * @param {object} metadata - Operation metadata
   * @returns {object} Formatted bulk insert response
   */
  formatBulkInsertResult(results, metadata = {}) {
    const insertedIds = results.map(record => record.id);
    
    const response = {
      insertedCount: results.length,
      insertedIds,
      records: results.map(record => this.formatRecord(record))
    };

    if (this.config.includeMetadata) {
      response.metadata = {
        operation: 'bulkInsert',
        table: metadata.table,
        database: metadata.database,
        batchInfo: metadata.batchInfo,
        ...this.getTimingInfo(metadata)
      };
    }

    return response;
  }

  /**
   * Format get operation result
   * @param {object|null} result - Get result from database
   * @param {object} metadata - Operation metadata
   * @returns {object} Formatted get response
   */
  formatGetResult(result, metadata = {}) {
    const response = {
      record: result ? this.formatRecord(result) : null,
      found: !!result
    };

    if (this.config.includeMetadata) {
      response.metadata = {
        operation: 'get',
        table: metadata.table,
        database: metadata.database,
        id: metadata.id,
        ...this.getTimingInfo(metadata)
      };
    }

    return response;
  }

  /**
   * Format update operation result
   * @param {object} result - Update result from database
   * @param {object} metadata - Operation metadata
   * @returns {object} Formatted update response
   */
  formatUpdateResult(result, metadata = {}) {
    const response = {
      matchedCount: result.matchedCount || 0,
      modifiedCount: result.modifiedCount || 0,
      record: result.record ? this.formatRecord(result.record) : null
    };

    if (this.config.includeMetadata) {
      response.metadata = {
        operation: 'update',
        table: metadata.table,
        database: metadata.database,
        id: metadata.id,
        fieldsUpdated: metadata.fieldsUpdated,
        ...this.getTimingInfo(metadata)
      };
    }

    return response;
  }

  /**
   * Format delete operation result
   * @param {object} result - Delete result from database
   * @param {object} metadata - Operation metadata
   * @returns {object} Formatted delete response
   */
  formatDeleteResult(result, metadata = {}) {
    const response = {
      deletedCount: result.deletedCount || 0,
      acknowledged: true
    };

    if (this.config.includeMetadata) {
      response.metadata = {
        operation: 'delete',
        table: metadata.table,
        database: metadata.database,
        id: metadata.id,
        ...this.getTimingInfo(metadata)
      };
    }

    return response;
  }

  /**
   * Format count operation result
   * @param {number} count - Count result from database
   * @param {object} metadata - Operation metadata
   * @returns {object} Formatted count response
   */
  formatCountResult(count, metadata = {}) {
    const response = {
      count: count || 0
    };

    if (this.config.includeMetadata) {
      response.metadata = {
        operation: 'count',
        table: metadata.table,
        database: metadata.database,
        ...this.getTimingInfo(metadata)
      };
    }

    return response;
  }

  /**
   * Format table creation result
   * @param {object} result - Table creation result
   * @param {object} metadata - Operation metadata
   * @returns {object} Formatted table creation response
   */
  formatCreateTableResult(result, metadata = {}) {
    const response = {
      table: {
        database: result.database,
        table: result.table,
        schema: result.schema
      },
      created: true
    };

    if (this.config.includeMetadata) {
      response.metadata = {
        operation: 'createTable',
        columnsCount: result.schema?.length || 0,
        ...this.getTimingInfo(metadata)
      };
    }

    return response;
  }

  /**
   * Format a single record
   * @param {object} record - Database record
   * @returns {object} Formatted record
   */
  formatRecord(record) {
    if (!record || typeof record !== 'object') {
      return record;
    }

    const formatted = { ...record };

    // Format dates according to configuration
    for (const [key, value] of Object.entries(formatted)) {
      if (value instanceof Date) {
        formatted[key] = this.formatDate(value);
      }
    }

    return formatted;
  }

  /**
   * Format date according to configuration
   * @param {Date} date - Date to format
   * @returns {string|number} Formatted date
   */
  formatDate(date) {
    switch (this.config.dateFormat) {
      case 'timestamp':
        return date.getTime();
      case 'unix':
        return Math.floor(date.getTime() / 1000);
      case 'iso':
      default:
        return date.toISOString();
    }
  }

  /**
   * Get timing information for metadata
   * @param {object} metadata - Operation metadata
   * @returns {object} Timing information
   * @private
   */
  getTimingInfo(metadata) {
    if (!this.config.includeTiming) {
      return {};
    }

    const timing = {};
    
    if (metadata.startTime && metadata.endTime) {
      timing.duration = metadata.endTime - metadata.startTime;
    }

    if (metadata.timestamp) {
      timing.timestamp = this.formatDate(new Date(metadata.timestamp));
    } else {
      timing.timestamp = this.formatDate(new Date());
    }

    return { timing };
  }

  /**
   * Format error result
   * @param {Error} error - Error object
   * @param {object} metadata - Operation metadata
   * @returns {object} Formatted error response
   */
  formatError(error, metadata = {}) {
    const response = {
      error: error.message || 'Unknown error',
      success: false
    };

    if (error.code) {
      response.code = error.code;
    }

    if (this.config.includeMetadata) {
      response.metadata = {
        operation: metadata.operation || 'unknown',
        errorType: error.name || 'Error',
        ...this.getTimingInfo(metadata)
      };
    }

    // Include stack trace in development
    if (process.env.NODE_ENV === 'development' && error.stack) {
      response.stack = error.stack.split('\n');
    }

    return response;
  }

  /**
   * Format pagination result
   * @param {Array} records - Records for current page
   * @param {object} pagination - Pagination information
   * @param {object} metadata - Operation metadata
   * @returns {object} Formatted pagination response
   */
  formatPaginationResult(records, pagination, metadata = {}) {
    const response = {
      records: records.map(record => this.formatRecord(record)),
      pagination: {
        page: pagination.page || 1,
        limit: pagination.limit || 10,
        total: pagination.total || 0,
        pages: Math.ceil((pagination.total || 0) / (pagination.limit || 10)),
        hasNext: pagination.hasNext || false,
        hasPrev: pagination.hasPrev || false
      }
    };

    if (this.config.includeMetadata) {
      response.metadata = {
        operation: 'paginate',
        table: metadata.table,
        database: metadata.database,
        recordsInPage: records.length,
        ...this.getTimingInfo(metadata)
      };
    }

    return response;
  }

  /**
   * Format health check result
   * @param {object} healthData - Health check data
   * @returns {object} Formatted health response
   */
  formatHealthResult(healthData) {
    return {
      status: healthData.status || 'healthy',
      timestamp: this.formatDate(new Date()),
      version: healthData.version,
      uptime: healthData.uptime,
      databases: healthData.databases || {},
      performance: healthData.performance || {}
    };
  }

  /**
   * Format API information result
   * @param {object} apiInfo - API information
   * @returns {object} Formatted API info response
   */
  formatApiInfoResult(apiInfo) {
    return {
      name: apiInfo.name || 'BinDB Engine API',
      version: apiInfo.version || '1.0.0',
      description: apiInfo.description || 'Binary database engine HTTP API',
      endpoints: apiInfo.endpoints || [],
      features: apiInfo.features || [],
      documentation: apiInfo.documentation || null
    };
  }

  /**
   * Update configuration
   * @param {object} newConfig - New configuration options
   */
  updateConfig(newConfig) {
    this.config = {
      ...this.config,
      ...newConfig
    };
  }

  /**
   * Get current configuration
   * @returns {object} Current configuration
   */
  getConfig() {
    return { ...this.config };
  }

  /**
   * Create a standardized response wrapper
   * @param {any} data - Response data
   * @param {object} metadata - Response metadata
   * @returns {object} Standardized response
   */
  wrapResponse(data, metadata = {}) {
    const response = {
      success: true,
      data
    };

    if (this.config.includeMetadata && Object.keys(metadata).length > 0) {
      response.metadata = {
        ...metadata,
        ...this.getTimingInfo(metadata)
      };
    }

    return response;
  }
}