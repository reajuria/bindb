import { spawn } from 'child_process';
import { HTTPClient } from './http-client.js';

export interface ServerInfo {
  process: any;
  client: HTTPClient;
  port: number;
}

export async function checkPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = require('net').createServer();
    server.listen(port, () => {
      server.once('close', () => resolve(true));
      server.close();
    });
    server.on('error', () => resolve(false));
  });
}

export async function waitForPort(
  port: number,
  timeout: number = 5000
): Promise<boolean> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    try {
      const client = new HTTPClient(`http://localhost:${port}`);
      await client.health();
      return true;
    } catch {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  return false;
}

export async function findAvailablePort(
  startPort: number = 3000
): Promise<number> {
  for (let port = startPort; port < startPort + 100; port++) {
    if (await checkPortAvailable(port)) {
      return port;
    }
  }
  throw new Error('No available ports found');
}

export async function startTestServer(
  storagePath?: string
): Promise<ServerInfo> {
  const port = await findAvailablePort(3001);

  return new Promise((resolve, reject) => {
    let serverReady = false;

    const env = {
      ...process.env,
      PORT: port.toString(),
      CI: process.env.CI,
      ...(storagePath && { BINDB_STORAGE_PATH: storagePath }),
    };

    const serverProcess = spawn('node', ['dist/index.js'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env,
    });

    const startupTimeout = process.env.CI ? 60000 : 15000;
    let timeoutHandle: NodeJS.Timeout | null = setTimeout(() => {
      if (!serverReady) {
        reject(
          new Error(
            `Server failed to start within ${startupTimeout / 1000} seconds on port ${port}`
          )
        );
      }
    }, startupTimeout);

    serverProcess.stdout?.on('data', data => {
      const output = data.toString();
      if (
        output.includes('Server listening on port') ||
        output.includes('BinDB server ready')
      ) {
        if (!serverReady) {
          serverReady = true;
          if (timeoutHandle) {
            clearTimeout(timeoutHandle);
            timeoutHandle = null;
          }

          const client = new HTTPClient(`http://localhost:${port}`);

          // Give server more time to fully initialize in CI
          const initDelay = process.env.CI ? 1500 : 300;
          setTimeout(() => {
            resolve({
              process: serverProcess,
              client,
              port,
            });
          }, initDelay);
        }
      }
    });

    serverProcess.stderr?.on('data', data => {
      const errorMsg = data.toString();
      if (!serverReady && !errorMsg.includes('Warning:')) {
        console.error('Server error:', errorMsg);
      }
    });

    serverProcess.on('error', error => {
      if (!serverReady) {
        reject(new Error(`Failed to start server: ${error.message}`));
      }
    });

    serverProcess.on('exit', code => {
      if (!serverReady && code !== 0) {
        reject(new Error(`Server exited with code ${code}`));
      }
    });
  });
}

export async function stopTestServer(serverInfo: ServerInfo): Promise<void> {
  return new Promise<void>(resolve => {
    let cleanupDone = false;

    const cleanup = () => {
      if (!cleanupDone) {
        cleanupDone = true;
        resolve();
      }
    };

    if (serverInfo.process) {
      serverInfo.process.on('exit', cleanup);
      serverInfo.process.on('close', cleanup);

      serverInfo.process.kill('SIGTERM');

      // Force kill after timeout in CI
      const killTimeout = process.env.CI ? 5000 : 3000;
      setTimeout(() => {
        if (serverInfo.process && !serverInfo.process.killed) {
          serverInfo.process.kill('SIGKILL');
        }
        cleanup();
      }, killTimeout);
    } else {
      cleanup();
    }
  });
}
