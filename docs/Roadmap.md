# HomeCraft — Roadmap: 3D-каталог + Project Journey

Status: **planned** (не начато).  
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
| `apps/server/gltf/` | Только `.gitkeep` |
| `catalog-store.js` | Один JSON; `getCatalogSnapshot` принимает только `kitchen-demo-v1` |
| Demo-каталог | 18 SKU (`BASE-*`, `WALL-*`, `TALL-*`, `SINK-*`, `CORNER-900`, …) |
| `ScenePreview.jsx` / `ModuleBox` | R3F: комната, свет, тени, камера, `OrbitControls`; модуль = `<boxGeometry>`; позиция = `position/1000 + size/2` (центр бокса); финиш = весь mesh через `FINISH_COLORS`; **`useGLTF` нигде нет** |
| `docs/CONSULTANT_CONCEPT.md` | **Файла нет** — создать в фазе 4 как единый словарь journey |
| `required_slots` | **Имени в коде нет.** Прецедент обследования: `roomWidthMm` / `roomDepthMm` → `applyRoomDimensionSlots`; нехватка слотов → `clarify`; `RoomShape.openings` / `utilities` часто пустые |
| `homecraft_architecture.pdf` | В репо отсутствует |
| Персист | `persistRoomContext`: local + Mongo best-effort |
| Options UI (`ResponseRouter.jsx`) | `responseType: 'options'` — только текст `option.label`; картинок нет |
| `InteractionOptionSchema` | `id`, `label`, `speechLabel` — **нет** `thumbnailUrl` |

**Конвенция пути (зафиксировано):** клиент запрашивает `/gltf/{sku}.glb` (имя файла = точный `sku`). Отдельное поле модели в Zod/каталоге не требуется. Миниатюры: `/gltf/{sku}.png` рядом с `.glb` (та же иммутабельность). Пока живёт один snapshot `kitchen-demo-v1`, путь без версии допустим **только если файл никогда не подменяют**. Смена геометрии/материалов/превью = новый snapshot **и** новая схема путей — отдельное решение при втором snapshot, не в фазах 1–3.

Связанный discovery-артефакт (вне репо): `journey-dialog-map.html` — 12 этапов. В коде фазы 4 — **только этапы 1–3**.

---

## Todo

- [ ] **1. Контракт авторства 3D** — `docs/model-authoring-spec.md` (без контента `.glb`)
- [ ] **2. Валидация + приём моделей** — скрипт/чеклист; файлы от автора в `apps/server/gltf/`
- [ ] **3. Клиентский рендер** — `useGLTF('/gltf/{sku}.glb')` + box-fallback + material slots
- [ ] **4. Project Journey 1–3** — state, dialog-router в `resolveRoutedCommand`, i18n-вопросы
- [ ] **5. Превью кандидатов** — `option.thumbnailUrl` + PNG у SKU + `<img>` в `ResponseRouter`

---

## Фаза 1 — Контракт и спецификация моделей (без контента)

### Цель

Зафиксировать правила авторства glTF так, чтобы ручные `.glb` подставлялись в текущий `ModuleBox` **без смены** pose-логики в `materializePlan` / позиционирования.

### Задачи

- [ ] Создать `docs/model-authoring-spec.md` с необсуждаемыми параметрами:
  - формат `.glb`, один файл, текстуры встроены; имя = точный `sku`; ≤15k треугольников; ≤2 МБ
  - единицы — метры; Y-up; правая СК
  - **origin = геометрический центр bounding box** по X/Y/Z (как центр текущего `boxGeometry`)
  - фасад при `rotationY = 0` смотрит в **+Z**
  - bbox геометрии = `dimensions` каталога (мм → м)
  - material slots: `facade`, `carcass`; metallic-roughness; `metalness ≈ 0`; `roughness ≈ 0.6–0.8`
  - без light/camera внутри `.glb`
- [ ] Явно записать: **поле `modelUri` / аналог в контракты не добавляем**; наличие модели = наличие файла по `/gltf/{sku}.glb`
- [ ] Зафиксировать в spec: модели делает человек вручную; codegen/asset-pack в репо не входят
- [ ] **Сквозное:** в spec или комментарии к каталогу — место под авторство/дату модели (на будущее); отдельный трекинг лицензий не требуется для Homecraft-authored assets

### Затрагиваемые файлы

- `docs/model-authoring-spec.md` (новый)
- этот roadmap (ссылка на spec)

### Критерий готовности

1. Spec смержен и однозначен (origin center, +Z facade, бюджеты, slots).
2. Контракты Zod **не** меняются ради URI.
3. Документировано, что pose/`ModuleBox` math не пересматриваются под corner-origin.

### Явно вне скоупа

- Любые `.glb`, валидатор, правки `ScenePreview`, поля в `ModuleSchema` / `SceneResultSchema`.

---

## Фаза 2 — Валидация и интеграция моделей

### Цель

Принимать авторские `.glb` в `apps/server/gltf/` только после проверки против каталога и spec; без процедурной генерации в коде.

### Задачи

- [ ] Скрипт и/или чеклист валидации перед merge:
  - bbox ≈ `dimensions` SKU (допуск на фурнитуру — порог в скрипте)
  - origin в геометрическом центре bbox
  - есть materials/slots `facade` и `carcass`
  - ≤15k tris, ≤2 МБ
  - нет light/camera в сцене файла
