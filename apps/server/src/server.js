import { createApp } from './app.js';
import { warnProductionClientDistMissing } from './core/api/middleware.js';
import { isProduction, runtimeConfig, runtimeLabel } from './config/runtime.js';
import { registry } from '@homecraft/contracts';
import { ensureStorage } from './storage/local-storage.js';
import { ensureJourneyQuestions } from './storage/mongo.js';
import { ensureRecommendationRulesLoaded } from './storage/recommendation-rules-store.js';
import { replaceJourneyQuestions } from './core/journey-table.js';

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

  // index.js registers + initDomain()s every type before startServer() is called.
  for (const productType of registry.registeredTypes()) {
    const manifest = registry.get(productType);
    try {
      const fromMongo = await ensureJourneyQuestions(
        productType,
        manifest.journeyQuestions
      );
      if (fromMongo?.length) {
        replaceJourneyQuestions(productType, fromMongo);
        console.log(
          `[journey] ${productType}: loaded ${fromMongo.length} questions from MongoDB`
        );
      } else {
        replaceJourneyQuestions(productType, manifest.journeyQuestions);
        console.log(
          `[journey] ${productType}: using in-memory seed (${manifest.journeyQuestions.length} questions)`
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      replaceJourneyQuestions(productType, manifest.journeyQuestions);
      console.warn(
        `[journey] ${productType}: Mongo seed skipped; using in-memory table: ${msg}`
      );
    }

    try {
      const rules = await ensureRecommendationRulesLoaded(productType);
      console.log(
        `[dp4] ${productType}: loaded ${rules.length} recommendation rules`
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[dp4] ${productType}: rules load skipped: ${msg}`);
    }
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
