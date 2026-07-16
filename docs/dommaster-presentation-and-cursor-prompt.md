# ДомМастер — материалы для презентации и Cursor prompt

Три независимых блока, каждый под свою аудиторию:

1. **Технический доклад** — для команды разработчиков (30–40 мин).
2. **Инвестиционный питч** — для инвестора (10–12 мин + Q&A).
3. **Cursor prompt** — production-ready промпт для бутстрапа монорепозитория.

Все три блока описывают один и тот же продукт, но с принципиально разных ракурсов. Не смешивать —
язык, метрики и приоритеты разные.

---

# Блок 1. Технический доклад для команды разработчиков   

**Аудитория:** senior/middle backend + frontend, тимлид, архитектор.
**Формат:** 30–40 минут + 15 минут Q&A. Слайды опциональны, но нужны 2–3 диаграммы (Client Journey,
Server Pipeline, Compatibility Engine internals — они уже есть).
**Цель доклада:** команда должна выйти с общим пониманием пайплайна, границ ответственности модулей
и списка архитектурных решений, которые не подлежат обсуждению в MVP.

## 1. Проблема, которую решаем (2 мин)

Классический онлайн-конфигуратор мебели проваливается по трём причинам одновременно:

- **Высокий когнитивный барьер.** Клиент не мебельщик — он не знает, что такое «навесной модуль
  600×720» и какая между ними разница.
- **Ошибки сборки.** Клиент собирает физически невозможные проекты (перекрывающиеся модули, нехватка
  зазоров под встроенную технику), и это ловится только менеджером на этапе оформления заказа.
- **Разрыв "хотелки → BOM".** Между разговором клиента и производственной спецификацией стоит
  человек-переводчик (менеджер), и он бутылочное горлышко бизнеса.

Мы заменяем менеджера AI-помощником, но с одним жёстким ограничением: **AI никогда не отвечает за
геометрию, совместимость и цену**. Он отвечает только за перевод намерения клиента в структурированный
план. Всё остальное — детерминированные движки.

## 2. Продукт в одном предложении (1 мин)

Диалоговая платформа, которая по описанию клиента автоматически собирает проект мебели из реального
каталога модулей производителя, проверяет физическую совместимость, считает точный BOM и генерирует
пакет для производства — без участия менеджера.

## 3. Архитектурный overview (5 мин)

Монорепозиторий на npm workspaces. Backend — Node.js/Express, frontend — React 19 + Vite + R3F,
mobile — Expo (stub на старте).

Ключевая идея — **10-стадийный детерминированный пайплайн**, где LLM локализована в двух местах
(intent detection и RAG-поиск), а всё, что влияет на реальные деньги и физику проекта, реализовано
правилами.

```
routes.js
  → orchestrator.route()
    → room-context-builder.buildRoomContext()
      → intent-detector.detectIntent()          [AI-стадия #1]
        → catalog-rag-retriever.retrieve()      [AI-стадия #2]
          → configuration-plan-generator.generatePlan()   [детерминизм]
            → assertCompatible.assertCompatible()          [детерминизм, firewall]
              → domain-modules/kitchen/runPipeline()
                → pricing-engine/calculateBOM()            [детерминизм]
                  → output-builder.buildOutput()
```

Два режима ввода — **MODE A** (свободный диалог) и **MODE B** (ручной drag-and-drop редактор) —
сливаются в единый `ConfigurationPlan` уже на стадии оркестратора и дальше идут через **один и тот же
пайплайн**. Никаких параллельных code paths — это первое жёсткое архитектурное правило.

## 4. Границы ответственности (5 мин) — самая важная часть доклада

Общая проблема AI-проектов: LLM «залезает» в области, где нужен детерминизм, и вы получаете
галлюцинации в геометрии/цене. Явно фиксируем границы:

| Отвечает LLM/AI | Отвечает детерминированный код |
|---|---|
| Понять, что клиент хочет | Что физически возможно |
| Найти релевантные модули в каталоге | Собрать их геометрически корректно |
| Задать уточняющий вопрос | Посчитать цену |
| Предложить варианты стиля/бюджета | Сгенерировать пакет для производства |

**Compatibility Engine — это фаервол.** Он единственный имеет право **заблокировать** план. Никакая
другая стадия не отклоняет и не переписывает план молча — только `assertCompatible()` возвращает
`CompatibilityReport` с `valid: false` и списком конфликтов, и только тогда система идёт по циклу
подбора аналогов.

