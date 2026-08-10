import './config/load-env.js';

import { registry } from '@homecraft/contracts';
import { kitchenManifest } from '@homecraft/manifests/kitchen';
import { replaceJourneyQuestions } from './core/journey-table.js';
import { replaceRecommendationRules } from './core/recommendation-engine.js';
import { startServer } from './server.js';

// 1. Регистрация манифеста
registry.register(kitchenManifest);

// 2. Инициализация домена из манифеста
registry.initDomain('kitchen', {
  onJourneyQuestions: replaceJourneyQuestions,
  onDp4Rules: replaceRecommendationRules
});

console.log(
  `[HomeCraft] Manifest registered: ${kitchenManifest.productType} v${kitchenManifest.version}`,
  `| questions: ${kitchenManifest.journeyQuestions.length}`,
  `| dp4Rules: ${kitchenManifest.dp4Rules.length}`
);

startServer().catch((err) => {
  console.error(err);
  process.exit(1);
});
