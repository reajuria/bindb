import http from 'node:http';

export interface HTTPResponse<T = any> {
  status: number;
  data: T;
  headers: http.IncomingHttpHeaders;
}

export interface HealthResponse {
  status: string;
  timestamp: string;
  uptime: number;
  version: string;
  api: {
    requestCount: number;
    enabledFeatures: {
      metrics: boolean;
      debugRoutes: boolean;
    };
  };
}

export interface CreateTableRequest {
  database: string;
  table: string;
  schema: Array<{
    name: string;
    type: string;
    length?: number;
    nullable?: boolean;
  }>;
}

export interface InsertRequest {
  database: string;
  table: string;
  data: Record<string, any>;
}

export interface FindResponse {
  record: Record<string, any> | null;
  found: boolean;
  metadata?: any;
}

export interface InsertResponse {
  insertedId: string;
  record: Record<string, any>;
  metadata?: any;
}

export interface UpdateRequest {
  database: string;
  table: string;
  id: string;
  data: Record<string, any>;
}

export interface UpdateResponse {
  matchedCount: number;
  modifiedCount: number;
  record?: Record<string, any> | null;
  metadata?: any;
}

export interface DeleteRequest {
  database: string;
  table: string;
  id: string;
}

export interface DeleteResponse {
  deletedCount: number;
  acknowledged: boolean;
  metadata?: any;
}

export class HTTPClient {
  private baseUrl: string;

  constructor(baseUrl: string = 'http://localhost:3000') {
    this.baseUrl = baseUrl;
  }

  /**
   * Make HTTP request
   */
  async request<T = any>(method: string, path: string, data: any = null): Promise<HTTPResponse<T>> {
    return new Promise((resolve, reject) => {
      const url = new URL(path, this.baseUrl);
      const body = data ? JSON.stringify(data) : null;
      
      const options: http.RequestOptions = {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(body && { 'Content-Length': Buffer.byteLength(body) })
        }
      };

      const req = http.request(options, (res) => {
        let responseBody = '';
        
        res.on('data', (chunk) => {
          responseBody += chunk;
        });
        
        res.on('end', () => {
          try {
            const parsed = responseBody ? JSON.parse(responseBody) : {};
            resolve({
              status: res.statusCode || 0,
              data: parsed,
              headers: res.headers
            });
          } catch (error) {
            reject(new Error(`Failed to parse response: ${(error as Error).message}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(new Error(`Request failed: ${error.message}`));
      });

      if (body) {
        req.write(body);
      }

      req.end();
    });
  }

  /**
   * GET request
   */
  async get<T = any>(path: string): Promise<HTTPResponse<T>> {
    return this.request<T>('GET', path);
  }

  /**
   * POST request
   */
  async post<T = any>(path: string, data?: any): Promise<HTTPResponse<T>> {
    return this.request<T>('POST', path, data);
  }

  /**
   * PUT request
   */
  async put<T = any>(path: string, data?: any): Promise<HTTPResponse<T>> {
    return this.request<T>('PUT', path, data);
  }

  /**
   * DELETE request
   */
  async delete<T = any>(path: string, data?: any): Promise<HTTPResponse<T>> {
    return this.request<T>('DELETE', path, data);
  }

  // API-specific methods

  /**
   * Health check
   */
  async health(): Promise<HTTPResponse<HealthResponse>> {
    return this.get<HealthResponse>('/v1/health');
  }

  /**
   * API info
   */
  async info(): Promise<HTTPResponse<any>> {
    return this.get('/v1/info');
  }

  /**
   * Create table
   */
  async createTable(request: CreateTableRequest): Promise<HTTPResponse<any>> {
    return this.post('/v1/table/create', request);
  }

  /**
   * List tables
   */
  async listTables(database: string): Promise<HTTPResponse<any>> {
    return this.get(`/v1/table/list?database=${encodeURIComponent(database)}`);
  }

  /**
   * Get table schema
   */
  async getTableSchema(database: string, table: string): Promise<HTTPResponse<any>> {
    return this.get(`/v1/table/schema?database=${encodeURIComponent(database)}&table=${encodeURIComponent(table)}`);
  }

  /**
   * Insert record
   */
  async insert(request: InsertRequest): Promise<HTTPResponse<InsertResponse>> {
    return this.post<InsertResponse>('/v1/insert', request);
  }

  /**
   * Bulk insert records
   */
  async bulkInsert(database: string, table: string, data: Record<string, any>[]): Promise<HTTPResponse<any>> {
    return this.post('/v1/bulkInsert', { database, table, data });
  }

  /**
   * Find record by ID
   */
  async find(database: string, table: string, id: string): Promise<HTTPResponse<FindResponse>> {
    return this.get<FindResponse>(`/v1/find?database=${encodeURIComponent(database)}&table=${encodeURIComponent(table)}&id=${encodeURIComponent(id)}`);
  }

  /**
   * Update record
   */
  async update(request: UpdateRequest): Promise<HTTPResponse<UpdateResponse>> {
    return this.put<UpdateResponse>('/v1/update', request);
  }

  /**
   * Delete record
   */
  async deleteRecord(request: DeleteRequest): Promise<HTTPResponse<DeleteResponse>> {
    return this.delete<DeleteResponse>('/v1/delete', request);
  }

  /**
   * Count records
   */
  async count(database: string, table: string): Promise<HTTPResponse<any>> {
    return this.get(`/v1/count?database=${encodeURIComponent(database)}&table=${encodeURIComponent(table)}`);
  }

  /**
   * Get stats
   */
  async stats(database: string, table?: string): Promise<HTTPResponse<any>> {
    const params = table 
      ? `database=${encodeURIComponent(database)}&table=${encodeURIComponent(table)}`
      : `database=${encodeURIComponent(database)}`;
    return this.get(`/v1/stats?${params}`);
  }

  /**
   * Get metrics
   */
  async metrics(): Promise<HTTPResponse<any>> {
    return this.get('/v1/metrics');
  }
}