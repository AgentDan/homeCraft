# HomeCraft — Паспорт проекта и вклад в код

> Живой документ: архитектура, инварианты, чеклист ревью и статус.  
> Обновляется при каждом архитектурном изменении вместе с кодом.  
> Источники: `Architecture Vision v1.0`, ветка `phase-1/1.1-demo-catalog`.  
> Активный backlog: [Roadmap.md](Roadmap.md).

---

## 1. Главная идея (1 предложение)

AI понимает клиента и переводит его слова в структурированные данные, а всю реальную работу по проектированию, проверке и производству мебели делают детерминированные специализированные системы.

---

## 2. Архитектурные принципы (ядро, менять только осознанно)

1. AI не принимает финальных решений — только интерпретирует.
2. Диалог — единственный вход: одна команда → один `ConfigurationPlan` → один общий пайплайн ниже по цепочке.
3. Проверку реализуемости делает только один модуль (rejector).
4. Расчёт стоимости — чистый калькулятор, не блокирует план по бюджету.
5. Никаких «мёртвых» AI-путей: если RAG подключён — он обязан использоваться генератором конфигурации.
6. Контракты (Zod) на каждой границе API/хранилища.

---

## 3. Карта блоков: архитектура → код

| Блок (из Architecture Vision) | Модуль в коде | Кто владелец логики | Статус |
|---|---|---|---|
| Conversation Engine | `core/orchestrator.js` (`orchestrator.route()`) | детерминированный | ✅ dialog-only |
| AI Understanding Engine | `ai-services/intent-detector.js` | AI | ✅ rule-based EN/RU/SR; LLM intent ⚑ `HOMECRAFT_LLM_INTENT` |
| Customer Context / Memory | `core/room-context-builder.js` | детерминированный | ✅ MongoDB + local fallback |
| Knowledge / RAG Engine | `ai-services/catalog-rag-retriever.js`, `knowledge-base/*` | AI (retrieval) | ✅ file vector index |
| Configuration Engine | `ai-services/configuration-plan-generator.js` | rule-based | ✅ |
| Rules Engine | `compatibility-engine/assertCompatible.js` + `rules/*` + `analog-suggester.js` | детерминированный, **единственный rejector** | 🚧 5 правил + analog suggester |
| Scene Graph / 3D Engine | `domain-modules/kitchen/pipeline.js` + client `ScenePreview.jsx` (R3F) | детерминированный | ✅ glTF + box-fallback; финиш по `facade` |
| Calculation Engine | `pricing-engine/calculateBOM.js` + `bom-cache.js` | детерминированный | ✅ snapshot BOM + cache |
| Production / ERP Integration | `export/*` + `GET /api/exports/:id` | детерминированный | ✅ PDF export |
| Command journal | `storage/local-storage.js` + tree `PlanHistory` | детерминированный | ✅ branches |
| Explanation (templates) | `decision-report.js` + `output-builder.js` + i18n | детерминированный | ✅ grounded report; TTS V6–V7 |
| Voice input (STT) | client `useSpeechCommand` + `inputChannel: 'voice'` | клиент | ✅ Web Speech API |

---

## 4. Границы ответственности (что блок НЕ делает)

- **AI Understanding Engine** не пишет напрямую в `ConfigurationPlan`, минуя генератор плана.
- **Configuration Engine** не проверяет реализуемость — только сборка плана.
- **Rules Engine (`assertCompatible`)** — единственный, кто может проставить `valid: false`.
- **Calculation Engine (`calculateBOM`)** не блокирует по бюджету.
- **Catalog snapshot** — BOM всегда читает замороженный `catalogSnapshotId`, а не живой каталог.

---

## 5. Инварианты и запреты (non-negotiable)

1. **Dialog is the only input path:** каждая команда → один `ConfigurationPlan` в `orchestrator.route()` → общий downstream.
2. **`assertCompatible()`** — единственная стадия, которая может отклонить план (`valid: false`).
3. **`calculateBOM()`** — чистый калькулятор, не блокирует по бюджету.
4. **Intent detection** — `en` / `ru` / `sr` (rule-based); без тихого fallback — `UnknownIntent`.
5. **`catalog-rag-retriever`** обязан быть подключён к `configuration-plan-generator` (no dead AI paths).
6. **Catalog snapshots** — BOM читает frozen `catalogSnapshotId`, не live-каталог.
7. **Spatial index** для compatibility (не O(n²) в горячем пути).
8. **Zod** на каждой сетевой/storage-границе (plain JS ESM, без TypeScript build step).
9. **`structuredClone`** для клонирования — `JSON.parse(JSON.stringify(...))` запрещён (ESLint).
10. **UI typography:** font-weight только 400/500; sentence case.

Дополнительно к roadmap glTF: `.glb` по опубликованному пути снапшота не перезаписывать.

---

## 6. Contributing: ESLint, ревью, storage, workflow

### ESLint

Root `eslint.config.js` включает `no-restricted-syntax` против JSON-clone anti-pattern.

```bash
npm run lint
```

### Code review checklist

- [ ] Инварианты 1–10 соблюдены
- [ ] Новые API-поля имеют Zod-схемы в `@homecraft/contracts`
- [ ] `npm run typecheck` и `npm run test` проходят
- [ ] Нет бизнес-логики в compatibility/pricing, которой там не место

### Storage

- **MongoDB** — структурированные project/catalog данные (best-effort)
- **Local FS** — `apps/server/data/` (или `SERVER_STORAGE_DIR`)

### Phase workflow

Следовать [Roadmap.md](Roadmap.md). Каждая фаза = focused PR с acceptance criteria из roadmap.

