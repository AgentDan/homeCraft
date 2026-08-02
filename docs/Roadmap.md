# HomeCraft — Roadmap: 3D-каталог + Project Journey

Status: **in progress** — фазы 1–4 done; далее фаза 5 (thumbnails).  
Закрытый MVP (Steps 1–10) — в decision log паспорта. Порядок: `1 → 2 → 3`; фаза `5` после `2` (нужны `.glb`); фаза `4` параллельно после фиксации словаря journey (не зависит от glTF).

Инварианты (не нарушать) — см. также [PROJECT_PASSPORT.md](PROJECT_PASSPORT.md):

- AI только распознаёт намерение; решения детерминированы
- `catalogSnapshotId` неизменяем; `.glb` по опубликованному пути **не перезаписывать** (см. конвенцию путей ниже)
- RU-first; без молчаливого fallback без объяснения
- Immutable-состояние (`structuredClone`)
- Контракты — Zod в `packages/contracts`

---

## Verified baseline (проверено по файлам)

| Область | Факт |
|---|---|
| `ModuleSchema` (`packages/contracts/src/module.js`) | Нет поля под 3D-модель — **и по этому roadmap отдельное поле не вводим** |
| `SceneResultSchema` (`packages/contracts/src/client-response.js`) | Pose + `dimensions` + `finishId`; ссылки на glTF нет (клиент выводит путь из `sku`) |
| Static `/gltf` (`apps/server/src/core/api/routes.js`) | `express.static(apps/server/gltf)` уже смонтирован |
| `apps/server/gltf/` | Приоритетные placeholder `.glb` (7 SKU) + CHANGELOG; static `/gltf` |
| `validate:gltf` | `apps/server/scripts/validate-gltf.mjs` — bbox/origin/slots/tris/size |
| `catalog-store.js` | Один JSON; `getCatalogSnapshot` принимает только `kitchen-demo-v1` |
| Demo-каталог | 18 SKU (`BASE-*`, `WALL-*`, `TALL-*`, `SINK-*`, `CORNER-900`, …) |
| `ScenePreview.jsx` / `ModuleBox` | R3F: `useGLTF('/gltf/{sku}.glb')` + box-fallback; поза = `position/1000 + size/2`; финиш только slot `facade` |
| `docs/CONSULTANT_CONCEPT.md` | Единый словарь journey (фаза 4) ✅ |
| `required_slots` | **Имени в коде нет.** Прецедент обследования: `roomWidthMm` / `roomDepthMm` → `applyRoomDimensionSlots`; нехватка слотов → `clarify`; `RoomShape.openings` / `utilities` часто пустые |
| `homecraft_architecture.pdf` | В репо отсутствует |
| Персист | `persistRoomContext`: local + Mongo best-effort |
| Options UI (`ResponseRouter.jsx`) | `responseType: 'options'` — только текст `option.label`; картинок нет |
| `InteractionOptionSchema` | `id`, `label`, `speechLabel` — **нет** `thumbnailUrl` |

**Конвенция пути (зафиксировано):** клиент запрашивает `/gltf/{sku}.glb` (имя файла = точный `sku`). Отдельное поле модели в Zod/каталоге не требуется. Миниатюры: `/gltf/{sku}.png` рядом с `.glb` (та же иммутабельность). Пока живёт один snapshot `kitchen-demo-v1`, путь без версии допустим **только если файл никогда не подменяют**. Смена геометрии/материалов/превью = новый snapshot **и** новая схема путей — отдельное решение при втором snapshot, не в фазах 1–3.

Связанный discovery-артефакт (вне репо): `journey-dialog-map.html` — 12 этапов. В коде фазы 4 — **только этапы 1–3**.

---

## Todo

- [x] **1. Контракт авторства 3D** — [model-authoring-spec.md](model-authoring-spec.md) (без контента `.glb`)
- [x] **2. Валидация + приём моделей** — `npm run validate:gltf`; приоритетные SKU в `apps/server/gltf/`
- [x] **3. Клиентский рендер** — `useGLTF` + box-fallback + `facade` tint; [gltf-visual-smoke.md](gltf-visual-smoke.md)
- [x] **4. Project Journey 1–3** — [CONSULTANT_CONCEPT.md](CONSULTANT_CONCEPT.md), dialog-router, persist
- [ ] **5. Превью кандидатов** — `option.thumbnailUrl` + PNG у SKU + `<img>` в `ResponseRouter`

---

## Фаза 1 — Контракт и спецификация моделей (без контента)

### Цель

Зафиксировать правила авторства glTF так, чтобы ручные `.glb` подставлялись в текущий `ModuleBox` **без смены** pose-логики в `materializePlan` / позиционирования.

### Задачи

- [x] Создать [model-authoring-spec.md](model-authoring-spec.md) с необсуждаемыми параметрами:
  - формат `.glb`, один файл, текстуры встроены; имя = точный `sku`; ≤15k треугольников; ≤2 МБ
  - единицы — метры; Y-up; правая СК
  - **origin = геометрический центр bounding box** по X/Y/Z (как центр текущего `boxGeometry`)
  - фасад при `rotationY = 0` смотрит в **+Z**
  - bbox геометрии = `dimensions` каталога (мм → м)
  - material slots: `facade`, `carcass`; metallic-roughness; `metalness ≈ 0`; `roughness ≈ 0.6–0.8`
  - без light/camera внутри `.glb`
