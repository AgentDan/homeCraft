# HomeCraft — Roadmap

> **HomeCraft** — AI-платформа для диалоговой сборки мебельных проектов из реального каталога производителя.
> Архитектурный каркас — [AIproject](https://github.com/AgentDan/AIproject); домен мебели: Compatibility Engine, Pricing, BOM, production export.

**Статус:** ✅ **Фаза 1 завершена** (MVP диалога, kitchen demo, 3D, BOM, compatibility).
**Следующий шаг:** **Фаза 2** — расширение Compatibility Engine.
**Целевой MVP:** 4–5 месяцев при команде 2–3 человека.
**Принцип:** contract-first (Zod), skeleton → logic file-by-file, без «мёртвых» стадий пайплайна.

---

## Содержание

1. [Текущее состояние (фазы 0–1)](#1-текущее-состояние-фазы-01)
2. [Чем HomeCraft похож на AIproject](#2-чем-homecraft-похож-на-aiproject)
3. [Архитектурные инварианты](#3-архитектурные-инварианты)
4. [Структура монорепозитория (факт)](#4-структура-монорепозитория-факт)
5. [Стек и инфраструктура](#5-стек-и-инфраструктура)
6. [Фазы разработки](#6-фазы-разработки)
7. [Маппинг: AIproject → HomeCraft](#7-маппинг-aiproject--homecraft)
8. [Метрики и Definition of Done](#8-метрики-и-definition-of-done)
9. [Риски](#9-риски)
10. [Открытые решения](#10-открытые-решения)

---

## 1. Текущее состояние (фазы 0–1)

### Реализовано

| Компонент | Статус |
|-----------|--------|
| npm workspaces monorepo | ✅ |
| `packages/contracts` — Zod-схемы | ✅ |
| `packages/ai` — IntentRegistry RU/EN | ✅ |
| `packages/catalog-schema` — validator stub | ✅ |
| Server skeleton + `POST /api/commands` | ✅ |
| Диалоговый orchestrator → единый pipeline | ✅ |
| `local-storage.js` (AIproject pattern) | ✅ |
| MongoDB lazy connect | ✅ |
| Client: CommandInput + ResultViewer + Tailwind | ✅ |
| Mobile stub | ✅ |
| Production deploy: `build:deploy` + `npm start` | ✅ |
| SPA + API на одном порту (production) | ✅ |
| CI: lint + test + build | ✅ |

### Реализовано в фазе 1

- демо-каталог из 18 kitchen-модулей, snapshot и MongoDB seed;
- файловый vector index и catalog/platform-rules retrieval;
- rule-based `configuration-plan-generator`;
- три базовые проверки compatibility + spatial index;
- реальный BOM по frozen snapshot;
- детерминированная kitchen scene и Preview3D на R3F;
- локальная и MongoDB persistence контекста, multi-turn dialog;
- Help service и RU intent corpus.

Подробности: [docs/step0.md](step0.md).

---

## 2. Чем HomeCraft похож на AIproject

| Аспект | AIproject | HomeCraft (сейчас) |
|--------|-----------|-------------------|
| Язык | JavaScript ESM | JavaScript ESM |
| Домен | 3D/product-сцены | Мебель (кухня → …) |
| Ввод | Только диалог | Только диалог |
| AI | Intent + RAG → ActionPlan | Intent + RAG → ConfigurationPlan |
| Детерминизм | Scene Modules | Compatibility + Pricing + domain pipeline |
| Файлы | `apps/server/data/` | `apps/server/data/` (тот же паттерн) |
| Deploy | server.js + static dist | server.js + static dist (Express 5) |
| БД | — | MongoDB (добавлено) |
| Контракты | JS validators | **Zod** в `@homecraft/contracts` |
| Client | React + Vite | React 19 + Vite + **Tailwind v4** |

**Перенесено из AIproject:**

- orchestrator → context builder → AI pipeline → domain modules → output builder
- LLM не мутирует сцену/цену — только план
- `local-storage`, `/gltf`, `load-env`, `mountRoutes`, production SPA
- npm workspaces, `POST /api/commands`

**Новое в HomeCraft:**

- Compatibility Engine, Pricing Engine, catalog-schema
- RoomContext, ConfigurationPlan, BOM
- MongoDB для каталога и контекста проекта с local fallback

---

## 3. Архитектурные инварианты

См. [CONTRIBUTING.md](../CONTRIBUTING.md). Кратко:

1. Диалог — единственный путь ввода: команда → один `ConfigurationPlan` → один downstream pipeline.
2. Только `assertCompatible()` может отклонить план.
3. `calculateBOM()` — чистый калькулятор, без блокировки по бюджету.
4. RU-first intent, без silent fallback → `UnknownIntent`.
5. `catalog-rag-retriever` подключён к `configuration-plan-generator`.
6. Catalog snapshot для стабильных цен.
7. Spatial index в compatibility (не O(n²)).
8. Zod на границах API и storage.
9. `structuredClone`, не `JSON.parse(JSON.stringify(...))`.
10. UI: font-weight 400/500, sentence case (Tailwind).

---

## 4. Структура монорепозитория (факт)

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

**Планируется (фазы 1–6):** `Preview3D.jsx`, R3F, полный RAG indexer, MongoDB persist.

---

## 5. Стек и инфраструктура

| Слой | Технология | Статус |
|------|------------|--------|
| Runtime | Node.js 20 | ✅ |
| API | Express 5 + Zod | ✅ |
| Client | React 19 + Vite + Tailwind v4 | ✅ shell |
| Client 3D | React Three Fiber + Zustand | ✅ Preview3D |
| Mobile | Expo | stub, фаза 6 |
| БД | MongoDB (локально или удалённо, `MONGODB_URI`) | ✅ + local fallback |
| Кэш | Redis | фаза 3 |
| Файлы | `apps/server/data/` | ✅ |
| RAG index | file vector store | ✅ |
| CI | lint + test + build | ✅ |

### Переменные окружения

```bash
# .env в корне монорепо
PORT=3001
HOST=0.0.0.0
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/homecraft
# SERVER_STORAGE_DIR=
# CORS_ORIGIN=
# CLIENT_DIST_PATH=
```

### Команды

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

## 6. Фазы разработки

### ✅ Фаза 0. Фундамент — ЗАВЕРШЕНА

**Цель:** monorepo, контракты, pipeline end-to-end, deploy.

| # | Задача | Статус |
|---|--------|--------|
| 0.1 | npm workspaces | ✅ |
| 0.2 | JavaScript ESM (без TSC) | ✅ |
| 0.3 | ESLint + ban JSON clone | ✅ |
| 0.4 | Zod schemas в contracts | ✅ |
| 0.5 | IntentRegistry RU/EN | ✅ |
| 0.6 | catalog-schema stub | ✅ |
| 0.7 | Server skeleton | ✅ |
| 0.8 | POST /api/commands + Zod | ✅ |
| 0.9 | Диалоговый orchestrator | ✅ |
| 0.10 | Client shell + Tailwind | ✅ |
| 0.11 | Mobile stub | ✅ |
| 0.12 | README, CONTRIBUTING, .env.example | ✅ |
| 0.13 | CI (lint, test, build) | ✅ |
| 0.14 | local-storage.js | ✅ |
| 0.15 | Production deploy (как AIproject) | ✅ |

**Acceptance criteria:** все выполнены — см. [step0.md](step0.md).

---

### ✅ Фаза 1. MVP диалога + Kitchen demo

**Цель:** диалог → plan из демо-каталога, 3D-превью, базовая совместимость.

| # | Задача | Статус |
|---|--------|--------|
| 1.1 | Демо-каталог kitchen (15–25 модулей) → MongoDB | ✅ 18 модулей |
| 1.2 | Catalog indexer + file vector store (`npm run catalog:index`) | ✅ |
| 1.3 | 7 интентов RU в intent-detector | ✅ |
| 1.4 | catalog-rag-retriever — реальный top-K | ✅ |
| 1.5 | configuration-plan-generator — rule-based | ✅ |
| 1.6 | room-context-builder — persist MongoDB | ✅ + local fallback |
| 1.7 | kitchen/runPipeline — позиции модулей | ✅ |
| 1.8 | assertCompatible — 3 базовых правила | ✅ |
| 1.9 | calculateBOM — сумма по snapshot | ✅ |
| 1.10 | output-builder — полный ClientResponse | ✅ |
| 1.11 | Client: Preview3D (R3F) | ✅ |
| 1.12 | Client: multi-turn dialog | ✅ |
| 1.13 | Help service | ✅ |
| 1.14 | platform-rules RAG | ✅ |

**7 интентов MVP:** `add_module`, `remove_module`, `change_finish`, `set_budget`, `show_price`, `help`, `unknown`.

**Acceptance:** ✅ «кухня 3×4» → plan + 3D; catalog-grounded RAG; overlap → `valid: false`; intent ≥ 85% на 53 фразах; измеренный P95 411 ms ≤ 800 ms.

---

### Фаза 2. Compatibility Engine (2–3 нед)

Spatial index, rules (mounting, utilities, clearances), analog suggester, conflict UI.

### Фаза 3. Pricing & BOM (2 нед)

Catalog snapshots, Redis cache, BOM table, budget indicator в client.

### Фаза 4. Production Export (2–3 нед)

PDF spec, export в `data/exports/`, download API.

### Фаза 5. Реальная LLM (3–4 нед)

llm-client, function calling, multi-turn, eval 200 RU phrases.

### Фаза 6. Масштабирование и платформы

Wardrobe domain, Expo mobile, multi-tenant, real catalog ETL.

---

## 7. Маппинг: AIproject → HomeCraft

| AIproject | HomeCraft | Статус |
|-----------|-----------|--------|
| `core/orchestrator.js` | `core/orchestrator.js` | ✅ dialog-only |
| `scene-context-builder.js` | `room-context-builder.js` | ✅ persisted |
| `output-builder.js` | `output-builder.js` | ✅ расширен |
| `core/api/routes.js` | `core/api/routes.js` | ✅ mountRoutes |
| `core/api/middleware.js` | `core/api/middleware.js` | ✅ + Zod |
| `config/load-env.js` | `config/load-env.js` | ✅ |
| `server.js` | `server.js` | ✅ |
| `storage/local-storage.js` | `storage/local-storage.js` | ✅ |
| `ai-services/pipeline.js` | `ai-services/pipeline.js` | ✅ |
| `packages/contracts` | `packages/contracts` (Zod) | ✅ |
| `packages/ai/IntentRegistry` | `packages/ai/intent-registry.js` | ✅ |
| — | `compatibility-engine/*` | ✅ базовые правила |
| — | `pricing-engine/*` | ✅ snapshot BOM |
| — | `catalog-schema/*` | ✅ stub |
| — | `storage/mongo.js` | ✅ connect |

---

## 8. Метрики и Definition of Done

| Метрика | Цель | С фазы |
|---------|------|--------|
| P95 pipeline (без LLM) | ≤ 800 ms | 1 |
| Compatibility hit-rate | ≥ 70% | 2 |
| Intent accuracy RU | ≥ 90% | 5 |
| BOM cache hit-rate | ≥ 60% | 3 |

**DoD каждой фазы:**

- [ ] Acceptance criteria выполнены
- [ ] `npm run lint`, `npm run test`, `npm run build` — зелёные
- [ ] README / Roadmap актуальны
- [ ] 10 инвариантов не нарушены

---

## 9. Риски

| Риск | Митигация |
|------|-----------|
| Грязные каталоги | `catalog-schema/normalizer.js` + ETL |
| LLM галлюцинирует SKU | RAG-only + Zod boundary |
| O(n²) compatibility | spatial index с фазы 2 |
| Express 5 vs AIproject Express 4 | SPA fallback через middleware, не `*` |

---

## 10. Открытые решения

| # | Вопрос | Решение | Когда |
|---|--------|---------|-------|
| 1 | Vector search | File index (как AIproject) | ✅ MVP |
| 2 | Язык кода | JavaScript ESM + Zod | ✅ фаза 0 |
| 3 | npm scope | `@homecraft/*` | ✅ фаза 0 |
| 4 | Plan format | JSON + Zod | ✅ фаза 0 |
| 5 | LLM provider | Feature flag, stub | фаза 5 |
| 6 | Auth | JWT → OAuth2 | фаза 6d |
| 7 | Demo catalog | Synthetic JSON, 18 kitchen modules | ✅ фаза 1 |
| 8 | Input model | Только диалог; ручной редактор исключён | ✅ |

---

## Timeline

```
         ✅ done   → next
Неделя   1–2    3–6      7–9      10–11    12–14    15–18    19+
         ├──────┼────────┼────────┼────────┼────────┼────────┼────→
Фаза     0      1        2        3        4        5        6
```

**MVP для pilot:** конец фазы 4.

**Следующий шаг:** [Фаза 2](#фаза-2-compatibility-engine-2-3-нед).

---

## Связанные документы

- [step0.md](step0.md) — итоги фазы 0
- [dialog-flow.md](dialog-flow.md) — поток диалога и API
- [AIproject](https://github.com/AgentDan/AIproject)
- [README.md](../README.md)
