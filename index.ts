import { App } from './http/app';
import { EngineAPI } from './http/engine-api';
import { logger } from './logging/index';

const app = new App();
const engineAPI = new EngineAPI();

// Register Engine API routes
engineAPI.registerRoutes(app);

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM signal, shutting down gracefully...');
  await engineAPI.close();
  logger.info('Server shutdown complete');
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('Received SIGINT signal, shutting down gracefully...');
  await engineAPI.close();
  logger.info('Server shutdown complete');
  process.exit(0);
});

// Handle uncaught errors
process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught exception', { errorName: error.name }, error);
  process.exit(1);
});

process.on('unhandledRejection', (reason: any) => {
  logger.error('Unhandled promise rejection', { reason: String(reason) });
  process.exit(1);
});

const port = process.env.PORT || 3000;
logger.info('Starting BinDB server', {
  port,
  nodeEnv: process.env.NODE_ENV || 'development',
  nodeVersion: process.version,
  storagePath: process.env.BINDB_STORAGE_PATH || './data'
});

app.listen(port, () => {
  logger.info('BinDB server ready and accepting connections', { port });
});
