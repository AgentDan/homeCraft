# HomeCraft — Roadmap создания проекта

> **HomeCraft** — AI-платформа для диалоговой сборки мебельных проектов из реального каталога производителя.
> Архитектурный каркас наследуется от [AIproject](https://github.com/AgentDan/AIproject) (orchestrator, RAG, детерминированные domain modules), расширяется доменной логикой мебели: Compatibility Engine, Pricing Engine, BOM, production export.

**Статус репозитория:** старт с нуля (есть только `docs/dommaster-presentation-and-cursor-prompt.md`).
**Целевой MVP:** 4–5 месяцев при команде 2–3 человека.
**Принцип разработки:** contract-first, skeleton → logic file-by-file, без «мёртвых» стадий пайплайна.

---

## Содержание

1. [Чем HomeCraft похож на AIproject и чем отличается](#1-чем-homecraft-похож-на-aiproject-и-чем-отличается)
2. [Архитектурные инварианты (не обсуждаются в MVP)](#2-архитектурные-инварианты)
3. [Целевая структура монорепозитория](#3-целевая-структура-монорепозитория)
4. [Стек и инфраструктура](#4-стек-и-инфраструктура)
5. [Фазы разработки](#5-фазы-разработки)
6. [Маппинг: AIproject → HomeCraft](#6-маппинг-aiproject--homecraft)
7. [Метрики и Definition of Done](#7-метрики-и-definition-of-done)
8. [Риски и митигация](#8-риски-и-митигация)
9. [Открытые решения](#9-открытые-решения)
10. [Чек-лист перед каждой фазой](#10-чек-лист-перед-каждой-фазой)

---

## 1. Чем HomeCraft похож на AIproject и чем отличается

| Аспект | AIproject | HomeCraft |
|--------|-----------|-----------|
| Домен | 3D/product-сцены, GLTF | Мебельные проекты (кухня → шкафы → др.) |
| Ввод | Только диалог (MODE A) | MODE A (чат) + MODE B (drag-and-drop редактор) |
| AI-роль | Intent + RAG → ActionPlan | Intent + RAG → ConfigurationPlan |
| Детерминизм | Scene Modules (transform, materials) | Compatibility Engine + domain pipeline + Pricing |
| Контракты | `ClientRequest`, `ActionPlan`, `SceneContext` | `ConfigurationPlan`, `RoomContext`, `BOM`, `CompatibilityReport` |
| Хранилище | Локальные файлы (`apps/server/data/`) | MongoDB + локальные файлы (`apps/server/data/`, как в AIproject) + Redis |
| Язык кода | JS (MVP) | TypeScript strict везде |
| RAG-источник | Markdown/txt в `knowledge-base/` | Эмбеддинги **каталога модулей** производителя |

**Что переносим из AIproject без переписывания идеи:**

- Паттерн **orchestrator → context builder → AI pipeline → domain modules → output builder**
- Изоляция LLM: AI только генерирует **план**, не мутирует сцену/цену напрямую
- `packages/contracts` как единый источник истины для API
- `packages/ai` с IntentRegistry
- RAG подключён к генератору плана **с первого коммита**, где стадия существует
- npm workspaces, `concurrently` для dev, Express API на `POST /api/commands`

**Что строим заново:**

- Compatibility Engine (фаервол совместимости)
- Pricing Engine + catalog snapshots
- Catalog schema + импорт производителя
- RoomContext вместо SceneContext
- 3D-клиент на R3F с мебельными модулями, не абстрактными mesh

---

## 2. Архитектурные инварианты

Эти правила фиксируются в `CONTRIBUTING.md` и проверяются на code review. Нарушение = блокер PR.

1. **Единый пайплайн.** MODE A (чат) и MODE B (редактор) сходятся в один `ConfigurationPlan` в orchestrator и дальше идут через один downstream pipeline. Параллельных code paths нет.

2. **Compatibility Engine — единственный rejector.** Только `assertCompatible()` может вернуть `valid: false` и заблокировать план. Другие стадии не отклоняют план молча.

3. **Pricing — чистый калculator.** `calculateBOM()` не блокирует по бюджету. Проверка бюджета — в presentation layer (output-builder / client).

4. **RU-first intent detection.** Нет silent fallback на default intent. Не распознали → `UnknownIntent` → уточняющий вопрос пользователю.

5. **RAG живой с первого дня.** `catalog-rag-retriever` подключён к `configuration-plan-generator`. Нет файлов «на потом».

6. **Catalog snapshot.** Проект хранит `catalogSnapshotId`. Цены в BOM читаются из снэпшота, не из live-каталога.

7. **Spatial index в compatibility.** Grid или BVH, не O(n²) pairwise check.

8. **Zod на каждой границе.** API, LLM response, catalog import, mobile ↔ server — runtime validation.

9. **`structuredClone` для клонирования.** `JSON.parse(JSON.stringify(...))` запрещён (ESLint rule).

10. **Два веса шрифта в UI:** 400 и 500. Sentence case.

---

## 3. Целевая структура монорепозитория

```
homecraft/
├── apps/
│   ├── client/                         # React 19 + Vite + R3F + Zustand
│   │   ├── src/
│   │   │   ├── api/client.ts
│   │   │   ├── components/
│   │   │   │   ├── CommandInput.tsx    # MODE A
│   │   │   │   ├── RoomEditor.tsx      # MODE B (drag-and-drop)
│   │   │   │   ├── Preview3D.tsx       # R3F превью
│   │   │   │   └── ResultViewer.tsx    # BOM, conflicts, export status
│   │   │   ├── stores/                 # Zustand: session, plan, ui mode
│   │   │   └── App.tsx
│   │   └── vite.config.ts
│   │
│   ├── mobile/                         # Expo stub → полноценное приложение (фаза 6)
│   │   └── App.tsx
│   │
│   └── server/
│       └── src/
│           ├── core/
│           │   ├── orchestrator.ts
│           │   ├── room-context-builder.ts
│           │   └── output-builder.ts
│           ├── core/api/
│           │   ├── routes.ts           # POST /api/commands, health, catalog
│           │   └── middleware.ts       # JWT, Zod, CORS, error handler
│           ├── ai-services/
│           │   ├── intent-detector.ts
│           │   ├── catalog-rag-retriever.ts
│           │   ├── configuration-plan-generator.ts
│           │   ├── prompt-builder.ts
│           │   └── pipeline.ts
│           ├── compatibility-engine/
│           │   ├── assertCompatible.ts
│           │   ├── spatial-index.ts
│           │   └── rules/              # dimensions, clearances, mounting, utilities
│           ├── pricing-engine/
│           │   ├── calculateBOM.ts
│           │   └── catalog-snapshot.ts
│           ├── domain-modules/
│           │   ├── kitchen/pipeline.ts
│           │   ├── wardrobe/pipeline.ts    # stub → фаза 6
│           │   └── other-furniture/        # stub
│           ├── production-export/          # фаза 4
│           │   └── generatePackage.ts
│           ├── knowledge-base/             # RAG infra (как в AIproject)
│           │   ├── chunker.ts, embeddings.ts, indexer.ts, vector-store.ts
│           │   └── data/source/            # platform-rules.md + catalog docs
│           ├── storage/
│           │   ├── local-storage.ts      # файлы: sessions, scenes, exports, assets (как AIproject)
│           │   └── mongo.ts              # projects, catalog, snapshots, room context
│           ├── data/                     # локально: sessions/, scenes/, exports/, assets/ (см. .gitignore)
│           ├── gltf/                     # 3D-ассеты (как AIproject)
│           ├── config/
│           └── index.ts
│
├── packages/
│   ├── contracts/                        # Zod + inferred TS
│   │   └── src/
│   │       ├── client-request.ts
│   │       ├── client-response.ts
│   │       ├── configuration-plan.ts
│   │       ├── room-context.ts
│   │       ├── module.ts
│   │       ├── compatibility.ts
│   │       ├── bom.ts
│   │       ├── intent.ts
│   │       └── index.ts
│   ├── ai/
│   │   └── src/
│   │       ├── intent-registry.ts
│   │       ├── prompts/
│   │       └── llm-client.ts
│   └── catalog-schema/
│       └── src/
│           ├── catalog.ts                # Zod schema производителя
│           └── normalizer.ts
│
├── docs/
│   ├── architecture.md
│   ├── dommaster-presentation-and-cursor-prompt.md
│   └── api.md
│
├── .env.example
├── package.json                          # workspaces
├── tsconfig.base.json
├── eslint.config.js
├── README.md
├── CONTRIBUTING.md
└── Roadmap.md                            # этот файл
```

---

## 4. Стек и инфраструктура

| Слой | Технология | Когда подключать |
|------|------------|------------------|
| Runtime | Node.js 20 LTS | Фаза 0 |
| API | Express + Zod | Фаза 0 |
| Web client | React 19 + Vite + R3F + Zustand | Фаза 0 (shell), Фаза 1 (3D) |
| Mobile | Expo (stub) | Фаза 0 |
| БД | MongoDB | Фаза 0 (schema), Фаза 1 (catalog, sessions) |
| Кэш | Redis | Фаза 3 |
| Файлы | Локальная FS (`apps/server/data/`, `SERVER_STORAGE_DIR`) | Фаза 0 — как в [AIproject](https://github.com/AgentDan/AIproject) |
| RAG-индекс | Файловый vector store (`knowledge-base/data/index/`) | Фаза 1 — как `kb:index` в AIproject |
| Embeddings | stub → OpenAI / local | Фаза 0 stub, Фаза 5 real LLM |
| Auth | JWT (dev) → OAuth2 (prod) | Фаза 0 stub |
| CI | GitHub Actions: typecheck, lint, test | Фаза 0 |
| Monorepo | npm workspaces | Фаза 0 |

**Модель хранения (как AIproject):**

- **MongoDB** — структурированные данные: проекты, каталог, snapshots, room context, метаданные BOM.
- **Локальная FS** — бинарные и JSON-артефакты в `apps/server/data/` (или `SERVER_STORAGE_DIR`):
  `sessions/`, `scenes/`, `exports/`, `assets/`. Без S3/MinIO на всех фазах MVP.
- **RAG-индекс** — файловый vector store в `knowledge-base/data/index/` (аналог `npm run kb:index` в AIproject).
- **Redis** — только кэш BOM/compatibility по хэшу плана (фаза 3).

Переменные окружения (см. `.env.example`):

```bash
MONGODB_URI=mongodb://localhost:27017/homecraft
# SERVER_STORAGE_DIR=          # пусто → apps/server/data
# KB_INDEX_PATH=               # пусто → knowledge-base/data/index
```

**Dev-команды (целевые):**

```bash
npm install
npm run dev              # server + client concurrently
npm run dev:server
npm run dev:client
npm run typecheck
npm run lint
npm run test
npm run catalog:index    # построить эмбеддинги каталога (аналог kb:index)
npm run build
```

---

## 5. Фазы разработки

### Фаза 0. Фундамент (1–2 недели)

**Цель:** рабочий монорепозиторий, контракты, пустой пайплайн end-to-end, «hello world» через API.

#### Задачи

| # | Задача | Результат |
|---|--------|-----------|
| 0.1 | Инициализация npm workspaces | `package.json`, `apps/*`, `packages/*` |
| 0.2 | TypeScript strict + shared tsconfig | `tsconfig.base.json`, extends во всех workspace |
| 0.3 | ESLint + Prettier + ban JSON clone | `eslint.config.js`, rule на `JSON.parse(JSON.stringify` |
| 0.4 | `packages/contracts` — все Zod-схемы | Экспорт типов через `z.infer<>` |
| 0.5 | `packages/ai` — IntentRegistry skeleton | RU+EN patterns, `UnknownIntent` |
| 0.6 | `packages/catalog-schema` — schema + normalizer stub | Валидация импорта каталога |
| 0.7 | Server skeleton — все файлы с JSDoc + `throw Not implemented` | Структура как в §3 |
| 0.8 | `routes.ts` — `POST /api/commands` с Zod validation | 400 на невалидный body |
| 0.9 | Orchestrator — MODE A/B routing → единый plan shape | Smoke: request → stub response |
| 0.10 | Client shell — CommandInput + ResultViewer | Fetch к API, отображение JSON |
| 0.11 | Mobile Expo stub | Экран «connected to same API» |
| 0.12 | `.env.example`, README, CONTRIBUTING | 10 инвариантов задокументированы |
| 0.13 | GitHub Actions: typecheck + lint | Зелёный CI на пустом коде |
| 0.14 | Docker Compose: MongoDB + Redis | `docker compose up -d` для dev; файлы — локально в `apps/server/data/` |
| 0.15 | `local-storage.ts` — порт паттерна AIproject | `sessions/`, `scenes/`, `exports/`, `assets/`; env `SERVER_STORAGE_DIR` |

#### Acceptance criteria

- [ ] `npm run dev` поднимает server (:3001) и client (:5173)
- [ ] `POST /api/commands` с валидным `ClientRequest` возвращает `ClientResponse` (stub)
- [ ] `npm run typecheck` и `npm run lint` проходят из корня
- [ ] Все 10 инвариантов описаны в CONTRIBUTING.md
- [ ] Нет файлов в `ai-services/`, которые не вызываются из `pipeline.ts`

#### Cursor prompt для фазы 0

Использовать **Блок 3** из `docs/dommaster-presentation-and-cursor-prompt.md`, заменив имя `dommaster` → `homecraft` и `@dommaster/contracts` → `@homecraft/contracts`.

---

### Фаза 1. MVP диалога + Kitchen demo (3–4 недели)

**Цель:** клиент описывает кухню текстом → система возвращает план из демо-каталога, 3D-превью, базовая совместимость.

#### Задачи

| # | Задача | Результат |
|---|--------|-----------|
| 1.1 | Демо-каталог kitchen (15–25 модулей) | JSON в `catalog-schema`, импорт в MongoDB |
| 1.2 | Catalog indexer + file vector store | `npm run catalog:index`, embeddings (stub OK); индекс в `knowledge-base/data/index/` |
| 1.3 | `intent-detector` — 7 интентов RU | add_module, remove, change_finish, set_budget, show_price, help, unknown |
| 1.4 | `catalog-rag-retriever` — top-K модулей | Подключён к plan generator |
| 1.5 | `configuration-plan-generator` — rule-based MVP | Intent + candidates → `ConfigurationPlan` |
| 1.6 | `room-context-builder` — сессия, стены, utilities | Persist в MongoDB + metadata в `local-storage` |
| 1.7 | `domain-modules/kitchen/runPipeline` | Plan → Scene (позиции модулей в комнате) |
| 1.8 | `assertCompatible` — 3 базовых правила | dimensions, overlap, clearance |
| 1.9 | `calculateBOM` — простая сумма по snapshot | Без скидок |
| 1.10 | `output-builder` — ClientResponse | scene + bom + conflicts + messages |
| 1.11 | Client: Preview3D (R3F) | Box-модули по габаритам из каталога |
| 1.12 | Client: multi-turn dialog UI | История сообщений, уточняющие вопросы |
| 1.13 | Help service | Intent `help` → статический ответ без LLM |
| 1.14 | Platform rules RAG | `knowledge-base/data/source/platform-rules.md` |

#### 7 интентов MVP

| Intent | Пример RU | Действие |
|--------|-----------|----------|
| `add_module` | «Добавь навесной шкаф 60 см над плитой» | RAG → add operation |
| `remove_module` | «Убери посудомойку» | remove operation |
| `change_finish` | «Сделай фасады в цвете дуб» | change_finish |
| `set_budget` | «Бюджет до 200 тысяч» | сохранить в context, не блокировать |
| `show_price` | «Сколько стоит?» | trigger BOM recalc |
| `help` | «Что ты умеешь?» | help response |
| `unknown` | не распознано | «Переформулируйте, пожалуйста» |

#### Acceptance criteria

- [ ] Диалог «опиши кухню 3×4 с угловой планировкой» → plan + 3D превью
- [ ] RAG возвращает модули из демо-каталога, не выдуманные SKU
- [ ] Перекрывающиеся модули → `CompatibilityReport` с `valid: false`
- [ ] Intent accuracy ≥ 85% на 50 тестовых фраз (unit tests)
- [ ] P95 pipeline (без LLM) ≤ 800 ms на dev machine

---

### Фаза 2. Compatibility Engine (2–3 недели)

**Цель:** production-grade проверка совместимости, spatial index, автоподбор аналогов.

#### Задачи

| # | Задача | Результат |
|---|--------|-----------|
| 2.1 | `spatial-index.ts` — grid по координатам комнаты | O(k) neighbor lookup |
| 2.2 | Rules: mounting (навесной/напольный) | `rules/mounting.ts` |
| 2.3 | Rules: utilities (розетки, вода, газ) | `rules/utilities.ts` |
| 2.4 | Rules: appliance clearances (духовка, ПММ, холодильник) | `rules/clearances.ts` |
| 2.5 | Conflict taxonomy | `ConflictKind` enum в contracts |
| 2.6 | Analog suggester | При conflict → 2–3 альтернативы из каталога |
| 2.7 | Retry loop в orchestrator | invalid plan → suggest → re-plan (max 3 iter) |
| 2.8 | Client: conflict UI | Список конфликтов + кнопки «заменить» |
| 2.9 | Benchmark: 40 modules | < 50 ms assertCompatible на dev |

#### Acceptance criteria

- [ ] Compatibility hit-rate ≥ 70% с первого раза на golden dataset (20 сценариев)
- [ ] Нет O(n²) в hot path (profiling подтверждает)
- [ ] Только `assertCompatible` возвращает `valid: false` (audit grep по codebase)

---

### Фаза 3. Pricing & BOM (2 недели)

**Цель:** стабильные цены, снэпшоты, кэш, скидки.

#### Задачи

| # | Задача | Результат |
|---|--------|-----------|
| 3.1 | `catalog-snapshot.ts` — freeze при старте сессии | `catalogSnapshotId` в project |
| 3.2 | `calculateBOM` — line items, totals, VAT | `BOM` contract |
| 3.3 | Discount rules (простые: %, bundle) | Config per manufacturer |
| 3.4 | Redis cache by plan hash | Cache hit на повторный show_price |
| 3.5 | Client: BOM table + budget indicator | Presentation layer budget check |
| 3.6 | API: `GET /api/projects/:id/bom` | Отдельный endpoint для mobile |

#### Acceptance criteria

- [ ] Цена не меняется между шагами диалога при неизменном плане
- [ ] Смена live-каталога не влияет на активную сессию
- [ ] BOM cache hit-rate ≥ 60% в типичном 10-step dialog (integration test)
- [ ] `calculateBOM` никогда не throws/returns error по бюджету

---

### Фаза 4. Production Export (2–3 недели)

**Цель:** пакет файлов для производства — PDF spec, раскрой, API интеграция.

#### Задачи

| # | Задача | Результат |
|---|--------|-----------|
| 4.1 | `generatePackage.ts` — orchestration export | ZIP: PDF + JSON spec + DXF stub |
| 4.2 | PDF specification generator | Модули, размеры, finishes, BOM |
| 4.3 | Cut map generator (MVP) | Плоскости фасадов / столешниц |
| 4.4 | Export files в `apps/server/data/exports/` | Как AIproject: запись через `local-storage`, раздача через API |
| 4.5 | API: `POST /api/projects/:id/export` | Async job + status polling |
| 4.6 | Webhook stub для ERP производства | POST JSON spec |
| 4.7 | Client: export button + download | Progress indicator |

#### Acceptance criteria

- [ ] Export завершённого kitchen demo → PDF открывается, SKU совпадают с BOM
- [ ] Export idempotent (повторный запрос → тот же результат при том же snapshot)
- [ ] Export-файлы лежат в `data/exports/` и доступны через API (download endpoint)

---

### Фаза 5. Реальная LLM (3–4 недели)

**Цель:** заменить rule-based plan generator на LLM с function calling, multi-turn.

#### Задачи

| # | Задача | Результат |
|---|--------|-----------|
| 5.1 | `llm-client.ts` — Anthropic/OpenAI/on-prem adapter | Feature flag `LLM_PROVIDER` |
| 5.2 | `ai-response-parser` — real parser, не passthrough | Zod validate LLM output |
| 5.3 | Prompt templates с RAG chunks + room context | `packages/ai/src/prompts/` |
| 5.4 | Function calling → `ConfigurationPlan` operations | Structured output |
| 5.5 | Cheap path vs expensive path | Rule-based для простых интентов, LLM для сложных |
| 5.6 | Multi-turn memory в room context | Last N turns + plan state |
| 5.7 | Cost tracking per session | Metric + alert threshold |
| 5.8 | Fallback: LLM fail → rule-based | `ai-fallback-retry-handler` |
| 5.9 | Eval suite: 200 RU phrases | Intent + plan quality |

#### Acceptance criteria

- [ ] Intent accuracy ≥ 90% на eval corpus
- [ ] LLM cost per completed project ≤ budget (настроить X в `.env`)
- [ ] LLM never returns SKU outside catalog (validator catches → retry)
- [ ] Feature flag OFF → система работает как в фазе 1 (rule-based)

---

### Фаза 6. MODE B + масштабирование (ongoing)

**Цель:** drag-and-drop редактор, второй домен, mobile, multi-tenant.

#### Подфазы

| Подфаза | Срок | Содержание |
|---------|------|------------|
| 6a. MODE B editor | 3–4 нед | `RoomEditor.tsx`, drag modules → same ConfigurationPlan |
| 6b. Wardrobe domain | 2–3 нед | `domain-modules/wardrobe/pipeline.ts`, новые rules |
| 6c. Mobile app | 3–4 нед | Expo: dialog + 3D preview + BOM |
| 6d. Multi-tenant | 2–3 нед | manufacturerId, isolated catalogs, JWT scopes |
| 6e. Real catalog import | 2 нед | ETL pipeline, normalizer, admin UI |
| 6f. AR preview (optional) | 4+ нед | Expo ARKit/ARCore stub |

#### Acceptance criteria (6a — критично для инварианта #1)

- [ ] Действие в редакторе и эквивалентная команда в чате → identical `ConfigurationPlan` hash
- [ ] Один integration test: MODE A plan === MODE B plan для golden scenario

---

## 6. Маппинг: AIproject → HomeCraft

Использовать при портировании или копировании файлов из [AIproject](https://github.com/AgentDan/AIproject).

| AIproject | HomeCraft | Действие |
|-----------|-----------|----------|
| `apps/server/src/core/orchestrator.js` | `core/orchestrator.ts` | Адаптировать: + MODE B, + compatibility retry loop |
| `core/scene-context-builder.js` | `core/room-context-builder.ts` | Переписать: walls, utilities, catalogSnapshotId |
| `core/output-builder.js` | `core/output-builder.ts` | Расширить: BOM, conflicts, export links |
| `core/api/routes.js` | `core/api/routes.ts` | + TS, + Zod, + catalog/export routes |
| `ai-services/intent-detector.js` | `ai-services/intent-detector.ts` | RU-first, 7 furniture intents |
| `ai-services/rag-retriever.js` | `ai-services/catalog-rag-retriever.ts` | RAG по каталогу модулей, не markdown KB |
| `ai-services/action-plan-generator.js` | `ai-services/configuration-plan-generator.ts` | ConfigurationPlan operations |
| `ai-services/pipeline.js` | `ai-services/pipeline.ts` | Тот же порядок стадий |
| `knowledge-base/*` | `knowledge-base/*` | Оставить для platform-rules; catalog RAG отдельно |
| `scene-modules/pipeline.js` | `domain-modules/kitchen/pipeline.ts` | Мебельная геометрия |
| `packages/contracts/*` | `packages/contracts/*` | Новые схемы + Zod |
| `packages/ai/IntentRegistry.ts` | `packages/ai/intent-registry.ts` | Furniture intents RU+EN |
| `apps/client/Preview3D.jsx` | `apps/client/Preview3D.tsx` | Box modules from catalog dimensions |
| `storage/local-storage.js` | `storage/local-storage.ts` | Порт 1:1: `data/{sessions,scenes,exports,assets}` |
| — | `storage/mongo.ts` | **Новое** — structured data в MongoDB |
| — | `compatibility-engine/*` | **Новое** |
| — | `pricing-engine/*` | **Новое** |
| — | `catalog-schema/*` | **Новое** |
| — | `production-export/*` | **Новое** |

**Рекомендуемый порядок копирования из AIproject:**

1. `packages/contracts` → перевести на Zod, расширить
2. `core/api/middleware.js` + `routes.js` → TS + новые endpoints
3. `ai-services/pipeline.js` → skeleton, подключить новые стадии
4. `knowledge-base/` → as-is для infra, другой source data
5. `apps/client` → UI shell, затем R3F

---

## 7. Метрики и Definition of Done

### Production metrics

| Метрика | Цель | С фазы |
|---------|------|--------|
| P95 pipeline latency (без LLM) | ≤ 800 ms | 1 |
| Compatibility hit-rate | ≥ 70% | 2 |
| Intent accuracy (RU) | ≥ 90% | 5 |
| BOM cache hit-rate | ≥ 60% | 3 |
| LLM cost / completed project | ≤ X ₽ | 5 |
| Export success rate | ≥ 99% | 4 |

### Definition of Done (каждая фаза)

- [ ] Acceptance criteria фазы выполнены
- [ ] `typecheck`, `lint`, `test` зелёные в CI
- [ ] README обновлён (новые env vars, scripts)
- [ ] Нет TODO без issue link в hot path pipeline
- [ ] Architecture invariants не нарушены (self-review по CONTRIBUTING.md)

---

## 8. Риски и митигация

| Риск | Вероятность | Митигация |
|------|-------------|-----------|
| Грязные каталоги производителей | Высокая | `catalog-schema/normalizer.ts`, этап ETL в интеграции |
| LLM галлюцинирует SKU | Средняя | RAG-only candidates + Zod validator + catalog boundary check |
| O(n²) compatibility на больших проектах | Средняя | Spatial index с фазы 2, benchmark gate |
| Scope creep MODE B раньше MODE A | Высокая | MODE B только в фазе 6a; инвариант #1 тестируется раньше stub editor |
| Зависимость от зарубежного LLM API | Средняя | Feature flag + rule-based fallback + on-prem adapter |
| Команда 1 человек | — | Фазы 0–1 solo OK; фазы 2–4 параллелить backend/frontend |

---

## 9. Открытые решения

Решить до конца **фазы 0** (не блокируют старт, но блокируют фазу 1+):

| # | Вопрос | Рекомендация | Решить до |
|---|--------|--------------|-----------|
| 1 | Vector search для каталога | File index (как AIproject) на MVP; MongoDB Atlas Vector Search — опционально позже | Фаза 1 |
| 2 | LLM provider | Feature-flag adapter; старт stub/rule-based | Фаза 5 |
| 3 | ConfigurationPlan format | JSON + Zod (проще debug, OK для Expo) | Фаза 0 |
| 4 | Auth | JWT dev → OAuth2 prod | Фаза 6d |
| 5 | Имя npm scope | `@homecraft/contracts` | Фаза 0 |
| 6 | Demo catalog source | Synthetic JSON vs real manufacturer sample | Фаза 1 |

---

## 10. Чек-лист перед каждой фазой

### Перед стартом фазы

- [ ] Предыдущая фаза: все acceptance criteria закрыты
- [ ] Roadmap issue/milestone создан в GitHub
- [ ] Cursor prompt для фазы подготовлен (файлы, функции, criteria, «не трогать»)
- [ ] `.env.example` актуален

### Перед merge в main

- [ ] CI green
- [ ] Manual smoke: `npm run dev` → happy path сценарий фазы
- [ ] Invariants checklist (§2) — 10 пунктов
- [ ] Нет `any`, нет `JSON.parse(JSON.stringify` для clone

---

## Сводный timeline

```
Неделя   1–2    3–6      7–9      10–11    12–14    15–18    19+
         ├──────┼────────┼────────┼────────┼────────┼────────┼────→
Фаза     0      1        2        3        4        5        6
         Fund.  Dialog   Compat   Pricing  Export   LLM      Scale
```

**MVP для pilot-клиента:** конец фазы 4 (export) + частичная фаза 5 (LLM optional behind flag).

**Следующий шаг:** выполнить **Фазу 0** — Cursor prompt из `docs/dommaster-presentation-and-cursor-prompt.md` (блок 3) с заменой `dommaster` → `homecraft`.

---

## Связанные документы

- [docs/dommaster-presentation-and-cursor-prompt.md](docs/dommaster-presentation-and-cursor-prompt.md) — презентации + bootstrap prompt
- [AIproject на GitHub](https://github.com/AgentDan/AIproject) — референсная реализация пайплайна
- `docs/architecture.md` — создать в фазе 0 (диаграммы Client Journey, Server Pipeline, Compatibility Engine)
