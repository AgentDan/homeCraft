# Step 0 — Foundation

Phase 0 deliverable for [Roadmap.md](./Roadmap.md). **Status: completed.**

## Done in step0

- [x] npm workspaces monorepo (JavaScript ESM, без TypeScript)
- [x] `@homecraft/contracts` — Zod schemas
- [x] `@homecraft/ai` — IntentRegistry (RU, no silent fallback)
- [x] `@homecraft/catalog-schema` — catalog validator stub
- [x] Server skeleton + working `POST /api/commands`
- [x] Production deploy (`build:deploy`, `npm start`, SPA + API)
- [x] Client shell (CommandInput + ResultViewer) + Tailwind CSS v4
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

## Next: Phase 1

See Roadmap § «Фаза 1. MVP диалога + Kitchen demo».