- [ ] Приём моделей по мере готовности автора (приоритет demo-SKU: `BASE-400/600/800`, навесной, угловой, пенал, шкаф под мойку)
- [ ] Класть файлы как `apps/server/gltf/{sku}.glb`; static route уже есть — не дублировать
- [ ] При приёме модели (или отдельным шагом фазы 5): заготовка под offscreen PNG `{sku}.png` рядом с `.glb`
- [ ] Опционально: заметка в каталоге/CHANGELOG «SKU X: glTF added, author, date» — **не** URL-поле схемы модели
- [ ] **Сквозное:** не перезаписывать уже отданный под snapshot файл; замена = новый snapshot + новая path-policy

### Затрагиваемые файлы

- `apps/server/gltf/{sku}.glb`
- `tools/` или `apps/server/scripts/validate-gltf.*` (новый)
- `docs/model-authoring-spec.md` (ссылка на валидатор)
- при необходимости комментарий/мета в `kitchen-catalog.json` без смены Zod-обязательных полей

### Критерий готовности

1. Хотя бы несколько приоритетных SKU проходят валидатор и отдаются с `/gltf/{sku}.glb`.
2. SKU без файла не ломают сервер/каталог.
3. Генератора моделей в репозитории нет.

### Явно вне скоупа

- Клиентский `useGLTF` (фаза 3), заказ внешнего asset-pack, смена `kitchen-demo-v1` id без нужды.

---

## Фаза 3 — Клиентский рендер

### Цель

Подменить геометрию бокса на glTF при успешной загрузке; сохранить fallback и перекраску через `facade`.

### Задачи

- [ ] В `ModuleBox`: условная загрузка через `useGLTF('/gltf/{sku}.glb')` (drei); нет файла / ошибка → текущий `<boxGeometry>`
- [ ] Не менять формулу позиции (`position/1000 + size/2`) — она уже под center-origin
- [ ] Финиш: красить material slot `facade` по `FINISH_COLORS` / `finishId`; `carcass` не перекрашивать целиком как сейчас бокс
- [ ] `Room`, свет, камера, `OrbitControls` — не трогать
- [ ] **Сквозное:** smoke визуальной регрессии (скриншот или чеклист): тот же угол/габарит, что у box-fallback для `BASE-600`
- [ ] Ошибка загрузки — без молчаливого «успеха»; fallback заметен только геометрией, не ломает диалог

### Затрагиваемые файлы

- `apps/client/src/components/ScenePreview.jsx`
- тест/доки smoke-регрессии (минимально)

### Критерий готовности

1. SKU с `.glb` рендерится мешем; без файла — бокс.
2. Смена `finishId` затрагивает `facade`.
3. Позиционирование совпадает с прежним боксом при тех же `position` / `dimensions`.

### Явно вне скоупа

- Перестройка lighting, анимации фасадов, загрузка по `catalogVersion` в URL (пока один snapshot).

---

## Фаза 4 — Project Journey (этапы 1–3)

### Цель

Система ведёт клиента: Знакомство → Сбор задачи → Обследование помещения. Build-loop (Intent → Plan → Compatibility → BOM → Scene) остаётся инструментом, не центром.

### Задачи

- [ ] Создать **один** `docs/CONSULTANT_CONCEPT.md`: словарь `ProjectJourney` / этапы / слоты; `KitchenBrief` = будущие слоты потребностей (этап 4+, вне этой фазы); `dialog-router` = модуль маршрутизации реплик — без второго параллельного жаргона
- [ ] Zod `ProjectJourneyState` в `packages/contracts`: stage, mode (`guided` \| `free`), known / missing / deferred, история вопросов
- [ ] Вложить state в `RoomContext`; dual-write как у остального контекста (local + Mongo best-effort)
- [ ] Таблица «этап → недостающее поле → ключ i18n» в логике + `apps/server/src/i18n/messages.js` (RU-first)
- [ ] Этап 3 на прецеденте обследования (слоты размеров, openings/utilities, clarify) — **не** выдумывать уже существующий модуль `required_slots`; при необходимости ввести явную таблицу required fields для journey stage 3
- [ ] В `resolveRoutedCommand()` **до** `intentHandlers[intent.kind]`: роутер — ответ на journey-вопрос vs обычная команда. Команда не блокируется; вопрос этапа можно переспросить следующим ходом
- [ ] Явный выход в `journey.mode = free` в любой момент
- [ ] **Сквозное:** минимальная наблюдаемость — drop-off по stage, счётчик re-ask (journal / JSONL)
- [ ] Discovery: прогон sandbox-сценариев до кодирования финальной таблицы вопросов

### Затрагиваемые файлы

- `docs/CONSULTANT_CONCEPT.md` (новый)
- `packages/contracts` — journey schema + `RoomContext`
- `apps/server/src/core/orchestrator.js`
- `apps/server/src/core/dialog-router.js` (новый)
- `apps/server/src/core/room-context-builder.js`
- `apps/server/src/storage/local-storage.js`, `mongo.js`
- `apps/server/src/i18n/messages.js`
- тесты router / orchestrator

### Критерий готовности

1. Guided path проходит этапы 1→2→3 вопросами системы.
2. Free mode и обычные команды работают параллельно политике роутера.
3. Ответы на вопросы этапа детерминированно пишут слоты (без LLM-решений).
4. State переживает reload сессии.
5. Этапы 4–12 только в backlog concept doc.

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
