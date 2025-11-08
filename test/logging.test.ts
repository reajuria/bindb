/**
 * Tests for centralized logging system
 */

import {
  logger,
  createLogger,
  LogLevel,
  generateCorrelationId,
  generateRequestId,
  runWithContext,
  getContext,
  getCorrelationId,
  getRequestId,
  getRequestDuration,
  createRequestContext,
} from '../logging/index';
import type { IncomingMessage } from 'http';

describe('Logger', () => {
  let consoleLogSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  describe('Basic Logging', () => {
    it('should log info messages', () => {
      logger.info('Test info message');
      expect(consoleLogSpy).toHaveBeenCalled();
      const logOutput = consoleLogSpy.mock.calls[0][0];
      expect(logOutput).toContain('Test info message');
      expect(logOutput).toContain('INFO');
    });

    it('should log error messages', () => {
      logger.error('Test error message');
      expect(consoleErrorSpy).toHaveBeenCalled();
      const logOutput = consoleErrorSpy.mock.calls[0][0];
      expect(logOutput).toContain('Test error message');
      expect(logOutput).toContain('ERROR');
    });

    it('should log warning messages', () => {
      logger.warn('Test warning message');
      expect(consoleWarnSpy).toHaveBeenCalled();
      const logOutput = consoleWarnSpy.mock.calls[0][0];
      expect(logOutput).toContain('Test warning message');
      expect(logOutput).toContain('WARN');
    });

    it('should log debug messages', () => {
      logger.debug('Test debug message');
      expect(consoleLogSpy).toHaveBeenCalled();
      const logOutput = consoleLogSpy.mock.calls[0][0];
      expect(logOutput).toContain('Test debug message');
      expect(logOutput).toContain('DEBUG');
    });
  });

  describe('Context Logging', () => {
    it('should include context in log messages', () => {
      logger.info('Test message', { userId: '123', operation: 'test' });
      expect(consoleLogSpy).toHaveBeenCalled();
      const logOutput = consoleLogSpy.mock.calls[0][0];
      expect(logOutput).toContain('userId');
      expect(logOutput).toContain('123');
      expect(logOutput).toContain('operation');
      expect(logOutput).toContain('test');
    });

    it('should log errors with error objects', () => {
      const error = new Error('Test error');
      logger.error('Error occurred', {}, error);
      expect(consoleErrorSpy).toHaveBeenCalled();
      const logOutput = consoleErrorSpy.mock.calls[0][0];
      expect(logOutput).toContain('Error occurred');
      expect(logOutput).toContain('Test error');
    });
  });

  describe('Child Logger', () => {
    it('should create child logger with additional context', () => {
      const childLogger = logger.child({ requestId: 'abc123' });
      childLogger.info('Child logger test');
      expect(consoleLogSpy).toHaveBeenCalled();
      const logOutput = consoleLogSpy.mock.calls[0][0];
      expect(logOutput).toContain('Child logger test');
      expect(logOutput).toContain('abc123');
    });
  });

  describe('Performance Logging', () => {
    it('should log performance metrics', () => {
      logger.performance('Operation completed', 150, { operation: 'test' });
      expect(consoleLogSpy).toHaveBeenCalled();
      const logOutput = consoleLogSpy.mock.calls[0][0];
      expect(logOutput).toContain('Operation completed');
      expect(logOutput).toContain('150');
    });
  });

  describe('Timer', () => {
    it('should measure operation duration', (done) => {
      const timer = logger.timer('Test operation');
      setTimeout(() => {
        const duration = timer.end();
        expect(duration).toBeGreaterThan(0);
        expect(consoleLogSpy).toHaveBeenCalled();
        done();
      }, 10);
    });

    it('should get elapsed time without logging', (done) => {
      const timer = logger.timer('Test operation');
      setTimeout(() => {
        const elapsed = timer.elapsed();
        expect(elapsed).toBeGreaterThan(0);
        expect(consoleLogSpy).not.toHaveBeenCalled();
        done();
      }, 10);
    });
  });

  describe('Custom Logger Creation', () => {
    it('should create logger with custom config', () => {
      const customLogger = createLogger(
        { service: 'test' },
        { minLevel: LogLevel.ERROR }
      );
      customLogger.debug('Debug message');
      customLogger.info('Info message');
      customLogger.error('Error message');

      // Only error should be logged due to minLevel
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });
  });
});

describe('Correlation ID', () => {
  it('should generate unique correlation IDs', () => {
    const id1 = generateCorrelationId();
    const id2 = generateCorrelationId();
    expect(id1).toBeTruthy();
    expect(id2).toBeTruthy();
    expect(id1).not.toBe(id2);
    expect(id1.length).toBe(32); // 16 bytes as hex = 32 chars
  });

  it('should generate unique request IDs', () => {
    const id1 = generateRequestId();
    const id2 = generateRequestId();
    expect(id1).toBeTruthy();
    expect(id2).toBeTruthy();
    expect(id1).not.toBe(id2);
    expect(id1.length).toBe(16); // 8 bytes as hex = 16 chars
  });
});

