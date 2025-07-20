import { App } from './http/app.js';
import { EngineAPI } from './http/engine-api.js';

const app = new App();
const engineAPI = new EngineAPI();

// Register Engine API routes
engineAPI.registerRoutes(app);

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Shutting down gracefully...');
  await engineAPI.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  await engineAPI.close();
  process.exit(0);
});

const port = process.env.PORT || 3000;
console.log(`Starting server on port ${port}...`);
app.listen(port, () => {
  console.log(`✅ BinDB server ready on port ${port}`);
});