**Pricing Engine — это калькулятор.** Он ничего не блокирует. Даже если проект дороже бюджета,
это не Pricing решает, а презентационный слой поверх Output Builder. Смешивать нельзя — иначе
теряется предсказуемость.

## 5. Технический долг, который мы **закладываем правильно с первого дня** (5 мин)

Прямые уроки из предыдущего проекта, которые нельзя повторить:

- **Intent detection — мультиязычный с MVP.** Никаких English-only regex с молчаливым fallback на
  default intent. Русский идёт как first-class, паттерны + классификатор с явным `unknown_intent`
  вместо тихого угадывания.
- **RAG-поиск подключён к генератору плана с первого коммита.** Никаких "dead code paths, доделаем
  потом". Если стадия есть в пайплайне — она работает. Иначе её нет.
- **`ai-response-parser` не заглушка.** С самого начала за фиче-флагом, но с реальным контрактом
  под LLM, не passthrough.
- **Compatibility Engine с пространственным индексом** с MVP, не наивное O(n²). При 40+ модулях в
  гардеробной наивная проверка уже заметно тормозит на десктопе, на мобилке — критично.
- **Каталог версионируется через снэпшот.** Проект хранит `catalogSnapshotId` — цены не «плывут»
  между сессиями клиента.

## 6. Стек и монорепозиторий (3 мин)

```
dommaster/
├── apps/
│   ├── client/          # React 19 + Vite + R3F + Zustand
│   ├── mobile/          # Expo, тот же контракт что и client
│   └── server/          # Node 20 + Express + Zod
├── packages/
│   ├── contracts/       # Общие типы (Zod-схемы + inferred TS)
│   ├── ai/              # IntentRegistry, prompt templates, LLM client wrapper
│   └── catalog-schema/  # Zod-схема каталога модулей производителя
└── package.json         # npm workspaces
```

Данные: PostgreSQL + pgvector для эмбеддингов каталога, Redis для кэша BOM/compatibility по хэшу
плана, S3-совместимое хранилище для файлов производства.

## 7. Roadmap по фазам (5 мин)

| Фаза | Длительность | Технический результат |
|------|--------------|----------------------|
| 0. Фундамент | 1–2 нед | Монорепо, контракты, импорт реального каталога в БД |
| 1. MVP диалога | 3–4 нед | 7 интентов, RAG подключён живьём, деминов kitchen |
| 2. Compatibility Engine | 2–3 нед | Пространственный индекс, автоподбор аналогов при конфликте |
| 3. Pricing & BOM | 2 нед | Снэпшоты цен, скидки, кэш по хэшу плана |
| 4. Production Export | 2–3 нед | PDF-спецификация, карты раскроя, API производства |
| 5. Реальная LLM | 3–4 нед | Function calling в ConfigurationPlan, multi-turn |
| 6. Масштабирование | по потребности | Мультитенантность, домен wardrobe, AR-примерка на мобилке |

## 8. Метрики, которые смотрим в проде (3 мин)

- **P95 latency пайплайна** — цель ≤ 800 мс на диалоговом шаге (без учёта LLM-стадий).
- **Compatibility hit-rate** — доля планов, прошедших `assertCompatible` с первого раза; целим в
  ≥ 70%.
- **Intent accuracy на RU** — минимум 90% на корпусе из 200 реальных фраз клиентов.
- **BOM cache hit-rate** — ≥ 60% в устоявшемся диалоге (клиент повторно смотрит цену).
- **Стоимость LLM на завершённый проект** — жёсткий бюджет ≤ X ₽, отдельная метрика для алертов.

## 9. Открытые вопросы для команды (Q&A hook, 2 мин)

- Векторная БД: pgvector или отдельный Qdrant? (Пока склоняюсь к pgvector — меньше движущихся частей).
- LLM-провайдер: Anthropic API vs on-prem модель? (Для B2B-клиентов из РФ вопрос критичен.)
- Формат `ConfigurationPlan`: JSON или Protobuf? (Влияет на mobile — сериализация в Expo).

**Формат Q&A:** сначала на архитектуру, потом на roadmap, оценки трудозатрат обсуждаем на планировании,
не в докладе.

---

# Блок 2. Инвестиционный питч

**Аудитория:** инвестор или инвест-комитет.
**Формат:** 10–12 минут презентации + Q&A.
**Цель:** получить term sheet или follow-up meeting. Не «объяснить продукт», а показать, что мы
знаем рынок, знаем экономику и знаем, как масштабируемся.

**Тональность:** уверенно, без хайпа про AI. Мы не «ещё один GPT-обёртка», мы решаем боль конкретной
индустрии, где AI — инструмент, а не продукт.