describe('Request Context', () => {
  it('should create request context from HTTP request', () => {
    const mockReq = {
      method: 'GET',
      url: '/test',
      headers: {
        host: 'localhost',
      },
      socket: {
        remoteAddress: '127.0.0.1',
      },
    } as unknown as IncomingMessage;

    const context = createRequestContext(mockReq);
    expect(context.method).toBe('GET');
    expect(context.path).toBe('/test');
    expect(context.correlationId).toBeTruthy();
    expect(context.requestId).toBeTruthy();
    expect(context.startTime).toBeGreaterThan(0);
    expect(context.clientIp).toBe('127.0.0.1');
  });

  it('should extract correlation ID from headers', () => {
    const mockReq = {
      method: 'POST',
      url: '/api',
      headers: {
        'x-correlation-id': 'existing-correlation-id',
        host: 'localhost',
      },
      socket: {
        remoteAddress: '127.0.0.1',
      },
    } as unknown as IncomingMessage;

    const context = createRequestContext(mockReq);
    expect(context.correlationId).toBe('existing-correlation-id');
  });

  it('should run code with request context', () => {
    const testContext = {
      correlationId: 'test-correlation-id',
      requestId: 'test-request-id',
      startTime: Date.now(),
      method: 'GET',
      path: '/test',
      clientIp: '127.0.0.1',
    };

    runWithContext(testContext, () => {
      const context = getContext();
      expect(context).toBeDefined();
      expect(context?.correlationId).toBe('test-correlation-id');
      expect(context?.requestId).toBe('test-request-id');

      const correlationId = getCorrelationId();
      expect(correlationId).toBe('test-correlation-id');

      const requestId = getRequestId();
      expect(requestId).toBe('test-request-id');
    });
  });

  it('should calculate request duration', (done) => {
    const testContext = {
      correlationId: 'test-correlation-id',
      requestId: 'test-request-id',
      startTime: Date.now(),
      method: 'GET',
      path: '/test',
    };

    runWithContext(testContext, () => {
      setTimeout(() => {
        const duration = getRequestDuration();
        expect(duration).toBeGreaterThan(0);
        done();
      }, 10);
    });
  });

  it('should return undefined context when not in context', () => {
    const context = getContext();
    expect(context).toBeUndefined();

    const correlationId = getCorrelationId();
    expect(correlationId).toBeUndefined();

    const requestId = getRequestId();
    expect(requestId).toBeUndefined();

    const duration = getRequestDuration();
    expect(duration).toBeUndefined();
  });
});

describe('HTTP Request/Response Logging', () => {
  let consoleLogSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  it('should log HTTP requests', () => {
    logger.logRequest('GET', '/api/test');
    expect(consoleLogSpy).toHaveBeenCalled();
    const logOutput = consoleLogSpy.mock.calls[0][0];
    expect(logOutput).toContain('GET');
    expect(logOutput).toContain('/api/test');
  });

  it('should log successful HTTP responses', () => {
    logger.logResponse('GET', '/api/test', 200, 50);
    expect(consoleLogSpy).toHaveBeenCalled();
    const logOutput = consoleLogSpy.mock.calls[0][0];
    expect(logOutput).toContain('GET');
    expect(logOutput).toContain('/api/test');
    expect(logOutput).toContain('200');
    expect(logOutput).toContain('50');
  });

  it('should log client error HTTP responses as warnings', () => {
    logger.logResponse('POST', '/api/create', 400, 25);
    expect(consoleWarnSpy).toHaveBeenCalled();
    const logOutput = consoleWarnSpy.mock.calls[0][0];
    expect(logOutput).toContain('POST');
    expect(logOutput).toContain('/api/create');
    expect(logOutput).toContain('400');
  });

  it('should log server error HTTP responses as errors', () => {
    logger.logResponse('DELETE', '/api/delete', 500, 100);
    expect(consoleErrorSpy).toHaveBeenCalled();
    const logOutput = consoleErrorSpy.mock.calls[0][0];
    expect(logOutput).toContain('DELETE');
    expect(logOutput).toContain('/api/delete');
    expect(logOutput).toContain('500');
  });
});

describe('Database Operation Logging', () => {
  let consoleLogSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  it('should log database operations', () => {
    logger.logDatabaseOperation('insert', 'users', { recordId: '123' });
    expect(consoleLogSpy).toHaveBeenCalled();
    const logOutput = consoleLogSpy.mock.calls[0][0];
    expect(logOutput).toContain('insert');
    expect(logOutput).toContain('users');
  });
});