---

## 7. Текущий статус vs целевая архитектура

**Закрыто (Phase 0–3 + Steps 1–10):** монорепо, демо-каталог, RAG, compatibility, BOM cache, export PDF, branches, candidates/policy, LLM intent ⚑, voice STT, grounded explanation + TTS.

**Deferred:** analog ranking polish (2.8); wardrobe / Expo / auth / multi-tenant / customer memory.

**Активно:** [Roadmap.md](Roadmap.md) — фазы 1–5 ✅ (glTF + Journey 1–3 + option thumbnails). Backlog — этапы journey 4+.

**Ещё нет в пайплайне:** полноценный Scene Graph как отдельная подсистема; домены wardrobe+; production package сверх PDF.

---

## 8. Метрики / Definition of Done

| Метрика | Цель | С какой фазы |
|---|---|---|
| P95 пайплайна (без LLM) | ≤ 800 мс | Phase 1 (сейчас: 411 мс) |
| Compatibility hit-rate | ≥ 70% | Phase 2 |
| Точность intent (EN corpus; RU/SR smoke) | ≥ 90% EN | Step 8 (LLM) / сейчас rule-based |
| BOM cache hit-rate | ≥ 60% | Phase 3 |

DoD фазы: acceptance criteria + `lint`/`test`/`build` + актуальные docs + 10 инвариантов.

---

## 9. Журнал решений (Decision Log)

> Новая запись сверху при каждом значимом изменении.

| Дата | Что изменили | Почему | Что устарело в паспорте |
|---|---|---|---|
| 2026-08-02 | Фаза 5: `thumbnailUrl` + PNG thumbs + options `<img>` | Превью кандидатов без ghost в сцене | §7, §11 |
| 2026-08-02 | Фаза 4: Project Journey 1–3 (`dialog-router`, `RoomContext.journey`) | Guided intro→brief→survey без блокировки команд | §7, §11 |
| 2026-08-02 | Фаза 3: `useGLTF` + box-fallback + tint `facade` в `ScenePreview` | 3D-каталог без смены pose-math | §3, §7 |
| 2026-08-02 | Фаза 2: `validate:gltf` + 7 priority `.glb` в `apps/server/gltf/` | Приём моделей по spec без codegen в репо | §7, §11 |
| 2026-08-02 | Фаза 1 roadmap: `model-authoring-spec.md` (центр origin, +Z, slots, без `modelUri`) | Контракт для ручных `.glb` без смены pose-math | §11 |
| 2026-08-02 | Docs: один `Roadmap.md` (glTF+journey); CONTRIBUTING влит в паспорт | Убрать дубли архива и двух contributing-доков | Разделы 6–7, 10 |
| 2026-07-29 | Step 10 — Grounded explanation + TTS | Числа только из отчёта; озвучка не блокирует UI | Explanation ✅ |
| 2026-07-29 | Step 9 — Voice STT | Голос = peer channel к `/api/commands` | Voice ✅ |
| 2026-07-29 | Step 8 — LLM intent ⚑ | Потолок формулировок без ломки пайплайна | Step 8 ✅ |
| 2026-07-29 | Step 7 — Policy + confidence | Веса без правки кода; ask on near-tie | Step 7 ✅ |
| 2026-07-29 | Step 6 — Candidates on conflict | Варианты вместо hard reject | Step 6 ✅ |
| 2026-07-29 | Step 5 — PlanHistory tree | Ветки без потери путей | Step 5 ✅ |
| 2026-07-26 | Step 4 — Production Export PDF | Pilot: спецификация клиенту | Production ✅ |
| 2026-07-26 | Step 3 — replayJournal CI | Истина в журнале | Step 3 ✅ |
| 2026-07-26 | Step 2 — idempotency + version lock | Double-submit / гонки | Step 2 ✅ |
| 2026-07-26 | Step 1 — Command journal JSONL | Event log | Step 1 ✅ |
| 2026-07-25 | Языки en/ru/sr | UI + intent на трёх локалях | Инвариант 4 |
| 2026-07-22 | Phase 3 — BOM cache, snapshots API | Смета/бюджет | Phase 3 ✅ |
| 2026-07-19 | Phase 2 — rules/*, analogs, ConflictPanel | Реализуемость + UX конфликтов | Rules Engine |
| 2026-07-19 | Phase 1 complete | MVP-диалог + демо-каталог | Phase 1 ✅ |

---

## 10. Открытые вопросы

| # | Вопрос | Решение | Когда |
|---|---|---|---|
| — | Языки (intent + UI) | `en` / `ru` / `sr`, rule-based | ✅ 2026-07-25 |
| 5 | LLM-провайдер | `HOMECRAFT_LLM_INTENT`; intent JSON; fallback rules | ✅ 2026-07-29 |
| 6 | Авторизация | JWT → OAuth2 | Deferred |
| 8 | Модель ввода | Только диалог; голос — peer STT | ✅ 2026-07-29 |

Актуальный backlog — [Roadmap.md](Roadmap.md).

---

## 11. Связанные документы

- [Roadmap.md](Roadmap.md) — активный roadmap (glTF + Project Journey)
- Architecture Vision v1.0 (вне репозитория)

- [model-authoring-spec.md](model-authoring-spec.md) — контракт авторства glTF (фаза 1) + `npm run validate:gltf` (фаза 2)
- [CONSULTANT_CONCEPT.md](CONSULTANT_CONCEPT.md) — словарь Project Journey (фаза 4)
- [gltf-visual-smoke.md](gltf-visual-smoke.md) — visual smoke BASE-600 (фаза 3)
