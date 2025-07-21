import type { HttpResponse } from './types';

/**
 * ResponseFormatter - Handles HTTP response formatting and serialization
 */
export class ResponseFormatter {
  /**
   * Format handler result into HTTP response structure
   */
  formatResponse(result: any, origin: string = '*'): HttpResponse {
    if (!result) {
      return this.createEmptyResponse();
    }

    if (typeof result === 'string') {
      return this.createTextResponse(result);
    }

    if (typeof result === 'object') {
      // Check if result is already a pre-formatted HttpResponse
      if (this.isHttpResponse(result)) {
        return result;
      }

      return this.createJsonResponse(result, origin);
    }

    // Fallback for other types
    return this.createTextResponse(String(result));
  }

  /**
   * Check if an object is a pre-formatted HttpResponse
   */
  private isHttpResponse(obj: any): obj is HttpResponse {
    return (
      obj &&
      typeof obj === 'object' &&
      typeof obj.statusCode === 'number' &&
      (obj.headers === undefined || typeof obj.headers === 'object') &&
      (obj.body === undefined ||
        typeof obj.body === 'string' ||
        Buffer.isBuffer(obj.body))
    );
  }

  createEmptyResponse(): HttpResponse {
    return {
      body: undefined,
      headers: {
        'Content-Length': '0',
      },
      statusCode: 200,
    };
  }

  createTextResponse(content: string): HttpResponse {
    return {
      body: content,
      headers: {
        'Content-Type': 'text/plain',
        'Content-Length': Buffer.byteLength(content, 'utf8').toString(),
      },
      statusCode: 200,
    };
  }

  createJsonResponse(data: any, _origin: string = '*'): HttpResponse {
    const body = JSON.stringify(data, null, 2);

    return {
      body,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body, 'utf8').toString(),
      },
      statusCode: 200,
    };
  }

  /**
   * Create error response
   */
  createErrorResponse(message: string, statusCode: number = 500): HttpResponse {
    const errorBody = JSON.stringify({ error: message });

    return {
      body: errorBody,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(errorBody, 'utf8').toString(),
      },
      statusCode,
    };
  }

  /**
   * Create not found response
   */
  createNotFoundResponse(): HttpResponse {
    return this.createErrorResponse('Not Found', 404);
  }

  /**
   * Create bad request response
   */
  createBadRequestResponse(message: string = 'Bad Request'): HttpResponse {
    return this.createErrorResponse(message, 400);
  }

  /**
   * Create internal error response
   */
  createInternalErrorResponse(): HttpResponse {
    return this.createErrorResponse('Internal Server Error', 500);
  }

  /**
   * Create success response
   */
  createSuccessResponse(data?: any): HttpResponse {
    if (data === undefined) {
      return this.createEmptyResponse();
    }

    return this.createJsonResponse(data);
  }

  /**
   * Create created response
   */
  createCreatedResponse(data?: any): HttpResponse {
    const response = data
      ? this.createJsonResponse(data)
      : this.createEmptyResponse();
    response.statusCode = 201;
    return response;
  }

  /**
   * Create no content response
   */
  createNoContentResponse(): HttpResponse {
    return {
      body: undefined,
      headers: {},
      statusCode: 204,
    };
  }
}
