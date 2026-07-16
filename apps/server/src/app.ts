import cors from 'cors';
import express from 'express';
import { runtimeConfig } from './config/runtime.js';
import { apiRouter } from './core/api/routes.js';
import { ensureStorage } from './storage/local-storage.js';

export function createApp() {
  const app = express();
  app.use(
    cors({
      origin: runtimeConfig.corsOrigin
    })
  );
  app.use(express.json({ limit: '1mb' }));
  app.use('/api', apiRouter);
  return app;
}

export async function bootstrap() {
  await ensureStorage();
  const app = createApp();
  app.listen(runtimeConfig.port, () => {
    console.log(`HomeCraft server listening on http://localhost:${runtimeConfig.port}`);
  });
}
