import express from 'express';
import { registry } from '@homecraft/contracts';
import { kitchenManifest } from '@homecraft/manifests/kitchen';
import {
  corsMiddleware,
  corsPreflightHandler,
  globalErrorHandler
} from './core/api/middleware.js';
import { mountRoutes } from './core/api/routes.js';

/**
 * Tests call createApp() without going through index.js.
 * Production still registers in index.js; skip if already present.
 */
function ensureKitchenManifest() {
  if (!registry.registeredTypes().includes('kitchen')) {
    registry.register(kitchenManifest);
  }
}

export function createApp() {
  ensureKitchenManifest();
  const app = express();

  app.disable('x-powered-by');
  app.use(corsMiddleware);
  app.use(corsPreflightHandler);
  app.use(express.json({ limit: '1mb' }));
  mountRoutes(app);
  app.use(globalErrorHandler);

  return app;
}
