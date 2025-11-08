import { App } from './http/app';
import { EngineAPI } from './http/engine-api';
import { createLogger } from './engine/logger';

const logger = createLogger('main');
const app = new App();
const engineAPI = new EngineAPI();

// Register Engine API routes
engineAPI.registerRoutes(app);

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('Shutting down gracefully');
  await engineAPI.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('Shutting down gracefully');
  await engineAPI.close();
  process.exit(0);
});

const port = process.env.PORT || 3000;
logger.info('Starting server', { port });
app.listen(port, () => {
  logger.info('BinDB server ready', { port });
});
