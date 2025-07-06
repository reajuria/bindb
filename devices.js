import { randomUUID } from 'node:crypto';

/**
 * Devices Router
 * @param {import('./app').App} app
 */
export function devicesRouter(app) {
  const storage = [];
  app.post('/devices', async (req) => {
    const i = req.body.map((device) => {
      const id = `device_${randomUUID()}`;
      const item = {
        id,
        ...device,
      };
      return item;
    });

    storage.push(...i);
    return i;
  });
}
