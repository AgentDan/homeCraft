import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { route } from '../orchestrator.js';
import { getStorageStatus } from '../../storage/local-storage.js';
import { connectMongo } from '../../storage/mongo.js';
import { connectRedis, redisConfigured } from '../../storage/redis.js';
import { getBomCacheStats } from '../../pricing-engine/bom-cache.js';
import { listCatalogSnapshots } from '../../knowledge-base/catalog-store.js';
import { loadExportRecord } from '../../export/export-store.js';
import { isProduction, runtimeLabel } from '../../config/runtime.js';
import { sendJson } from '../../lib/send-json.js';
import { synthesizeSpeech, ttsConfigured } from '../../ai-services/tts.js';
import {
  wrapAsync,
  notFoundApiHandler,
  resolveClientDistPath,
  parseClientRequest
} from './middleware.js';

const __dirnameRoutes = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.join(__dirnameRoutes, '..', '..', '..');
const gltfDir = path.join(serverRoot, 'gltf');

/**
 * Registers HTTP routes and static assets (API Layer).
 * @param {import('express').Express} app
 */
export function mountRoutes(app) {
  app.use('/gltf', express.static(gltfDir));

  app.get('/health', (req, res) => {
    sendJson(res, 200, {
      status: 'ok',
      service: 'homecraft-server',
      env: runtimeLabel()
    });
  });

  app.get('/api', (req, res) => {
    sendJson(res, 200, {
      name: 'HomeCraft API',
      version: '0.1.0',
      endpoints: [
        'GET /health',
        'GET /api',
        'GET /api/health',
        'GET /api/storage/status',
        'GET /api/catalog/snapshots',
        'GET /api/exports/:id',
        'POST /api/commands',
        'GET /api/tts/status',
        'POST /api/tts'
      ]
    });
  });

  app.get(
    '/api/health',
    wrapAsync(async (_req, res) => {
      const storage = await getStorageStatus();
      const mongo = await connectMongo();
      const redis = await connectRedis();
      sendJson(res, 200, {
        status: 'ok',
        service: 'homecraft-server',
        env: runtimeLabel(),
        storage,
        mongo: mongo ? 'connected' : 'disconnected',
        redis: redis ? 'connected' : redisConfigured() ? 'disconnected' : 'not_configured',
        bomCache: getBomCacheStats()
      });
    })
  );

  app.get(
    '/api/storage/status',
    wrapAsync(async (_req, res) => {
      sendJson(res, 200, await getStorageStatus());
    })
  );

  app.get(
    '/api/catalog/snapshots',
    wrapAsync(async (_req, res) => {
      sendJson(res, 200, {
        snapshots: await listCatalogSnapshots()
      });
    })
  );

  app.get(
    '/api/exports/:id',
    wrapAsync(async (req, res) => {
      const exportId = String(req.params.id ?? '').trim();
      const loaded = exportId ? await loadExportRecord(exportId) : null;
      if (!loaded) {
        sendJson(res, 404, {
          status: 'error',
          message: 'Export not found.',
          errors: [`Unknown export id: ${exportId}`]
        });
        return;
      }
      res.status(200);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${loaded.record.fileName}"`
      );
      res.setHeader('X-HomeCraft-Plan-Version', String(loaded.record.planVersion));
      res.setHeader(
        'X-HomeCraft-Catalog-Snapshot',
        loaded.record.catalogSnapshotId
      );
      res.setHeader('X-HomeCraft-Content-SHA256', loaded.record.contentSha256);
      res.send(loaded.pdf);
    })
  );

  app.post(
    '/api/commands',
    wrapAsync(async (req, res) => {
      const clientRequest = parseClientRequest(req.body);
      const result = await route(clientRequest);
      sendJson(res, result.statusCode, result.response);
    })
  );

  app.get('/api/tts/status', (_req, res) => {
    sendJson(res, 200, {
      available: ttsConfigured(),
      engines: ttsConfigured() ? ['browser', 'ai'] : ['browser']
    });
  });

  app.post(
    '/api/tts',
    wrapAsync(async (req, res) => {
      const text = typeof req.body?.text === 'string' ? req.body.text : '';
      const language =
        req.body?.language === 'ru' || req.body?.language === 'sr'
          ? req.body.language
          : 'en';
      try {
        const audio = await synthesizeSpeech({ text, language });
        res.status(200);
        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Cache-Control', 'no-store');
        res.send(audio);
      } catch (error) {
        const statusCode =
          error && typeof error === 'object' && 'statusCode' in error
            ? Number(error.statusCode) || 500
            : 500;
        sendJson(res, statusCode, {
          status: 'error',
          message: error instanceof Error ? error.message : 'TTS failed',
          errors: ['tts_failed']
        });
      }
    })
  );

  app.use('/api', notFoundApiHandler);

  const clientDistPath = resolveClientDistPath();

  if (isProduction) {
    app.use(
      express.static(clientDistPath, {
        setHeaders: (res, filePath) => {
          if (path.extname(filePath).toLowerCase() === '.html') {
            res.setHeader('Cache-Control', 'no-cache');
          }
        }
      })
    );

    const spaIndexPath = path.join(clientDistPath, 'index.html');
    app.use((req, res, next) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') return next();
      if (req.path.startsWith('/api') || req.path.startsWith('/gltf') || req.path === '/health') {
        return next();
      }
      res.sendFile(spaIndexPath, (err) => {
        if (err) {
          res
            .status(503)
            .type('text/plain')
            .send(
              'Client bundle not found. Run "npm run build" or set CLIENT_DIST_PATH to apps/client/dist.'
            );
        }
      });
    });
  } else {
    app.use((req, res, next) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') return next();
      if (req.path.startsWith('/api') || req.path.startsWith('/gltf') || req.path === '/health') {
        return next();
      }
      res.type('text/plain').send('Dev: API only — client runs on Vite.');
    });
  }

  app.use((req, res) => {
    sendJson(res, 404, {
      status: 'error',
      message: 'Route not found.',
      errors: [`${req.method} ${req.originalUrl} is not supported.`]
    });
  });
}
