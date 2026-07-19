# HomeCraft — Roadmap

> **HomeCraft** — an AI platform for conversationally assembling furniture projects from a real manufacturer catalog.
> The architectural foundation is [AIproject](https://github.com/AgentDan/AIproject); the furniture domain adds a Compatibility Engine, Pricing, BOM, and production export.

**Status:** ✅ **Phase 1 complete** (dialog MVP, kitchen demo, 3D, BOM, compatibility).
**Next step:** **Phase 2** — expand the Compatibility Engine.
**Target MVP:** 4–5 months with a team of 2–3 people.
**Principle:** contract-first (Zod), skeleton → logic file by file, with no dead pipeline stages.

---

## Contents

1. [Current state (Phases 0–1)](#1-current-state-phases-01)
2. [How HomeCraft follows AIproject](#2-how-homecraft-follows-aiproject)
3. [Architecture invariants](#3-architecture-invariants)
4. [Current monorepo structure](#4-current-monorepo-structure)
5. [Stack and infrastructure](#5-stack-and-infrastructure)
6. [Development phases](#6-development-phases)
7. [Mapping: AIproject → HomeCraft](#7-mapping-aiproject--homecraft)
8. [Metrics and Definition of Done](#8-metrics-and-definition-of-done)
9. [Risks](#9-risks)
10. [Open decisions](#10-open-decisions)

---

## 1. Current state (Phases 0–1)

### Implemented

| Component | Status |
|-----------|--------|
| npm workspaces monorepo | ✅ |
| `packages/contracts` — Zod schemas | ✅ |
| `packages/ai` — English-only IntentRegistry | ✅ |
| `packages/catalog-schema` — validator stub | ✅ |
| Server skeleton + `POST /api/commands` | ✅ |
| Dialog orchestrator → unified pipeline | ✅ |
| `local-storage.js` (AIproject pattern) | ✅ |
| MongoDB lazy connect | ✅ |
| Client: CommandInput + ResultViewer + Tailwind | ✅ |
| Mobile stub | ✅ |
| Production deploy: `build:deploy` + `npm start` | ✅ |
| SPA + API on one port (production) | ✅ |
| CI: lint + test + build | ✅ |

### Implemented in Phase 1

- demo catalog of 18 kitchen modules, snapshot, and MongoDB seed;
- file-based vector index and catalog/platform-rules retrieval;
- rule-based `configuration-plan-generator`;
- three basic compatibility checks plus a spatial index;
- real BOM from a frozen snapshot;
- deterministic kitchen scene and R3F Preview3D;
- local and MongoDB context persistence, multi-turn dialog;
- Help service and English intent corpus.

Details: [docs/step0.md](step0.md).

---

## 2. How HomeCraft follows AIproject

| Aspect | AIproject | HomeCraft (current) |
|--------|-----------|---------------------|
| Language | JavaScript ESM | JavaScript ESM |
| Domain | 3D/product scenes | Furniture (kitchen → …) |
| Input | Dialog only | Dialog only |
| AI | Intent + RAG → ActionPlan | Intent + RAG → ConfigurationPlan |
| Determinism | Scene Modules | Compatibility + Pricing + domain pipeline |
| Files | `apps/server/data/` | `apps/server/data/` (same pattern) |
| Deploy | server.js + static dist | server.js + static dist (Express 5) |
| Database | — | MongoDB (added) |
| Contracts | JS validators | **Zod** in `@homecraft/contracts` |
| Client | React + Vite | React 19 + Vite + **Tailwind v4** |

**Carried over from AIproject:**

- orchestrator → context builder → AI pipeline → domain modules → output builder
- the LLM does not mutate the scene or price — only the plan
- `local-storage`, `/gltf`, `load-env`, `mountRoutes`, production SPA
- npm workspaces, `POST /api/commands`

**New in HomeCraft:**

- Compatibility Engine, Pricing Engine, catalog-schema
- RoomContext, ConfigurationPlan, BOM
- MongoDB for the catalog and project context, with a local fallback

---

## 3. Architecture invariants

See [CONTRIBUTING.md](../CONTRIBUTING.md). In brief:

1. Dialog is the only input path: command → one `ConfigurationPlan` → one downstream pipeline.
2. Only `assertCompatible()` may reject a plan.
3. `calculateBOM()` is a pure calculator and does not block based on budget.
4. English-only intents, with no silent fallback → `UnknownIntent`.
5. `catalog-rag-retriever` is connected to `configuration-plan-generator`.
6. Catalog snapshots provide stable prices.
7. Compatibility uses a spatial index (not O(n²)).
8. Zod is used at API and storage boundaries.
9. Use `structuredClone`, not `JSON.parse(JSON.stringify(...))`.
10. UI: font-weight 400/500, sentence case (Tailwind).

---

## 4. Current monorepo structure

```
homecraft/
├── apps/
│   ├── client/
│   │   ├── src/
│   │   │   ├── App.jsx
│   │   │   ├── main.jsx
│   │   │   ├── index.css              # Tailwind v4
│   │   │   ├── api/client.js
│   │   │   └── components/
│   │   │       ├── CommandInput.jsx   # dialog input
│   │   │       └── ResultViewer.jsx
│   │   └── vite.config.js
│   ├── mobile/                        # stub
│   └── server/
│       ├── src/
│       │   ├── index.js               # load-env → startServer
│       │   ├── server.js
│       │   ├── app.js
│       │   ├── config/
│       │   │   ├── load-env.js
│       │   │   └── runtime.js
│       │   ├── core/
│       │   │   ├── orchestrator.js
│       │   │   ├── room-context-builder.js
│       │   │   ├── output-builder.js
│       │   │   └── api/
│       │   │       ├── routes.js      # mountRoutes
│       │   │       └── middleware.js
│       │   ├── ai-services/
│       │   ├── compatibility-engine/
│       │   ├── pricing-engine/
│       │   ├── domain-modules/
│       │   ├── production-export/
│       │   ├── knowledge-base/
│       │   ├── storage/
│       │   │   ├── local-storage.js
│       │   │   └── mongo.js
│       │   └── lib/send-json.js
│       ├── data/                      # sessions, exports, …
│       └── gltf/
├── packages/
│   ├── contracts/src/*.js             # Zod schemas
│   ├── ai/src/
│   └── catalog-schema/src/
├── docs/
│   ├── Roadmap.md
│   ├── step0.md
│   └── dialog-flow.md
├── .env.example
├── eslint.config.js
└── package.json
```

**Planned (Phases 1–6):** `Preview3D.jsx`, R3F, full RAG indexer, MongoDB persistence.

---

## 5. Stack and infrastructure

| Layer | Technology | Status |
|-------|------------|--------|
| Runtime | Node.js 20 | ✅ |
| API | Express 5 + Zod | ✅ |
| Client | React 19 + Vite + Tailwind v4 | ✅ shell |
| Client 3D | React Three Fiber + Zustand | ✅ Preview3D |
| Mobile | Expo | stub, Phase 6 |
| Database | MongoDB (local or remote, `MONGODB_URI`) | ✅ + local fallback |
| Cache | Redis | Phase 3 |
| Files | `apps/server/data/` | ✅ |
| RAG index | file vector store | ✅ |
| CI | lint + test + build | ✅ |

### Environment variables

```bash
# .env at the monorepo root
PORT=3001
HOST=0.0.0.0
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/homecraft
# SERVER_STORAGE_DIR=
# CORS_ORIGIN=
# CLIENT_DIST_PATH=
```

### Commands

```bash
npm install
npm run dev              # server + client
npm run build:deploy     # client → dist
npm start                # production (API + SPA)
npm run test
npm run lint
npm run catalog:index    # rebuild catalog and platform-rules index
```

---

## 6. Development phases

### ✅ Phase 0. Foundation — COMPLETE

**Goal:** monorepo, contracts, end-to-end pipeline, deployment.

| # | Task | Status |
|---|------|--------|
| 0.1 | npm workspaces | ✅ |
| 0.2 | JavaScript ESM (without TSC) | ✅ |
| 0.3 | ESLint + ban JSON clone | ✅ |
| 0.4 | Zod schemas in contracts | ✅ |
| 0.5 | English-only IntentRegistry | ✅ |
| 0.6 | catalog-schema stub | ✅ |
| 0.7 | Server skeleton | ✅ |
| 0.8 | POST /api/commands + Zod | ✅ |
| 0.9 | Dialog orchestrator | ✅ |
| 0.10 | Client shell + Tailwind | ✅ |
| 0.11 | Mobile stub | ✅ |
| 0.12 | README, CONTRIBUTING, .env.example | ✅ |
| 0.13 | CI (lint, test, build) | ✅ |
| 0.14 | local-storage.js | ✅ |
| 0.15 | Production deployment (following AIproject) | ✅ |

**Acceptance criteria:** all complete — see [step0.md](step0.md).

---

### ✅ Phase 1. Dialog MVP + Kitchen demo

**Goal:** dialog → plan from the demo catalog, 3D preview, basic compatibility.

| # | Task | Status |
|---|------|--------|
| 1.1 | Demo kitchen catalog (15–25 modules) → MongoDB | ✅ 18 modules |
| 1.2 | Catalog indexer + file vector store (`npm run catalog:index`) | ✅ |
| 1.3 | 7 English intents in intent-detector | ✅ |
| 1.4 | catalog-rag-retriever — real top-K | ✅ |
| 1.5 | configuration-plan-generator — rule-based | ✅ |
| 1.6 | room-context-builder — persist MongoDB | ✅ + local fallback |
| 1.7 | kitchen/runPipeline — module positions | ✅ |
| 1.8 | assertCompatible — 3 basic rules | ✅ |
| 1.9 | calculateBOM — total from snapshot | ✅ |
| 1.10 | output-builder — complete ClientResponse | ✅ |
| 1.11 | Client: Preview3D (R3F) | ✅ |
| 1.12 | Client: multi-turn dialog | ✅ |
| 1.13 | Help service | ✅ |
| 1.14 | platform-rules RAG | ✅ |

**7 MVP intents:** `add_module`, `remove_module`, `change_finish`, `set_budget`, `show_price`, `help`, `unknown`.

**Acceptance:** ✅ "3×4 kitchen" → plan + 3D; catalog-grounded RAG; overlap → `valid: false`; intent accuracy ≥ 85% across 53 phrases; measured P95 of 411 ms ≤ 800 ms.

---

### Phase 2. Compatibility Engine (2–3 weeks)

Spatial index, rules (mounting, utilities, clearances), analog suggester, conflict UI.

### Phase 3. Pricing & BOM (2 weeks)

Catalog snapshots, Redis cache, BOM table, and a budget indicator in the client.

### Phase 4. Production Export (2–3 weeks)

PDF specification, export to `data/exports/`, and download API.

### Phase 5. Production LLM (3–4 weeks)

llm-client, function calling, multi-turn, and evaluation across 200 English phrases.

### Phase 6. Scaling and platforms

Wardrobe domain, Expo mobile, multi-tenant, real catalog ETL.

---

## 7. Mapping: AIproject → HomeCraft

| AIproject | HomeCraft | Status |
|-----------|-----------|--------|
| `core/orchestrator.js` | `core/orchestrator.js` | ✅ dialog-only |
| `scene-context-builder.js` | `room-context-builder.js` | ✅ persisted |
| `output-builder.js` | `output-builder.js` | ✅ extended |
| `core/api/routes.js` | `core/api/routes.js` | ✅ mountRoutes |
| `core/api/middleware.js` | `core/api/middleware.js` | ✅ + Zod |
| `config/load-env.js` | `config/load-env.js` | ✅ |
| `server.js` | `server.js` | ✅ |
| `storage/local-storage.js` | `storage/local-storage.js` | ✅ |
| `ai-services/pipeline.js` | `ai-services/pipeline.js` | ✅ |
| `packages/contracts` | `packages/contracts` (Zod) | ✅ |
| `packages/ai/IntentRegistry` | `packages/ai/intent-registry.js` | ✅ |
| — | `compatibility-engine/*` | ✅ basic rules |
| — | `pricing-engine/*` | ✅ snapshot BOM |
| — | `catalog-schema/*` | ✅ stub |
| — | `storage/mongo.js` | ✅ connect |

---

## 8. Metrics and Definition of Done

| Metric | Target | Starting phase |
|--------|--------|----------------|
| P95 pipeline (without LLM) | ≤ 800 ms | 1 |
| Compatibility hit-rate | ≥ 70% | 2 |
| English intent accuracy | ≥ 90% | 5 |
| BOM cache hit-rate | ≥ 60% | 3 |

**DoD for each phase:**

- [ ] Acceptance criteria are met
- [ ] `npm run lint`, `npm run test`, and `npm run build` pass
- [ ] README / Roadmap are current
- [ ] All 10 invariants are preserved

---

## 9. Risks

| Risk | Mitigation |
|------|------------|
| Unclean catalogs | `catalog-schema/normalizer.js` + ETL |
| LLM hallucinates SKUs | RAG-only + Zod boundary |
| O(n²) compatibility | spatial index from Phase 2 |
| Express 5 vs AIproject Express 4 | SPA fallback through middleware, not `*` |

---

## 10. Open decisions

| # | Question | Decision | When |
|---|----------|----------|------|
| 1 | Vector search | File index (following AIproject) | ✅ MVP |
| 2 | Code language | JavaScript ESM + Zod | ✅ Phase 0 |
| 3 | npm scope | `@homecraft/*` | ✅ Phase 0 |
| 4 | Plan format | JSON + Zod | ✅ Phase 0 |
| 5 | LLM provider | Feature flag, stub | Phase 5 |
| 6 | Auth | JWT → OAuth2 | Phase 6d |
| 7 | Demo catalog | Synthetic JSON, 18 kitchen modules | ✅ Phase 1 |
| 8 | Input model | Dialog only; manual editor excluded | ✅ |

---

## Timeline

```
         ✅ done   → next
Week     1–2    3–6      7–9      10–11    12–14    15–18    19+
         ├──────┼────────┼────────┼────────┼────────┼────────┼────→
Phase    0      1        2        3        4        5        6
```

**Pilot MVP:** end of Phase 4.

**Next step:** [Phase 2](#phase-2-compatibility-engine-23-weeks).

---

## Related documents

- [step0.md](step0.md) — Phase 0 results
- [dialog-flow.md](dialog-flow.md) — dialog flow and API
- [AIproject](https://github.com/AgentDan/AIproject)
- [README.md](../README.md)