## Слайд 1. Заголовок

**ДомМастер.** Мы превращаем 3 часа в кабинете дизайнера-менеджера в 20 минут разговора с AI-помощником.

## Слайд 2. Проблема

**Мебельный ритейл теряет 30–40% лидов на этапе «клиент пришёл в шоурум, но менеджер занят».**
Онлайн-конфигураторы не спасают — по данным индустрии, до финальной корзины доходит < 5% начавших.
Причина простая: клиент не умеет проектировать кухню, а конфигуратор требует, чтобы умел.

Три конкретные боли производителя:

- **Дорогой менеджер.** Средний чек на дизайн-встречу — 2–4 часа рабочего времени специалиста.
- **Ошибки на входе в производство.** До 8–12% заказов возвращаются в дизайн из-за нестыковок,
  которые ловят уже в производстве.
- **Невозможность масштабировать в регионы.** В городе, где нет шоурума, продажи через сайт
  падают в 5–10 раз.

## Слайд 3. Решение

AI-помощник ведёт диалог с клиентом на естественном языке, автоматически собирает проект из
**реального** каталога производителя, гарантирует физическую совместимость и на выходе даёт файлы,
готовые к запуску в производство.

Ключевая мысль для инвестора: **мы не заменяем всю индустрию AI-магией**. Мы заменяем один конкретный
рабочий процесс — переговоры менеджера с клиентом — и делаем это надёжно, потому что цена и геометрия
считаются детерминированным кодом, а не LLM.

## Слайд 4. Почему сейчас

Три тренда сошлись:

- **LLM стали дешёвыми настолько**, что 20-минутный диалог с клиентом стоит меньше 5 центов.
- **Мебельная индустрия оцифровала каталоги**. 5 лет назад у большинства производителей не было
  структурированных SKU с габаритами, сегодня есть у 60%+.
- **Клиент готов говорить с ботом.** Пост-ChatGPT это уже не воспринимается как «дешёвая замена
  человеку».

## Слайд 5. Продуктовое отличие

Мы не «конфигуратор с чатом сверху» и не «GPT, который придумывает мебель». Мы гибрид:

- Клиент общается с AI **как с дизайнером**.
- Проект собирается из **реальных, доступных к производству** модулей.
- Каждая рекомендация проверена детерминированными правилами.

Конкуренты либо усложняют UI (традиционные конфигураторы), либо галлюцинируют модули, которых нет в
каталоге (наивные GPT-обёртки). Мы третий вариант — AI-интерфейс поверх реального производства.

## Слайд 6. Бизнес-модель

B2B SaaS для производителей мебели. Три источника дохода:

- **Fixed fee за интеграцию** — импорт каталога, кастомизация правил совместимости.
- **Подписка за платформу** — ежемесячно.
- **Success fee за завершённый проект** — процент от суммы заказа, привязанный к measurable outcome.

Ставим на смешанную модель: интеграция закрывает CAC, подписка держит инфраструктуру, success fee
даёт upside при масштабировании клиента.

## Слайд 7. Целевой рынок

Первый ICP: **средние производители кухонной мебели с онлайн-продажами и цифровым каталогом.**

- В РФ таких ≈ 200–400 компаний.
- Средний чек интеграции + первый год подписки — единицы миллионов рублей.
- TAM после расширения на шкафы/прихожие/офисную мебель — на порядок больше.

Второй горизонт — экспорт архитектуры в смежные вертикали: яхты, склады, ритейл-фикстуры (это
прямые уроки предыдущего проекта, там пайплайн подтвердил применимость).

## Слайд 8. Traction / милстоуны

Здесь честно указываем, что есть на момент разговора:

- Работающая архитектурная основа, обкатанная в предыдущем 3D-проекте (не MVP этого продукта, а
  доказательство, что команда умеет строить такие пайплайны).
- Список pilot-кандидатов из мебельной индустрии.
- Roadmap до production-ready MVP — 4 месяца при команде из 3 человек.

**Если traction слабый — не пытаться его надувать.** Инвестор увидит. Лучше сфокусировать слайд на
команде и доменной экспертизе.

## Слайд 9. Команда

Инженерный лид с историей построения похожего пайплайна (3D-конфигуратор + AI). Плюс кого удалось
привлечь на момент разговора. Ключевое сообщение: **мы уже строили что-то технически похожее**,
это не первая попытка разобраться в теме.

## Слайд 10. Что просим

Конкретная сумма, конкретное использование:

