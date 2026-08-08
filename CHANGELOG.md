# Changelog

## 2026-08-09

- **Ф0 Observation:** contracts `DialogTurn` / `BehaviorSignal` / `Outcome`; unified `observation.jsonl` timeline (`clientId`+`ts`+`seq`, journey events included); API `POST /api/observation/signals|outcomes`, `GET /api/observation/:clientId/timeline`; client `VariantOptions` emits the four configurator signals. Files: `packages/contracts/src/observation.js`, `apps/server/src/storage/journey-events.js`, `apps/server/src/core/api/routes.js`, `apps/server/src/core/orchestrator.js`, `apps/client/src/components/VariantOptions.jsx`.
