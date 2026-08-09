# Admin UI — Recommendation rules (карточки)

Документ описывает все ручки вкладки **Recommendation rules** в `#/admin`.  
Каталоги значений: `packages/contracts/src/admin-catalog.js`. Persist: `apps/server/data/recommendation-rules.json` (кнопка **Save**).

Зачем эти ручки простыми словами: [admin-recommendation-rules-why.md](./admin-recommendation-rules-why.md).  
Единый глоссарий имён (Field / Operator / Action / DS / Profile): [admin-glossary.md](./admin-glossary.md).

---

## Панель списка (над карточками)

| Ручка | Тип | Что делает |
|---|---|---|
| **+ Add rule** | кнопка | Добавляет правило `custom_rule_N` с дефолтным atomic condition + `filterCatalog`. Пока не нажат Save — только в UI. |
| **Delete** (на карточке) | кнопка | Удаляет правило после confirm. Для mandatory id — отдельное предупреждение. Нужен Save. |

Свёрнутая карточка показывает: `ruleId`, subtitle (`priority · kind · action`), badge `active` / `off`. Клик по заголовку — раскрыть/свернуть.

---

## Секция Meta

| Ручка | Тип | Описание |
|---|---|---|
| **Rule id** | text | Уникальный идентификатор правила. Используется движком и в JSON. |
| **Priority** | number (int) | Чем **меньше** число, тем раньше правило рассматривается. Обязательные seed: `1`, `2`, `999`. |
| **Condition kind** | select | Форма блока **When** (см. ниже). |
| **Active** | checkbox | Выкл. → правило не участвует в DP4, но остаётся в файле. |

### Condition kind — значения

| Значение | Смысл | UI в When |
|---|---|---|
| `always` | условие всегда истинно | текст «Always matches.» |
| `atomic` | одно условие Field / Operator / Value | один ряд condition |
| `allOf` | все atomics истинны (AND), 1–3 шт. | список + Add / Remove |
| `anyOf` | хотя бы один atomic (OR), 1–3 шт. | список + Add / Remove |

---

## Секция When (условия)

### Ряд atomic-условия

| Ручка | Тип | Описание |
|---|---|---|
| **Field** | select | Путь в контексте DP4 (каталог `conditionFields`). В UI короткие подписи (`budgetEur` вместо `known.budgetEur`), полный path в `title`. |
| **Operator** | select | Как сравнивать значение поля. |
| **Value** | select / number | Зависит от Field и Operator (см. ниже). |
| **Remove** | link | Убрать atomic из `allOf`/`anyOf` (нельзя убрать последний). |
| **+ Add condition (max 3)** | link | Добавить atomic (только для `allOf` / `anyOf`). |

### Operator — значения

| Operator | Value UI |
|---|---|
| `equals` / `not_equals` | select из enum поля, либо number, либо fallback |
| `in` / `not_in` | как equals (значение из каталога) |
| `exists` | select `true` / `false` — есть ли значение у поля |
| `gt` / `gte` / `lt` / `lte` | number input |

### Field — закрытый каталог

**Journey known (ответы анкеты):**

- `known.clientName`
- `known.projectGoal`
- `known.roomWidthMm`
- `known.roomDepthMm`
- `known.hasKidsOrPets` → enum `yes` \| `no`
- `known.facadeMaterialPreference` → `durable` \| `soft` \| `mixed`
- `known.shoppingHabit` → `browse` \| `decide_fast` \| `research`
- `known.socialStyle` → `private` \| `hosting` \| `family`
- `known.budgetEur` → number

**Прочее:**

- `phase` — `intro` \| `brief` \| `survey` \| `post_survey`
- `decisionState.phase` — то же
- `decisionState.journeyMode` — `guided` \| `free`
- `decisionState.focusVariantIds`
- `decisionState.readinessScore` — number
- `decisionState.topConcerns`
- `clientProfile.segment`
- `clientProfile.emotionalDriver`
- `clientProfile.budgetAnchor` — number

Свободный ввод Field **запрещён** (сервер отклонит).

---

## Секция Then (действие)

| Ручка | Тип | Описание |
|---|---|---|
| **Action type** | select | Какой тип действия при срабатывании правила. |

### Action type = `filterCatalog`

Фильтр каталога перед генерацией плана (один ключ в UI).

| Ручка | Тип | Описание |
|---|---|---|
| **Filter key** | select | Какой фильтр применить. |
| **Filter value** | select | Значение для выбранного ключа. |

**Filter key → допустимые value:**

| Filter key | Values |
|---|---|
| `sku` | `BASE-400`, `BASE-600`, `BASE-800`, `DRAWER-400`, `DRAWER-600`, `SINK-600`, `WALL-600`, `WALL-800` |
| `category` | `base_cabinet`, `drawer_cabinet`, `sink_cabinet`, `wall_cabinet`, `tall_cabinet` |
| `preferFrom` | `known` |
| `finishId` | `white`, `oak` |

### Action type = `triggerDialogueAction`

Только речь / диалог, без смены конфигурации через этот action.

| Ручка | Тип | Values |
|---|---|---|
| **Topic** | select | `behavior_as_alternative`, `primary_from_known`, `default` |

---

## Сохранение

| Ручка | Где | Описание |
|---|---|---|
| **Save recommendation rules** | шапка админки | `PUT /api/admin/recommendation-rules` → файл + RAM. Ответ `persisted: 'file'`. |

Без Save правки пропадают после перезагрузки страницы / рестарта (если не успели сохранить).

---

## Mandatory seed (по умолчанию в файле)

| ruleId | priority | Назначение (кратко) |
|---|---|---|
| `explicit_answer_wins_over_behavior` | 1 | Явные ответы анкеты важнее поведения |
| `conflicting_behavior_becomes_alternative` | 2 | Конфликт focus vs known → диалог |
| `default_no_special_conditions` | 999 | Fallback: `BASE-600` |

Их можно править/удалять в UI; удаление меняет поведение DP4.
