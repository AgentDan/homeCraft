import { Router } from 'express';
import { route } from '../orchestrator.js';
import { getStorageStatus } from '../../storage/local-storage.js';
import { connectMongo } from '../../storage/mongo.js';
import { errorHandler, parseClientRequest } from './middleware.js';

export const apiRouter = Router();

apiRouter.get('/health', async (_req, res) => {
  const storage = await getStorageStatus();
  const mongo = await connectMongo();
  res.json({
    status: 'ok',
    service: 'homecraft-server',
    step: '0',
    storage,
    mongo: mongo ? 'connected' : 'disconnected'
  });
});

apiRouter.post('/commands', async (req, res, next) => {
  try {
    const clientRequest = parseClientRequest(req.body);
    const result = await route(clientRequest);
    res.status(result.statusCode).json(result.response);
  } catch (error) {
    next(error);
  }
});

apiRouter.use(errorHandler);