- N% на команду (backend + AI + продажи).
- N% на инфраструктуру и LLM-бюджет пилотов.
- N% на pilot-интеграции с 2–3 якорными клиентами.

Runway — X месяцев до следующего раунда, привязанный к milestone «3 pilot-клиента в проде».

## Слайд 11. Риски и как мы их закрываем

Не игнорировать риски — назвать их первым:

- **Каталоги производителей грязные и несогласованные.** Закладываем этап нормализации в интеграцию,
  не рассчитываем на идеальные данные.
- **LLM-стоимость растёт с длиной диалога.** Правило "cheap path vs expensive path" в архитектуре —
  большинство команд обрабатывается rule-based до похода к LLM.
- **Конкуренты.** Крупные вендоры конфигураторов могут добавить чат. Наш ров — не чат, а
  детерминированный пайплайн под ним.

## Слайд 12. Заключение

Одна фраза: **мы делаем так, чтобы клиент сам собрал кухню за 20 минут диалога, а производство
получило файлы, готовые к запуску — без единого касания менеджера.**

---

# Блок 3. Cursor prompt для бутстрапа проекта

Ниже — самодостаточный промпт. Вставляется первым в новый пустой репозиторий. Даёт Cursor полный
контракт архитектуры, ограничения и приёмочные критерии. Специально написан в тон "senior tells
Cursor how to scaffold", а не "please help me".

