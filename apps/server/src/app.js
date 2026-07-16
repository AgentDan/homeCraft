import express from 'express';
import {
  corsMiddleware,
  corsPreflightHandler,
  globalErrorHandler
} from './core/api/middleware.js';
import { mountRoutes } from './core/api/routes.js';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(corsMiddleware);
  app.use(corsPreflightHandler);
  app.use(express.json({ limit: '1mb' }));
  mountRoutes(app);
  app.use(globalErrorHandler);

  return app;
}