- [x] Явно записать: **поле `modelUri` / аналог в контракты не добавляем**; наличие модели = наличие файла по `/gltf/{sku}.glb`
- [x] Зафиксировать в spec: модели делает человек вручную; codegen/asset-pack в репо не входят
- [x] **Сквозное:** в spec — место под авторство/дату модели (на будущее); отдельный трекинг лицензий не требуется для Homecraft-authored assets

### Затрагиваемые файлы

- [model-authoring-spec.md](model-authoring-spec.md) ✅
- этот roadmap (ссылка на spec) ✅

### Критерий готовности

1. ✅ Spec однозначен (origin center, +Z facade, бюджеты, slots).
2. ✅ Контракты Zod **не** меняются ради URI.
3. ✅ Документировано, что pose/`ModuleBox` math не пересматриваются под corner-origin.

### Явно вне скоупа

- Любые `.glb`, валидатор, правки `ScenePreview`, поля в `ModuleSchema` / `SceneResultSchema`.

---

## Фаза 2 — Валидация и интеграция моделей

### Цель

Принимать авторские `.glb` в `apps/server/gltf/` только после проверки против каталога и spec; без процедурной генерации в коде.

### Задачи

- [x] Скрипт валидации перед merge (`npm run validate:gltf`):
  - bbox ≈ `dimensions` SKU (допуск ±10 mm)
  - origin в геометрическом центре bbox
  - есть materials/slots `facade` и `carcass`
  - ≤15k tris, ≤2 МБ
  - нет light/camera в сцене файла
- [x] Приём приоритетных demo-SKU: `BASE-400/600/800`, `WALL-600`, `CORNER-900`, `TALL-600`, `SINK-600`
- [x] Файлы как `apps/server/gltf/{sku}.glb`; static route без дублирования
- [x] Заготовка под PNG: README + warn валидатора при отсутствии `{sku}.png` (рендер — фаза 5)
- [x] `apps/server/gltf/CHANGELOG.md` — author/date без URL-поля схемы
- [x] **Сквозное:** README + gitignore allowlist; не перезаписывать под snapshot

### Затрагиваемые файлы

- `apps/server/gltf/{sku}.glb` ✅ (7 priority)
- `apps/server/scripts/validate-gltf.mjs` ✅
- `docs/model-authoring-spec.md` (ссылка на валидатор) ✅
- `apps/server/gltf/CHANGELOG.md` / `README.md` ✅

### Критерий готовности

1. ✅ Приоритетные SKU проходят валидатор и отдаются с `/gltf/{sku}.glb`.
2. ✅ SKU без файла не ломают сервер/каталог (наличие файла опционально).
3. ✅ Генератора моделей в репозитории нет.

### Явно вне скоупа

- Клиентский `useGLTF` (фаза 3), заказ внешнего asset-pack, смена `kitchen-demo-v1` id без нужды.

---

## Фаза 3 — Клиентский рендер

### Цель

Подменить геометрию бокса на glTF при успешной загрузке; сохранить fallback и перекраску через `facade`.

### Задачи

- [x] В `ModuleBox`: `useGLTF('/gltf/{sku}.glb')` + Suspense/ErrorBoundary → `<boxGeometry>`
- [x] Формула позиции (`position/1000 + size/2`) не менялась
- [x] Финиш: только material slot `facade` по `FINISH_COLORS` / `finishId`
- [x] `Room`, свет, камера, `OrbitControls` — не трогали
- [x] Smoke-чеклист: [gltf-visual-smoke.md](gltf-visual-smoke.md); unit на `moduleCenterPosition`
- [x] Ошибка загрузки: `console.warn` + box-fallback; диалог не ломается
- [x] Vite proxy `/gltf` → server (dev)

### Затрагиваемые файлы

- `apps/client/src/components/ScenePreview.jsx` ✅
- `apps/client/vite.config.js` ✅
- [gltf-visual-smoke.md](gltf-visual-smoke.md) ✅

### Критерий готовности

1. ✅ SKU с `.glb` рендерится мешем; без файла / ошибка — бокс.
2. ✅ Смена `finishId` затрагивает `facade`.
3. ✅ Позиционирование совпадает с прежним боксом при тех же `position` / `dimensions`.

### Явно вне скоупа

- Перестройка lighting, анимации фасадов, загрузка по `catalogVersion` в URL (пока один snapshot).

---

## Фаза 4 — Project Journey (этапы 1–3)

### Цель

Система ведёт клиента: Знакомство → Сбор задачи → Обследование помещения. Build-loop (Intent → Plan → Compatibility → BOM → Scene) остаётся инструментом, не центром.

### Задачи