```
ROLE: You are scaffolding a new npm-workspaces monorepo called "dommaster" for an AI-powered
furniture design B2B SaaS platform. You are working with a senior engineer. Do not ask clarifying
questions unless a requirement is genuinely ambiguous — the contract below is complete. Do not
implement business logic in this pass; produce the skeleton, typed contracts, and JSDoc signatures
only. Business logic will be added file-by-file in follow-up prompts.

STACK (fixed, do not deviate):
- Node.js 20 + Express + Zod on the server
- React 19 + Vite + React Three Fiber + Zustand on the web client
- Expo on mobile (stub only — same TS contracts as web client)
- PostgreSQL with pgvector extension for catalog embeddings
- Redis for BOM/compatibility caching by plan hash
- TypeScript everywhere. Strict mode. No `any`.
- Zod for runtime validation at every network and storage boundary

MONOREPO LAYOUT (create exactly this):
dommaster/
├── apps/
│   ├── client/                       # React 19 + Vite + R3F + Zustand
│   ├── mobile/                       # Expo, minimal shell
│   └── server/
│       └── src/
│           ├── core/
│           │   ├── orchestrator.ts             # route(request) → MODE_A | MODE_B
│           │   ├── room-context-builder.ts     # buildRoomContext(userId, projectId) → RoomContext
│           │   └── output-builder.ts           # buildOutput(plan, bom, scene) → ClientResponse
│           ├── ai-services/
│           │   ├── intent-detector.ts          # detectIntent(text, lang) → Intent | UnknownIntent
│           │   ├── catalog-rag-retriever.ts    # retrieve(query, catalogId, k) → Module[]
│           │   └── configuration-plan-generator.ts # generatePlan(intent, context, candidates) → ConfigurationPlan
│           ├── compatibility-engine/
│           │   ├── assertCompatible.ts         # assertCompatible(plan, context) → CompatibilityReport
│           │   ├── spatial-index.ts            # BVH/grid for neighbor lookup, not O(n²)
│           │   └── rules/                      # one file per rule (dimensions, clearances, mounting, utilities)
│           ├── pricing-engine/
│           │   ├── calculateBOM.ts             # calculateBOM(plan, catalogSnapshotId) → BOM
│           │   └── catalog-snapshot.ts         # freeze catalog prices per project session
│           ├── domain-modules/
│           │   ├── kitchen/pipeline.ts         # runPipeline(plan, context) → Scene
│           │   ├── wardrobe/pipeline.ts        # stub, throws NotImplemented
│           │   └── other-furniture/pipeline.ts # stub, throws NotImplemented
│           ├── production-export/              # phase 4, stubs for now
│           │   └── generatePackage.ts
│           └── routes.ts                       # POST /api/commands + Zod validation + JWT
├── packages/
│   ├── contracts/                    # Zod schemas + inferred TS types, SHARED
│   │   └── src/
│   │       ├── module.ts             # Module: sku, dimensions, price, clearances, mounting, finishes
│   │       ├── room-shape.ts         # walls, openings, utilities, dimensions
│   │       ├── configuration-plan.ts # operations[]: add/remove/move/change_finish
│   │       ├── compatibility.ts      # CompatibilityReport, ConflictKind
│   │       ├── bom.ts                # BOMLine, BOM totals
│   │       ├── intent.ts             # IntentKind, Intent, UnknownIntent
│   │       └── index.ts
│   ├── ai/
│   │   └── src/
│   │       ├── intent-registry.ts    # RU + EN patterns per intent, no silent fallback
│   │       ├── prompts/              # LLM prompt templates
│   │       └── llm-client.ts         # wrapper, feature-flagged
│   └── catalog-schema/
│       └── src/
│           └── catalog.ts            # manufacturer catalog Zod schema + normalizer
└── package.json                      # workspaces: apps/*, packages/*

ARCHITECTURAL INVARIANTS (non-negotiable, enforce in code review):

1. MODE A (chat dialog) and MODE B (drag-and-drop editor) MUST converge to the same ConfigurationPlan
   at the orchestrator layer and go through the SAME downstream pipeline. No parallel code paths.
   Enforce with a single `route()` function that returns the same shape regardless of mode.

2. `assertCompatible()` is the ONLY place in the codebase that can reject a ConfigurationPlan.
   No other stage validates business rules. If a stage other than compatibility-engine returns
   `valid: false` or throws a compatibility error — that's a bug.

3. `calculateBOM()` NEVER rejects a plan for business reasons (budget overrun, discount rules).
   It is a pure calculator. Budget checks live in the presentation layer above output-builder.

4. Intent detection MUST support Russian from the first commit. Do NOT fall back silently to a
   default intent when nothing matches — return `UnknownIntent` and let the orchestrator ask the
   user to rephrase. English-only regex with silent fallback is a rejected pattern.

5. `catalog-rag-retriever` MUST be wired into `configuration-plan-generator` from the first
   commit. Do NOT scaffold it as a disconnected stage "for later". If retrieval is not connected,
   remove the file — no dead code paths.

6. Catalog prices are versioned. A project stores `catalogSnapshotId`; `calculateBOM` reads
   prices from the frozen snapshot, never live catalog. This is required for BOM stability
   across a client session.

7. Compatibility Engine MUST use a spatial index (grid or BVH keyed on room coordinates) for
   neighbor lookup. Naive O(n²) pairwise checking is not acceptable even in MVP — it degrades
   visibly at ~40 modules (wardrobe scale).

8. Every network boundary (API request, LLM response, catalog import, mobile → server) validates
   with Zod. No `as unknown as T` casts across boundaries.

9. Use `structuredClone` for state cloning. `JSON.parse(JSON.stringify(...))` is banned repo-wide;
   add an ESLint rule.

10. Two weights only in UI: 400 regular and 500 medium. No 600/700. Sentence case, not Title Case.

DELIVERABLE FOR THIS PROMPT:

Produce all files listed in the layout above with:
- Package.json in each workspace, with correct dependencies referenced across workspaces
- Zod schemas in packages/contracts (real, complete schemas — this is contract-first)
- Empty function bodies in server/src/**/* with:
  * Full JSDoc describing the contract (params, return type, side effects, error cases)
  * Correct TS signature using types from @dommaster/contracts
  * `throw new Error("Not implemented")` in the body
- A README.md at the repo root describing the 10-stage pipeline and the 10 invariants above
- A CONTRIBUTING.md documenting the ESLint rules and the "compatibility-engine is the only rejector" rule
- Working npm scripts: `build`, `typecheck`, `lint`, `test` at both root and per-workspace level

Do NOT:
- Implement any business logic (rules, pricing formulas, RAG retrieval)
- Add example modules or sample catalog data
- Add tests beyond a single smoke test per workspace confirming it builds
- Ask about naming, folder structure, or stack — the contract above is final

When done, output a single summary listing:
- Files created (count + list)
- Zod schemas defined
- ESLint rules configured
- Any invariant you were unable to enforce via tooling (call it out explicitly)
```

---

## Как этим пользоваться

- **Технический доклад** — можно превратить в 20–25 слайдов; каждая секция = один слайд + speaker
  notes из абзаца.
- **Инвест-питч** — уже разбит на 12 слайдов, можно вставлять в шаблон презентации напрямую. Числа
  в TAM/CAC/success fee проставить конкретные перед встречей.
- **Cursor prompt** — вставляется целиком одним сообщением в пустом репозитории. После выполнения —
  проверить чек-лист из 10 инвариантов и запустить `npm run typecheck`, `npm run lint` от корня.

Дальше по roadmap каждую Фазу можно превращать в отдельный Cursor-промпт по тому же шаблону:
конкретные файлы, конкретные функции, acceptance criteria, что НЕ трогать.
