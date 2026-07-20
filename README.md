# HomeCraft

An AI platform for conversationally assembling furniture projects from a manufacturer's catalog.

The architectural foundation follows [AIproject](https://github.com/AgentDan/AIproject): an orchestrator, RAG, and deterministic domain modules. The furniture domain adds a Compatibility Engine, Pricing, BOM, and production export.

**Current status:** Phase 1 is complete — demo catalog, file-vector RAG, rule-based plans, 3D preview, compatibility, BOM, and multi-turn dialog.

Dialog input accepts text or a voice transcript through a single `command`; `inputChannel` only identifies the source (`text`/`voice`). Commands are converted into a cumulative `ConfigurationPlan`, validated by the Compatibility Engine, visualized in R3F, and calculated as a BOM. Plan versions support undo/redo.

---

## Stack

| Layer | Technology |
|-------|------------|
| Language | JavaScript (ESM), without TypeScript |
| API | Node.js 20 + Express 5 + Zod |
| Client | React 19 + Vite + Tailwind CSS v4 |
| Database | MongoDB (lazy connection) |
| Files | `apps/server/data/` — following AIproject |
| Monorepo | npm workspaces |

---

## Quick start (development)

```bash
cp .env.example .env
npm install
npm run dev
```

| Service | URL |
|---------|-----|
| API | http://localhost:3001 |
| Client (Vite) | http://localhost:5173 |
| Health | http://localhost:3001/api/health |

Development mode runs the API and client separately (Vite proxy → `/api`).

---

## Production deployment (following AIproject)

```bash
cp .env.example .env
# In .env: NODE_ENV=production, CORS_ORIGIN=https://your-domain.com

npm install
npm run build:deploy
npm start
```

One process listens on `HOST:PORT` (`0.0.0.0:3001` by default):

- **API** — `/api/*`
- **SPA** — static files from `apps/client/dist` (fallback to `index.html`)
- **GLTF** — `/gltf` from `apps/server/gltf`
- **Sessions** — `apps/server/data/` or `SERVER_STORAGE_DIR`

---

## Environment variables

Use the **`.env` file at the monorepo root** (template: `.env.example`):

```bash
PORT=3001
HOST=0.0.0.0
NODE_ENV=development

MONGODB_URI=mongodb://localhost:27017/homecraft
MONGODB_TIMEOUT_MS=500

# SERVER_STORAGE_DIR=       # defaults to apps/server/data
# CORS_ORIGIN=              # production
# CLIENT_DIST_PATH=         # defaults to apps/client/dist
```

Loaded by `apps/server/src/config/load-env.js`.

---

## Pipeline

```
POST /api/commands
  → orchestrator.route()              # dialog command
    → room-context-builder
      → ai-services/pipeline
        → intent-detector             [AI]
        → catalog-rag-retriever       [file vector index]
        → configuration-plan-generator [rule-based]
      → assertCompatible()            [only rejection stage]
      → domain-modules/kitchen/runPipeline()
      → calculateBOM()
    → output-builder → ClientResponse
```

---

## Monorepo structure

```
apps/
  client/          React + Vite + Tailwind + R3F
  server/          Express API, orchestrator, engines, storage
  mobile/          stub (Phase 6)
packages/
  contracts/       Zod schemas (ClientRequest, ConfigurationPlan, BOM, …)
  ai/              English-only IntentRegistry (`matchIntent`)
  catalog-schema/  Zod schema for manufacturer catalogs
docs/
  Roadmap.md       development phases
  step0.md         Phase 0 results
```

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Server (nodemon, `src/` only) + client (Vite) |
| `npm run dev:server` | API only |
| `npm run dev:client` | Client only |
| `npm run build` | Build client → `apps/client/dist` |
| `npm run build:deploy` | Same build for deployment |
| `npm start` | Production server |
| `npm run test` | Smoke tests (all workspaces) |
| `npm run lint` | ESLint |
| `npm run catalog:index` | Rebuild the catalog/platform-rules vector index and seed MongoDB |

---

## API (Phase 1)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Brief health check |
| GET | `/api/health` | Health + storage + MongoDB |
| GET | `/api` | Endpoint list |
| GET | `/api/storage/status` | Local storage status |
| POST | `/api/commands` | Main pipeline |

---

## Documentation

- [docs/Roadmap.md](docs/Roadmap.md) — development phases
- [docs/step0.md](docs/step0.md) — work completed in Phase 0
- [CONTRIBUTING.md](CONTRIBUTING.md) — invariants and code review
- [docs/dialog-flow.md](docs/dialog-flow.md) — dialog flow and API
