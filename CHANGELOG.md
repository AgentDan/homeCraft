# Changelog

## 2026-08-09

- **Ф1 Typed questions:** `JourneyQuestionSchema` + `validateAnswer`; 4 legacy slots migrated + 5 new (`hasKidsOrPets`…`budgetEur`); `dependsOn` skip for facade; Mongo `journey_questions` with in-memory fallback. Files: `packages/contracts/src/journey-question.js`, `apps/server/src/core/journey-table.js`, `apps/server/src/storage/mongo.js`, `apps/server/src/server.js`, `apps/server/src/i18n/messages.js`.
- **Ф0 Observation:** contracts `DialogTurn` / `BehaviorSignal` / `Outcome`; unified `observation.jsonl` timeline (`clientId`+`ts`+`seq`, journey events included); API `POST /api/observation/signals|outcomes`, `GET /api/observation/:clientId/timeline`; client `VariantOptions` emits the four configurator signals. Files: `packages/contracts/src/observation.js`, `apps/server/src/storage/journey-events.js`, `apps/server/src/core/api/routes.js`, `apps/server/src/core/orchestrator.js`, `apps/client/src/components/VariantOptions.jsx`.
