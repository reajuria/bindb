import http from 'node:http';

export class HTTPClient {
  constructor(baseUrl = 'http://localhost:3000') {
    this.baseUrl = baseUrl;
  }

  /**
   * Make HTTP request
   * @param {string} method HTTP method
   * @param {string} path URL path
   * @param {Object} data Request body data
   * @returns {Promise<Object>} Response data
   */
  async request(method, path, data = null) {
    return new Promise((resolve, reject) => {
      const url = new URL(path, this.baseUrl);
      const body = data ? JSON.stringify(data) : null;
      
      const options = {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
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
              status: res.statusCode,
              data: parsed,
              headers: res.headers
            });
          } catch (error) {
            reject(new Error(`Failed to parse response: ${error.message}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      if (body) {
        req.write(body);
      }
      
      req.end();
    });
  }

  /**
   * POST request
   * @param {string} path URL path
   * @param {Object} data Request body
   * @returns {Promise<Object>} Response
   */
  async post(path, data) {
    return this.request('POST', path, data);
  }

  /**
   * GET request
   * @param {string} path URL path
   * @returns {Promise<Object>} Response
   */
  async get(path) {
    return this.request('GET', path);
  }

  /**
   * Engine API helper methods
   */

  async insert(database, table, record) {
    return this.post('/v1/insert', { database, table, record });
  }

  async bulkInsert(database, table, records) {
    return this.post('/v1/bulkInsert', { database, table, records });
  }

  async getRecord(database, table, id) {
    return this.post('/v1/get', { database, table, id });
  }

  async update(database, table, id, update) {
    return this.post('/v1/update', { database, table, id, update });
  }

  async delete(database, table, id) {
    return this.post('/v1/delete', { database, table, id });
  }

  async count(database, table) {
    return this.post('/v1/count', { database, table });
  }

  async createTable(database, table, schema) {
    return this.post('/v1/createTable', { database, table, schema });
  }

  async health() {
    return this.get('/v1/health');
  }

  async info() {
    return this.get('/v1/info');
  }
}