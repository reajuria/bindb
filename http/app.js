import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';

export class App {
  /** @type {Map<string, (req: {reqId: string; query: any; body: any;}) => Promise<object>>} */
  handlers = new Map();
  paths = new Set();

  /** @type {import('node:http').Server} */
  server = undefined;

  constructor() {
    // Create an HTTP server
    this.server = createServer();

    // Listen for requests and parse URL
    this.server.on('request', async (req, res) => {
      try {
        const url = new URL(req.url, `http://${req.headers.host}`);

        // Form a key for the handlers map
        const key = `${req.method}:${url.pathname}`;
        let handler = this.handlers.get(key);
        const origin = req.headers['origin'] || req.headers['Origin'] || '*';
        let params;

        for (const [key, value] of this.handlers.entries()) {
          // const [method, path] = key.split(':');
          const method = key.split(':')[0];
          const path = key.replace(`${method}:`, '');
          const { match, params: routeParams } = this.parseRouteParams(
            url.pathname,
            path
          );
          if (req.method === method && match) {
            handler = value;
            params = routeParams;
            break;
          }
        }

        if (
          req.method === 'OPTIONS' &&
          (this.paths.has(url.pathname) || !!handler)
        ) {
          res.writeHead(200, {
            'Access-Control-Allow-Origin': origin,
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Max-Age': '86400',
          });
          res.end();
          return;
        }

        if (handler) {
          const reqLocals = {
            reqId: randomUUID(),
            url,
            headers: req.headers,
            params,
            query: Object.fromEntries(url.searchParams),
            body: undefined,
          };

          // Parse body if necessary
          if (
            req.method !== 'GET' &&
            req.method !== 'HEAD' &&
            req.method !== 'OPTIONS'
          ) {
            try {
              reqLocals.body = await new Promise((resolve, reject) => {
                let body = '';
                req.on('data', (chunk) => {
                  body += chunk.toString();
                });
                req.on('end', () => {
                  try {
                    resolve(JSON.parse(body || '{}'));
                  } catch (error) {
                    reject(new Error('Invalid JSON'));
                  }
                });
                req.on('error', (error) => {
                  reject(error);
                });
              });
            } catch (error) {
              res.writeHead(400, { 'Content-Type': 'text/plain' });
              res.end(error.message);
              return;
            }
          }

          // Call handler
          const result = await handler(reqLocals);

          let response = result;

          if (!result) {
            response = {
              body: undefined,
              headers: {
                'Content-Length': 0,
              },
            };
          } else if (typeof result === 'string') {
            response = {
              body: result,
              headers: {
                'Content-Type': 'text/html',
              },
            };
          } else if (typeof result === 'object') {
            response = {
              body: JSON.stringify(result),
              headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': origin,
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Max-Age': '86400',
              },
            };
          }

          // Send a response
          res.writeHead(200, {
            ...response.headers,
          });

          res.end(response.body);
        } else {
          // No handler found
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('Not Found');
        }
      } catch (error) {
        // Send an error
        // console.error(`Error occurred: ${error.message}`);
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Internal Server Error');
      }
    });
  }

  /**
   * Parse the URL to match route parameters
   * @param {string} urlPath URL path
   * @param {string} routePath Route path
   * @returns {{match: boolean, params: object}}
   */
  parseRouteParams(urlPath, routePath) {
    const urlSegments = urlPath.split('/');
    const routeSegments = routePath.split('/');
    let params = {};

    if (urlSegments.length !== routeSegments.length) {
      return { match: false, params: {} };
    }

    for (let i = 0; i < routeSegments.length; i++) {
      const routeSegment = routeSegments[i];
      if (routeSegment.startsWith(':')) {
        const paramName = routeSegment.substring(1);
        params[paramName] = urlSegments[i];
      } else if (routeSegment !== urlSegments[i]) {
        return { match: false, params: {} };
      }
    }

    return { match: true, params };
  }

  listen(port) {
    this.server.listen(port, () =>
      console.log(`Server listening on port ${port}`)
    );
  }

  /**
   * Add a POST handler
   * @param {string} path Path to register handler for
   * @param {(req: {reqId: string; query: any; body: any;}) => Promise<object>} handler
   */
  post(path, handler) {
    this.handlers.set(`POST:${path}`, handler);
    this.paths.add(path);
  }

  /**
   * Add a GET handler
   * @param {string} path Path to register handler for
   * @param {(req: {reqId: string; query: any; body: any;}) => Promise<object>} handler
   */
  get(path, handler) {
    this.handlers.set(`GET:${path}`, handler);
    this.paths.add(path);
  }

  /**
   * Add a PUT handler
   * @param {string} path Path to register handler for
   * @param {(req: {reqId: string; query: any; body: any;}) => Promise<object>} handler
   */
  put(path, handler) {
    this.handlers.set(`PUT:${path}`, handler);
    this.paths.add(path);
  }

  /**
   * Add a DELETE handler
   * @param {string} path Path to register handler for
   * @param {(req: {reqId: string; query: any; body: any;}) => Promise<object>} handler
   */
  delete(path, handler) {
    this.handlers.set(`DELETE:${path}`, handler);
    this.paths.add(path);
  }

  /**
   * Add a PATCH handler
   * @param {string} path Path to register handler for
   * @param {(req: {reqId: string; query: any; body: any;}) => Promise<object>} handler
   */
  patch(path, handler) {
    this.handlers.set(`PATCH:${path}`, handler);
    this.paths.add(path);
  }
}
