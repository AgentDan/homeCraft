# Step 0 — Foundation

Phase 0 deliverable for [Roadmap.md](./Roadmap.md). **Status: completed.**

## Completed in Step 0

- [x] npm workspaces monorepo (JavaScript ESM, without TypeScript)
- [x] `@homecraft/contracts` — Zod schemas
- [x] `@homecraft/ai` — IntentRegistry (English-only, no silent fallback)
- [x] `@homecraft/catalog-schema` — catalog validator stub
- [x] Server skeleton + working `POST /api/commands`
- [x] Unified dialog-only request contract (`command` + `inputChannel`, without a manual editor)
- [x] Production deploy (`build:deploy`, `npm start`, SPA + API)
- [x] Client shell (CommandInput + chat HUD + 3D preview) + Tailwind CSS v4
- [x] Mobile stub
- [x] CI workflow (lint, test, build)
- [x] `local-storage.js` (AIproject pattern)

## Verify

```bash
npm install
npm run lint
npm run test
npm run dev
# POST http://localhost:3001/api/commands with valid ClientRequest JSON
```

Production smoke:

```bash
npm run build:deploy
NODE_ENV=production npm start
# http://localhost:3001 — SPA + /api/health
```

## After Step 0

Phase 1 is now complete. See Roadmap § "Phase 1. Dialog MVP + Kitchen demo" for the implemented catalog, RAG, plan, compatibility, BOM, and 3D scope.
