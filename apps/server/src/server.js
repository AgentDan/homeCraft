import { createApp } from './app.js';
import { warnProductionClientDistMissing } from './core/api/middleware.js';
import { isProduction, runtimeConfig, runtimeLabel } from './config/runtime.js';
import { ensureStorage } from './storage/local-storage.js';
import { ensureJourneyQuestions } from './storage/mongo.js';
import { ensureRecommendationRulesLoaded } from './storage/recommendation-rules-store.js';
import { replaceJourneyQuestions } from './core/journey-table.js';
import { kitchenManifest } from '@homecraft/manifests/kitchen';

// Kitchen is the initial active domain (see index.js registry.initDomain('kitchen', ...)).
const DEFAULT_JOURNEY_QUESTIONS = kitchenManifest.journeyQuestions;

export async function startServer() {
  if (isProduction) {
    warnProductionClientDistMissing();
  }

  try {
    const { root } = await ensureStorage();
    console.log(`[storage] ready: ${root}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[storage] failed to initialize storage: ${msg}`);
    console.error(
      '[storage] Check permissions for apps/server/data or set SERVER_STORAGE_DIR.'
    );
  }

  try {
    const fromMongo = await ensureJourneyQuestions(DEFAULT_JOURNEY_QUESTIONS);
    if (fromMongo?.length) {
      replaceJourneyQuestions(fromMongo);
      console.log(`[journey] loaded ${fromMongo.length} questions from MongoDB`);
    } else {
      console.log(
        `[journey] using in-memory seed (${DEFAULT_JOURNEY_QUESTIONS.length} questions)`
      );
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[journey] Mongo seed skipped; using in-memory table: ${msg}`);
  }

  try {
    const rules = await ensureRecommendationRulesLoaded();
    console.log(`[dp4] loaded ${rules.length} recommendation rules`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[dp4] rules load skipped: ${msg}`);
  }

  const { port, host } = runtimeConfig;
  const app = createApp();

  await new Promise((resolve, reject) => {
    const httpServer = app.listen(port, host, () => {
      console.log(`[${runtimeLabel()}] Server: http://${host}:${port}`);
      resolve(httpServer);
    });
    httpServer.on('error', reject);
  });
}
