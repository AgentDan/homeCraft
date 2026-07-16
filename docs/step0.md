# Step 0 — Foundation

Phase 0 deliverable for [Roadmap.md](./Roadmap.md).

## Done in step0

- [x] npm workspaces monorepo
- [x] `@homecraft/contracts` — Zod schemas
- [x] `@homecraft/ai` — IntentRegistry (RU, no silent fallback)
- [x] `@homecraft/catalog-schema` — catalog validator stub
- [x] Server skeleton + working `POST /api/commands`
- [x] Client shell (CommandInput + ResultViewer)
- [x] Mobile stub
- [x] Docker Compose (MongoDB + Redis)
- [x] CI workflow
- [x] `local-storage.ts` (AIproject pattern)

## Verify

```bash
npm install
npm run lint
npm run test
npm run dev
# POST http://localhost:3001/api/commands with valid ClientRequest JSON
```

## Next: Phase 1

See Roadmap § «Фаза 1. MVP диалога + Kitchen demo».
