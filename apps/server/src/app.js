import express from 'express';
import { registry } from '@homecraft/contracts';
import { allManifests } from '@homecraft/manifests';
import {
  corsMiddleware,
  corsPreflightHandler,
  globalErrorHandler
} from './core/api/middleware.js';
import { mountRoutes } from './core/api/routes.js';

/**
 * Tests call createApp() without going through index.js.
 * Production still registers in index.js; skip types already present.
 */
function ensureManifestsRegistered() {
  for (const manifest of allManifests) {
    if (!registry.registeredTypes().includes(manifest.productType)) {
      registry.register(manifest);
    }
  }
}

export function createApp() {
  ensureManifestsRegistered();
  const app = express();

  app.disable('x-powered-by');
  app.use(corsMiddleware);
  app.use(corsPreflightHandler);
  app.use(express.json({ limit: '1mb' }));
  mountRoutes(app);
  app.use(globalErrorHandler);

  return app;
}
