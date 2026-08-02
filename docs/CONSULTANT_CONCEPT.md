# HomeCraft — Consultant Concept (Project Journey)

Единый словарь для guided-диалога. Без параллельного жаргона.

Связано: [Roadmap.md](Roadmap.md) (фаза 4), [PROJECT_PASSPORT.md](PROJECT_PASSPORT.md).

---

## Термины

| Термин | Значение |
|---|---|
| **ProjectJourney** | Guided-сопровождение клиента по этапам; state в `RoomContext.journey` |
| **этап (stage)** | Шаг journey: `intro` → `brief` → `survey` → `done` |
| **слот (slot)** | Именованное поле, которое система заполняет ответом клиента |
| **dialog-router** | Модуль `apps/server/src/core/dialog-router.js`: ответ на вопрос этапа **или** обычная команда |
| **mode** | `guided` — система задаёт вопросы; `free` — только build-loop по командам |
| **KitchenBrief** | Будущие слоты потребностей кухни (этап 4+). **Вне фазы 4** — только имя в backlog |

Build-loop (Intent → Plan → Compatibility → BOM → Scene) остаётся инструментом; journey его не заменяет.

---

## Этапы в коде (фаза 4 = 1–3)

| # | stage | Цель | Слоты |
|---|---|---|---|
| 1 | `intro` | Знакомство | `clientName` |
| 2 | `brief` | Сбор задачи | `projectGoal` |
| 3 | `survey` | Обследование помещения | `roomWidthMm`, `roomDepthMm` |
| — | `done` | Этапы 1–3 закрыты | — |

Обследование опирается на прецедент `roomWidthMm` / `roomDepthMm` → `applyRoomDimensionSlots` / `roomShape.dimensions`.  
`openings` / `utilities` в фазе 4 **не** обязательны (можно `deferred`).

---

## Политика dialog-router

1. Фразы выхода → `mode = free` в любой момент (команда не теряется на следующих ходах).
2. Распознанная kitchen-команда (`add_module`, …) **не блокируется** — уходит в intent-handlers / downstream.
3. `unknown` / ответ на `pendingQuestionId` в `guided` → детерминированная запись слота (без LLM-решений).
4. Непонятный ответ на вопрос этапа → re-ask (счётчик), вопрос можно повторить следующим ходом.

---

## Discovery (минимальные сценарии)

Перед усложнением таблицы вопросов прогнать устно/в чате:

1. Guided happy path: имя → цель → «3×4 м» → `done`, затем «добавь базу 600».
2. Free escape на этапе 2 → команда «добавь мойку 800» работает.
3. Команда посреди intro → модуль добавляется; вопрос имени можно задать на следующем `unknown`.
4. Reload сессии → `journey` восстанавливается из dual-write.

Полный HTML sandbox (`tools/journey-sandbox/`) — backlog после фазы 5.

---

## Backlog этапов 4–12

4+ `KitchenBrief` / потребности · 5–7 build-loop UX · 9 approval/freeze · 11 production package · …

В коде фазы 4 **только** `intro` / `brief` / `survey` / `done`.
