import './config/load-env.js';

import { registry } from '@homecraft/contracts';
import { kitchenManifest } from '@homecraft/manifests/kitchen';
import { deskManifest } from '@homecraft/manifests/desk';
import { replaceJourneyQuestions } from './core/journey-table.js';
import { replaceRecommendationRules } from './core/recommendation-engine.js';
import { startServer } from './server.js';

// Регистрация всех доменов
registry.register(kitchenManifest);
registry.register(deskManifest);

// Активный домен при старте — kitchen
registry.initDomain('kitchen', {
  onJourneyQuestions: replaceJourneyQuestions,
  onDp4Rules: replaceRecommendationRules
});

console.log(`[HomeCraft] Registered domains: ${registry.registeredTypes().join(', ')}`);
console.log(
  `[HomeCraft] Active domain: kitchen`,
  `| questions: ${kitchenManifest.journeyQuestions.length}`,
  `| dp4Rules: ${kitchenManifest.dp4Rules.length}`
);

startServer().catch((err) => {
  console.error(err);
  process.exit(1);
});
