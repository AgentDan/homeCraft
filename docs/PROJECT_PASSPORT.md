# HomeCraft — Паспорт проекта

> Живой документ. Обновляется при каждом архитектурном изменении вместе с кодом.
> Источники: `Architecture Vision v1.0`, README/Roadmap.md/CONTRIBUTING.md ветки `phase-1/1.1-demo-catalog`.

---

## 1. Главная идея (1 предложение)

AI понимает клиента и переводит его слова в структурированные данные, а всю реальную работу по проектированию, проверке и производству мебели делают детерминированные специализированные системы.

---

## 2. Архитектурные принципы (ядро, менять только осознанно)

1. AI не принимает финальных решений — только интерпретирует.
2. Диалог — единственный вход: одна команда → один `ConfigurationPlan` → один общий пайплайн ниже по цепочке.
3. Проверку реализуемости делает только один модуль (rejector).
4. Расчёт стоимости — чистый калькулятор, не блокирует план по бюджету.
5. Никаких "мёртвых" AI-путей: если RAG подключён — он обязан использоваться генератором конфигурации.
6. Контракты (Zod) на каждой границе API/хранилища.

---

## 3. Карта блоков: архитектура → код

| Блок (из Architecture Vision) | Модуль в коде (`phase-1`) | Кто владелец логики | Статус |
|---|---|---|---|
| Conversation Engine | `core/orchestrator.js` (`orchestrator.route()`) | детерминированный | ✅ dialog-only |
| AI Understanding Engine | `ai-services/intent-detector.js` | AI | ✅ 7 англ. интентов |
| Customer Context / Memory | `core/room-context-builder.js` | детерминированный | ✅ MongoDB + local fallback |
| Knowledge / RAG Engine | `ai-services/catalog-rag-retriever.js`, `knowledge-base/*` | AI (retrieval) | ✅ file vector index |
| Configuration Engine | `ai-services/configuration-plan-generator.js` | rule-based | ✅ |
| Rules Engine | `compatibility-engine/assertCompatible.js` + `rules/*` + `analog-suggester.js` | детерминированный, **единственный rejector** | 🚧 5 правил (dimensions/mounting/overlap/utilities/clearances) + analog suggester |
| Scene Graph / 3D Engine | `domain-modules/kitchen/pipeline.js` + client `ScenePreview.jsx` (R3F) | детерминированный | ✅ базовая версия |
| Calculation Engine | `pricing-engine/calculateBOM.js` | детерминированный, чистый калькулятор | ✅ от frozen snapshot |
| Production / ERP Integration | Phase 4 (not started) | детерминированный | 🔲 Phase 4 |

**Соответствие с исходным документом:** блоки почти полностью совпадают 1:1. Отличие — в документе RAG и 3D Engine описаны как отдельные крупные подсистемы, в коде они пока встроены как модули внутри общего пайплайна, без выделенных сервисов.

---

## 4. Границы ответственности (что блок НЕ делает)

- **AI Understanding Engine** не пишет напрямую в `ConfigurationPlan`, минуя генератор плана.
- **Configuration Engine** не проверяет реализуемость — это не его зона, только сборка плана.
- **Rules Engine (`assertCompatible`)** — единственный, кто может проставить `valid: false`; остальные стадии не отклоняют план.
- **Calculation Engine (`calculateBOM`)** не блокирует по бюджету — это чистый расчёт, а не валидатор.
- **Catalog snapshot** — BOM всегда читает замороженный `catalogSnapshotId`, а не живой каталог (иначе цены "плывут" между сессией и подтверждением).

---

## 5. Инварианты и запреты (не нарушать без пересмотра архитектуры)

1. Диалог — единственный вход (ручной редактор конфигурации исключён на MVP).
2. `assertCompatible()` — единственная точка отказа плана.
3. `calculateBOM()` — pure function, не блокирует по бюджету.
4. Intent detection — только английский, без тихого fallback (используется `UnknownIntent`).
5. `catalog-rag-retriever` обязательно подключён к `configuration-plan-generator`.
6. BOM всегда читает `catalogSnapshotId`, а не live-каталог.
7. Compatibility работает через spatial index (не O(n²) в горячем пути).
8. Zod — на каждой сетевой/storage-границе.
9. Клонирование — только через `structuredClone`, `JSON.parse(JSON.stringify())` запрещён линтером.
10. UI-типографика: font-weight только 400/500, sentence case.

---

## 6. Текущий статус vs целевая архитектура

