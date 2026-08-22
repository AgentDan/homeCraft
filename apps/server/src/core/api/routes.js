import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import {
  BehaviorSignalInputSchema,
  ClientOutcomeInputSchema,
  ClientProfileSchema,
  getAdminSchemaCatalog
} from '@homecraft/contracts';
import { route } from '../orchestrator.js';
import { getStorageStatus } from '../../storage/local-storage.js';
import {
  connectMongo,
  replaceJourneyQuestionsInMongo
} from '../../storage/mongo.js';
import { connectRedis, redisConfigured } from '../../storage/redis.js';
import { getBomCacheStats } from '../../pricing-engine/bom-cache.js';
import { listCatalogSnapshots } from '../../knowledge-base/catalog-store.js';
import { loadExportRecord } from '../../export/export-store.js';
import {
  appendBehaviorSignal,
  appendOutcomeEvent,
  loadObservationTimeline
} from '../../storage/journey-events.js';
import {
  loadClientProfile,
  loadDecisionState,
  saveClientProfile,
  createDefaultDecisionState
} from '../decision-state.js';
import { getJourneyQuestions, replaceJourneyQuestions } from '../journey-table.js';
import { getRecommendationRules } from '../recommendation-engine.js';
import {
  validateAdminJourneyQuestions,
  validateAdminRecommendationRules
} from '../admin-validate.js';
import { saveRecommendationRulesToStore } from '../../storage/recommendation-rules-store.js';
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
 * @param {import('express').Request} req
 */
function queryProductType(req) {
  const value = req.query?.productType;
  const raw = Array.isArray(value) ? value[0] : value;
  return typeof raw === 'string' && raw.trim() ? raw.trim() : 'kitchen';
}

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
        'POST /api/observation/signals',
        'POST /api/observation/outcomes',
        'GET /api/observation/:clientId/timeline',
        'GET /api/decision-state/:clientId',
        'GET /api/client-profiles/:clientId',
        'PUT /api/client-profiles/:clientId',
        'GET /api/admin/schema-catalog',
        'GET /api/admin/journey-questions',
        'PUT /api/admin/journey-questions',
        'GET /api/admin/recommendation-rules',
        'PUT /api/admin/recommendation-rules',
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
    wrapAsync(async (req, res) => {
      sendJson(res, 200, {
        snapshots: await listCatalogSnapshots(queryProductType(req))
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

  app.post(
    '/api/observation/signals',
    wrapAsync(async (req, res) => {
      const input = BehaviorSignalInputSchema.parse(req.body);
      const recorded = await appendBehaviorSignal(input);
      sendJson(res, 201, { status: 'ok', signal: recorded });
    })
  );

  app.post(
    '/api/observation/outcomes',
    wrapAsync(async (req, res) => {
      const input = ClientOutcomeInputSchema.parse(req.body);
      const recorded = await appendOutcomeEvent({
        clientId: input.clientId,
        requestId: input.requestId,
        executionResult: input.executionResult ?? {
          status: 'success',
          reason: null
        },
        clientOutcome: input.clientOutcome
      });
      sendJson(res, 201, { status: 'ok', outcome: recorded });
    })
  );

  app.get(
    '/api/observation/:clientId/timeline',
    wrapAsync(async (req, res) => {
      const clientId = String(req.params.clientId ?? '').trim();
      const events = await loadObservationTimeline(clientId);
      sendJson(res, 200, { clientId, events });
    })
  );

  app.get(
    '/api/decision-state/:clientId',
    wrapAsync(async (req, res) => {
      const clientId = String(req.params.clientId ?? '').trim();
      const state =
        (await loadDecisionState(clientId)) ?? createDefaultDecisionState(clientId);
      sendJson(res, 200, { status: 'ok', decisionState: state });
    })
  );

  app.get(
    '/api/client-profiles/:clientId',
    wrapAsync(async (req, res) => {
      const clientId = String(req.params.clientId ?? '').trim();
      const profile = await loadClientProfile(clientId);
      if (!profile) {
        sendJson(res, 404, {
          status: 'error',
          message: 'ClientProfile not found.',
          errors: [`Unknown clientId: ${clientId}`]
        });
        return;
      }
      sendJson(res, 200, { status: 'ok', profile });
    })
  );

  app.put(
    '/api/client-profiles/:clientId',
    wrapAsync(async (req, res) => {
      const clientId = String(req.params.clientId ?? '').trim();
      const profile = ClientProfileSchema.parse({
        ...req.body,
        clientId
      });
      const saved = await saveClientProfile(profile);
      sendJson(res, 200, { status: 'ok', profile: saved });
    })
  );

  app.get('/api/admin/schema-catalog', (_req, res) => {
    sendJson(res, 200, { status: 'ok', catalog: getAdminSchemaCatalog() });
  });

  app.get('/api/admin/journey-questions', (req, res) => {
    const productType = queryProductType(req);
    sendJson(res, 200, {
      status: 'ok',
      questions: structuredClone(getJourneyQuestions(productType))
    });
  });

  app.put(
    '/api/admin/journey-questions',
    wrapAsync(async (req, res) => {
      const productType = queryProductType(req);
      const questions = validateAdminJourneyQuestions(req.body?.questions ?? req.body);
      replaceJourneyQuestions(productType, questions);
      const mongoOk = await replaceJourneyQuestionsInMongo(productType, questions);
      sendJson(res, 200, {
        status: 'ok',
        questions: structuredClone(getJourneyQuestions(productType)),
        persisted: mongoOk ? 'mongo' : 'memory'
      });
    })
  );

  app.get('/api/admin/recommendation-rules', (req, res) => {
    const productType = queryProductType(req);
    sendJson(res, 200, {
      status: 'ok',
      rules: structuredClone(getRecommendationRules(productType))
    });
  });

  app.put(
    '/api/admin/recommendation-rules',
    wrapAsync(async (req, res) => {
      const productType = queryProductType(req);
      const rules = validateAdminRecommendationRules(req.body?.rules ?? req.body);
      const saved = await saveRecommendationRulesToStore(rules, productType);
      sendJson(res, 200, { status: 'ok', rules: saved, persisted: 'file' });
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