- [x] Создать **один** [CONSULTANT_CONCEPT.md](CONSULTANT_CONCEPT.md)
- [x] Zod `ProjectJourneyState` в `packages/contracts`; вложен в `RoomContext`
- [x] Dual-write journey (local session + Mongo best-effort)
- [x] Таблица этап → слот → i18n + `messages.js` (RU-first)
- [x] Этап 3 на `roomWidthMm` / `roomDepthMm` (openings/utilities deferred)
- [x] `routeJourneyDialog()` в `resolveRoutedCommand` **до** intent-handlers; команды не блокируются
- [x] Выход `journey.mode = free` (escape-фразы)
- [x] Observability: `journey-events.jsonl` (stage / re-ask / slot)
- [x] Discovery-сценарии зафиксированы в concept doc

### Затрагиваемые файлы

- [CONSULTANT_CONCEPT.md](CONSULTANT_CONCEPT.md) ✅
- `packages/contracts` — journey schema + `RoomContext` ✅
- `apps/server/src/core/orchestrator.js` / `dialog-router.js` / `journey-table.js` ✅
- `apps/server/src/core/room-context-builder.js` ✅
- `apps/server/src/storage/local-storage.js`, `journey-events.js` ✅
- `apps/server/src/i18n/messages.js` ✅
- `apps/server/src/core/dialog-router.test.js` ✅

### Критерий готовности

1. ✅ Guided path 1→2→3 вопросами системы.
2. ✅ Free mode и обычные команды параллельно политике роутера.
3. ✅ Ответы на вопросы этапа детерминированно пишут слоты.
4. ✅ State в dual-write (session + project doc).
5. ✅ Этапы 4–12 только в backlog concept doc.

### Явно вне скоупа

- Этапы 4–12 journey, LLM-ведёт сценарий, отказ от intent-handlers / `runDownstream`.

---

## Фаза 5 — Превью вариантов при выборе кандидата

### Цель

В `responseType: 'options'` показывать миниатюру SKU над текстом кнопки — без «призраков» кандидатов в 3D-сцене (сцена рендерит только текущую версию плана).

### Задачи

- [ ] Добавить необязательное `thumbnailUrl` в `InteractionOptionSchema` (`packages/contracts/src/client-response.js`)
- [ ] Генерация миниатюры **один раз** при добавлении модели в каталог: offscreen-рендер `.glb` с фиксированного ракурса → PNG; движок тот же стек, что основная 3D-сцена (Three / R3F)
- [ ] Класть файл рядом с моделью: `apps/server/gltf/{sku}.png` (URL `/gltf/{sku}.png`); не перезаписывать под тем же snapshot
- [ ] В `buildCandidatesResponse()` (и местах сборки options) проставлять `thumbnailUrl`, если PNG для SKU кандидата есть
- [ ] В `ResponseRouter.jsx` для `options`: `<img>` над `option.label` при наличии `thumbnailUrl`; без URL — как сейчас, только текст
- [ ] **Сквозное:** PNG подчиняется той же иммутабельности, что `.glb`

### Затрагиваемые файлы

- `packages/contracts/src/client-response.js`
- `apps/server/src/core/output-builder.js` (`buildCandidatesResponse`)
- `apps/client/src/components/ResponseRouter.jsx`
- `apps/server/gltf/{sku}.png`
- скрипт offscreen-рендера (рядом с validate-gltf / `tools/`)

### Критерий готовности

1. Zod принимает options с/без `thumbnailUrl`.
2. Хотя бы для приоритетных SKU с `.glb` есть `.png`, отдаётся static `/gltf`.
3. В UI options видна картинка, если URL задан; без URL UI не ломается.
4. Кандидаты **не** рисуются как полупрозрачные объекты в основной сцене.

### Явно вне скоупа

- Ghost/preview meshes в `ScenePreview`
- Живой пересчёт thumbnail на каждый request
- Отдельный CDN / внешний image host на MVP

---

## Сквозные пункты (матрица)

| Пункт | Ф1 | Ф2 | Ф3 | Ф4 | Ф5 |
|---|---|---|---|---|---|
| Авторство / дата модели (метаданные) | spec | при приёме файлов | — | — | — |
| Выход journey → free | — | — | — | да | — |
| Observability drop-off / re-ask | — | — | — | минимальные счётчики | — |
| `journeyState` dual-write | — | — | — | да | — |
| Visual regression smoke | — | — | да | — | опционально options UI |
| Не перезаписывать `.glb` / `.png` snapshot | зафиксировать | соблюдать | — | — | соблюдать |

---

## Backlog после фазы 5

- `tools/journey-sandbox/` (HTML + JSON сценарии)
- Journey этапы 4–7 на существующем build-loop
- Approval / freeze snapshot (этап 9)
- Production package (этап 11)
- Path-policy с `catalogVersion` при втором snapshot
- Внешние asset-pack (только с лицензией)

---

## Definition of Done (инициатива)

- [ ] Spec + валидатор; авторские `.glb` для приоритетных SKU на `/gltf/{sku}.glb`
- [ ] Клиент: glTF или box-fallback; финиш по `facade`; pose без регрессии
- [ ] Journey 1–3 guided + free escape + persist
- [ ] Options с `thumbnailUrl` / PNG; без ghost в сцене
- [ ] Один словарь в `CONSULTANT_CONCEPT.md`; инварианты AI/Zod/RU/snapshot соблюдены
