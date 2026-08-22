import './config/load-env.js';

import { registry } from '@homecraft/contracts';
import { allManifests } from '@homecraft/manifests';
import { replaceJourneyQuestions } from './core/journey-table.js';
import { replaceRecommendationRules } from './core/recommendation-engine.js';
import { startServer } from './server.js';

// Регистрация всех доменов — must run before startServer() so the per-domain
// seed loop in server.js can call registry.registeredTypes() / registry.get().
for (const manifest of allManifests) {
  registry.register(manifest);
}

for (const productType of registry.registeredTypes()) {
  registry.initDomain(productType, {
    onJourneyQuestions: (questions) => replaceJourneyQuestions(productType, questions),
    onDp4Rules: (rules) => replaceRecommendationRules(productType, rules)
  });
}

console.log(`[HomeCraft] Registered domains: ${registry.registeredTypes().join(', ')}`);
for (const productType of registry.registeredTypes()) {
  const manifest = registry.get(productType);
  console.log(
    `[HomeCraft] Domain ${productType}`,
    `| questions: ${manifest.journeyQuestions.length}`,
    `| dp4Rules: ${manifest.dp4Rules.length}`
  );
}

startServer().catch((err) => {
  console.error(err);
  process.exit(1);
});