**Реализовано (Phase 0–1, ветка `phase-1/1.1-demo-catalog`):**
- Монорепо (npm workspaces), контракты на Zod, сквозной пайплайн `POST /api/commands`.
- Демо-каталог кухни (18 модулей) + MongoDB seed.
- File-based vector RAG по каталогу и platform-rules.
- Rule-based генератор конфигурации, 3 правила совместимости + spatial index.
- Реальный BOM от frozen snapshot.
- 3D-превью (R3F) и многоходовой диалог на клиенте.
- CI: lint + test + build.

**Не реализовано / отсутствует в текущем пайплайне:**
- Полноценный Scene Graph как единый источник данных (сейчас 3D — модуль внутри kitchen-домена, не отдельная подсистема).
- Production / ERP Integration (Phase 4 — not started).
- LLM в проде (Phase 5 — rule-based intent/plan generation сейчас).
- Дополнительные домены (wardrobe, other-furniture) — Phase 3+.

**В работе (Phase 2, ветка `phase-2`):**
- `rules/*` вынесены в модули с единой сигнатурой `check({ modules, context, index })`; `assertCompatible` — оркестратор правил.
- Новые правила: `utilities` (`utility_conflict`, пропускается если комната не моделирует точки) и `clearances` (`clearance_violation`, enforce только значимые зазоры ≥20 мм — flush-шкафы валидны).
- `analog-suggester` заполняет `suggestedSkus` (та же категория) для каждого конфликта.
- Клиентский `ConflictPanel` показывает конфликты и кликабельные аналоги.

**Следующий шаг по Roadmap:** Phase 3 — Pricing & BOM (снапшоты каталога, кэш, таблица BOM, индикатор бюджета на клиенте).

---

## 7. Метрики / Definition of Done

| Метрика | Цель | С какой фазы |
|---|---|---|
| P95 пайплайна (без LLM) | ≤ 800 мс | Phase 1 (сейчас: 411 мс) |
| Compatibility hit-rate | ≥ 70% | Phase 2 |
| Точность intent (англ.) | ≥ 90% | Phase 5 |
| BOM cache hit-rate | ≥ 60% | Phase 3 |

DoD каждой фазы: acceptance criteria выполнены + `lint`/`test`/`build` проходят + README/Roadmap актуальны + все 10 инвариантов сохранены.

---

## 8. Журнал решений (Decision Log)

> Добавлять новую запись сверху при каждом значимом изменении.

| Дата | Что изменили | Почему | Что устарело в паспорте |
|---|---|---|---|
| 2026-07-19 | Phase 2 (ветка `phase-2`): рефактор Compatibility Engine в `rules/*`, добавлены правила `utilities`/`clearances`, `analog-suggester` (`suggestedSkus`), клиентский `ConflictPanel` | Расширить проверку реализуемости и дать пользователю понятные конфликты + предложения аналогов | Раздел 3 (Rules Engine 🚧), раздел 6 (Phase 2 в работе) |
| 2026-07-19 | Финальная подготовка перед Phase 2: миграция валюты RUB→EUR по всем контрактам/каталогу/серверу, новый glass-HUD клиента (чат + командная строка + 3D-комната), чистка мёртвого кода в `intent-detector`, `jsconfig` `paths` для `@homecraft/*` | Стабилизировать базу Phase 1 и снять техдолг до старта Compatibility Engine | Валютные поля везде `*Eur`; `detectIntent` — тонкая обёртка над `matchIntent` |
| 2026-07-19 | Ветка `phase-1/1.1-demo-catalog` помечена как Phase 1 complete | MVP-диалог + демо-каталог кухни готовы | Раздел 6 актуализирован под это состояние |

---

## 9. Открытые вопросы (из Roadmap, раздел "Open decisions")

| # | Вопрос | Решение | Когда |
|---|---|---|---|
| 5 | LLM-провайдер | Feature flag, стаб | Phase 5 |
| 6 | Авторизация | JWT → OAuth2 | Phase 6 |
| 8 | Модель ввода | Только диалог, ручной редактор исключён | зафиксировано |

Полный список — см. `docs/Roadmap.md`, раздел 10.

---

## 10. Связанные документы

- `docs/Roadmap.md` — фазы разработки
- `docs/step0.md` — итоги Phase 0
- `docs/dialog-flow.md` — диалоговый флоу и API
- `CONTRIBUTING.md` — инварианты и код-ревью чеклист
- Architecture Vision v1.0 (исходный документ, вне репозитория)
