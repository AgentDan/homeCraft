# HomeCraft Admin / DP4 — единый глоссарий

Справочник элементов админки и контекста правил.  
**Источник правды — код и Zod-схемы**, не продуктовый словарь.  
Где в репозитории нет закрытого enum / продуктового определения — так и написано.

| Связанные docs | |
|---|---|
| UI-ручки rules | [admin-recommendation-rules.md](./admin-recommendation-rules.md) |
| Зачем ручки (простыми словами) | [admin-recommendation-rules-why.md](./admin-recommendation-rules-why.md) |
| Каталог значений Admin | `packages/contracts/src/admin-catalog.js` |
| Операторы условий | `apps/server/src/core/recommendation-engine.js` → `matchAtomicCondition` |
| DecisionState | `packages/contracts/src/decision-state.js`, `apps/server/src/core/decision-state.js` |
| ClientProfile | тот же `decision-state.js` + `PUT /api/client-profiles/:clientId` |

**Как пользоваться:** Ctrl+F по имени (`known.budgetEur`, `exists`, `filterCatalog`…).

---

## 1. Оглавление по разделам

1. [Контекст правила (откуда берутся Field)](#2-контекст-правила-rulectx)
2. [Condition Field](#3-condition-field)
3. [Condition Operator](#4-condition-operator)
4. [Condition kind](#5-condition-kind)
5. [Rule Meta](#6-rule-meta)
6. [Action / Then](#7-action-then)
7. [Filter key / value](#8-filter-key--value)
8. [Dialogue topic](#9-dialogue-topic)
9. [Journey question slots](#10-journey-question-slots-known)
10. [Journey admin enums](#11-journey-admin-прочее)
11. [DecisionState (все поля схемы)](#12-decisionstate--поля-схемы)
12. [ClientProfile (все поля схемы)](#13-clientprofile--поля-схемы)
13. [Алфавитный указатель](#14-алфавитный-указатель)

---

## 2. Контекст правила (`ruleCtx`)

При DP4 движок собирает объект и ищет Field по path (`a.b.c`):

```js
{
  known: journey.known,       // ответы анкеты
  decisionState: { ... },     // DecisionState клиента
  clientProfile: { ... },     // или {}
  phase: 'intro'|'brief'|'survey'|'post_survey'
}
```

Код: `recommendation-engine.js` (сборка `ruleCtx`).  
`phase` дублирует логику DS: если `journey.stage === 'done'` или `decisionState.phase === 'post_survey'` → `'post_survey'`, иначе `decisionState.phase`.

---

## 3. Condition Field

Закрытый список: `ADMIN_CONDITION_FIELDS`.  
Свободный текст → admin API отклонит.

### 3.1 `phase`

| | |
|---|---|
| **Тип в контексте** | `string` |
| **Значения** | `intro` \| `brief` \| `survey` \| `post_survey` |
| **Откуда** | вычисляется при DP4 (см. §2) |
| **В схеме DS** | `DecisionPhaseSchema` |

### 3.2 `known.*` (ответы анкеты)

Значения пишутся в `journey.known[slot]` после валидации ответа (`journey-table` / dialog-router).  
Слоты = `ADMIN_KNOWN_SLOTS`. Подробности слотов — §10.

| Field | Тип значения (по seed/валидации) | Enum / формат |
|---|---|---|
| `known.clientName` | string | текст |
| `known.projectGoal` | string | текст |
| `known.roomWidthMm` | number | мм (dimension) |
| `known.roomDepthMm` | number | мм |
| `known.hasKidsOrPets` | string | `yes` \| `no` |
| `known.facadeMaterialPreference` | string | `durable` \| `soft` \| `mixed` |
| `known.shoppingHabit` | string | `browse` \| `decide_fast` \| `research` |
| `known.socialStyle` | string | `private` \| `hosting` \| `family` |
| `known.budgetEur` | number | € |

### 3.3 `decisionState.*` (в каталоге Field)

| Field | Тип в схеме | Как заполняется в коде |
|---|---|---|
| `decisionState.phase` | enum фаз | из `journey.stage` (`done` → `post_survey`); см. `phaseFromJourneyStage` |
| `decisionState.journeyMode` | `guided` \| `free` | из `journey.mode` / событие `mode_free` |
| `decisionState.focusVariantIds` | `string[]` | `hover_long` с `durationMs > 20000` → push `targetId` (`HOVER_LONG_FOCUS_MS`) |
| `decisionState.readinessScore` | `number` 0…1 | пересчёт `computeReadinessScore` (фаза + focus + reject + free mode) |
| `decisionState.topConcerns` | `string[]` (max 5) | из событий: `re_ask` → `clarification`; `reject_variant` → `rejection`; `compare` → `comparing` |

**Есть в схеме DecisionState, но нет в Admin Field-каталоге:**  
`clientId`, `rejectedIds`, `lastSignals` — в правилах через UI **не выбрать**.

### 3.4 `clientProfile.*` (в каталоге Field)

| Field | Тип в схеме | Откуда | Закрытый enum в репо? |
|---|---|---|---|
| `clientProfile.segment` | `string \| null` | `PUT /api/client-profiles/:clientId` | **нет** — произвольная строка по схеме |
| `clientProfile.emotionalDriver` | `string \| null` | то же | **нет** |
| `clientProfile.budgetAnchor` | `number \| null` | то же | **нет** |

Комментарий в коде: *«Minimal ClientProfile — filled manually (admin API); not inferred from dialog text»*.  
Продуктовых значений segment/driver в репозитории **не зафиксировано**.

---

## 4. Condition Operator

Список: `ADMIN_CONDITION_OPERATORS`.  
Семантика: `matchAtomicCondition` в `recommendation-engine.js`.

| Operator | Условие true, если |
|---|---|
| `equals` | `actual === value` |
| `not_equals` | `actual !== value` |
| `exists` | `value === true`: поле есть и не «пусто»; `value === false`: наоборот. Пусто = `undefined` \| `null` \| `''` \| `[]` |
| `in` | `Array.isArray(value)` и `value.includes(actual)` |
| `not_in` | массив `value` и `actual` **не** в нём |
| `gt` | оба number и `actual > value` |
| `gte` | оба number и `actual >= value` |
| `lt` | оба number и `actual < value` |
| `lte` | оба number и `actual <= value` |

Если `gt`…`lte`, а типы не number → **false**.  
Если `in`/`not_in`, а `value` не массив → **false** (в Admin UI Value часто одно значение — для списка обычно нужен `equals`).

---

## 5. Condition kind

UI-форма `condition` (не отдельное поле JSON как строка — UI мапит в объекты схемы).

| Kind (UI) | JSON shape | Логика `matchCondition` |
|---|---|---|
| `always` | `{ always: true }` | всегда true |
| `atomic` | `{ field, operator, value }` | одно atomic |
| `allOf` | `{ allOf: [atomic…] }` 1…3 | все atomic true (AND) |
| `anyOf` | `{ anyOf: [atomic…] }` 1…3 | хотя бы один (OR) |

---

## 6. Rule Meta

| Элемент | Тип (схема) | Факт из кода |
|---|---|---|
| `ruleId` | `string` min 1 | id правила; сортировка tie-break: `localeCompare` |
| `priority` | `int` | меньше = раньше в `evaluateRecommendationRules` |
| `active` | `boolean` | `false` → правило отфильтровывается до match |
| `condition` | `ConditionSchema` | When |
| `action` | `RecommendationActionSchema` | Then |

Seed ids (код `MANDATORY_RECOMMENDATION_RULES`):  
`explicit_answer_wins_over_behavior` (1),  
`conflicting_behavior_becomes_alternative` (2),  
`default_no_special_conditions` (999).

Persist: `apps/server/data/recommendation-rules.json`.

---

## 7. Action (Then)

| `action.type` | Поля | Назначение в коде |
|---|---|---|
| `filterCatalog` | `filters: Record<string,string>` | мержится в `decision.filters` → `resolveCatalogSlotsFromFilters` → SKU/category для plan |
| `triggerDialogueAction` | `topic: string` | попадает в `dialogueTopics` → речь / `ConfigurationIntent.dialogueTopic` |

Инвариант: речь и конфиг разделены; конфиг дальше только через `generatePlan` → `assertCompatible` → `calculateBOM`.

---

## 8. Filter key / value

Ключи: `ADMIN_FILTER_KEYS`. Значения — соответствующие списки в `admin-catalog.js`.

| key | Допустимые value (каталог) | Роль в `resolveCatalogSlotsFromFilters` |
|---|---|---|
| `sku` | `BASE-400`, `BASE-600`, `BASE-800`, `DRAWER-400`, `DRAWER-600`, `SINK-600`, `WALL-600`, `WALL-800` | прямой слот sku (может быть перебит `preferFrom: known`) |
| `category` | `base_cabinet`, `drawer_cabinet`, `sink_cabinet`, `wall_cabinet`, `tall_cabinet` | слот category |
| `preferFrom` | только `known` | маппинг из `known.facadeMaterialPreference` / `known.budgetEur` в sku (см. код) |
| `finishId` | `white`, `oak` | уходит в slots как `finishId` |

Маппинг при `preferFrom === 'known'` (код):

| known | → sku |
|---|---|
| facade `durable` | `BASE-600` |
| facade `soft` | `DRAWER-600` |
| facade `mixed` | `BASE-800` |
| `budgetEur < 15000` | `BASE-400` (перебивает) |
| иначе без sku | fallback `BASE-600` |

---

## 9. Dialogue topic

Каталог: `ADMIN_DIALOGUE_TOPICS`.

| topic | Что делает код сейчас |
|---|---|
| `behavior_as_alternative` | если есть в topics и есть `alternativeSkus` → доп. фраза `dp4BehaviorAlternative` |
| `primary_from_known` | в каталоге разрешён; **отдельной ветки** в `buildDialogueSpeech` нет (только общая primary-фраза) |
| `default` | то же: отдельной ветки нет |

Primary речь всегда: `dp4PrimaryRecommendation` с `sku`.

---

## 10. Journey question slots (`known`)

Слоты = вопросы анкеты. Seed: `DEFAULT_JOURNEY_QUESTIONS` в `journey-table.js`.  
Persist questions: Mongo `journey_questions` (+ RAM).

| slot | stage (seed) | validation (seed) | i18nKey (seed) |
|---|---|---|---|
| `clientName` | intro | text | `journeyAskClientName` |
| `projectGoal` | brief | text | `journeyAskProjectGoal` |
| `roomWidthMm` | survey | dimension mm | `journeyAskRoomWidth` |
| `roomDepthMm` | survey | dimension mm | `journeyAskRoomDepth` |
| `hasKidsOrPets` | survey | enum yes/no | `journeyAskHasKidsOrPets` |
| `facadeMaterialPreference` | survey | enum durable/soft/mixed; dependsOn hasKidsOrPets=yes | `journeyAskFacadeMaterial` |
| `shoppingHabit` | survey | enum browse/decide_fast/research | `journeyAskShoppingHabit` |
| `socialStyle` | survey | enum private/hosting/family | `journeyAskSocialStyle` |
| `budgetEur` | survey | number | `journeyAskBudgetEur` |

Тексты вопросов: `apps/server/src/i18n/messages.js` по `i18nKey`.

---

## 11. Journey admin (прочее)

| Элемент | Значения / факт |
|---|---|
| Journey **stage** (вопрос) | `intro` \| `brief` \| `survey` (не `done` / не `post_survey` на вопросе) |
| Validation **type** | `text` \| `number` \| `enum` \| `dimension` |
| Dimension **unit** | `mm` \| `m` |
| dependsOn **operator** | `equals` \| `not_equals` \| `in` \| `not_in` |
| Question **active** | boolean — неактивный не идёт в опрос |
| Question **order** | int — порядок; dependsOn только на слот с меньшим order |

---

## 12. DecisionState — поля схемы

Файл: `data/decision-state/<clientId>.json`.

| Поле | Тип | Как появляется |
|---|---|---|
| `clientId` | string | ключ клиента (= projectId в DP4) |
| `phase` | intro/brief/survey/post_survey | journey stage / events |
| `journeyMode` | guided/free | journey mode / `mode_free` |
| `focusVariantIds` | string[] | hover_long > 20s |
| `rejectedIds` | `{ variantId, reason }[]` | `reject_variant` |
| `topConcerns` | string[] | clarification / rejection / comparing |
| `readinessScore` | 0…1 | формула от phase/focus/reject/mode |
| `lastSignals` | BehaviorSignal[] | последние behavior_signal (max 20) |

Сигналы Observation (клиент): `click` \| `hover_long` \| `reject_variant` \| `compare`.

---

## 13. ClientProfile — поля схемы

Файлы: `data/client-profiles/<clientId>.json`.  
API: `GET/PUT /api/client-profiles/:clientId`.

| Поле | Тип | В Admin Field? | Продуктовый словарь в репо |
|---|---|---|---|
| `clientId` | string | нет | — |
| `segment` | string \| null | да → `clientProfile.segment` | **не задан** |
| `emotionalDriver` | string \| null | да | **не задан** |
| `budgetAnchor` | number \| null | да | **не задан** (только тип number) |
| `valueWeights` | `Record<string, number>` | нет | **не задан** |
| `updatedAt` | datetime optional | нет | — |

Roadmap: Learning/DP4 не читает прошлые сессии напрямую — использовать `ClientProfile`.

---

## 14. Алфавитный указатель

| Имя | Раздел |
|---|---|
| `active` (rule/question) | §6, §11 |
| `allOf` / `anyOf` / `atomic` / `always` | §5 |
| `BASE-*` / `DRAWER-*` / … | §8 |
| `behavior_as_alternative` | §9 |
| `budgetEur` / `known.budgetEur` | §3.2, §10 |
| `budgetAnchor` | §3.4, §13 |
| `category` (filter) | §8 |
| `clientName` | §10 |
| `clientProfile.*` | §3.4, §13 |
| `compare` / `click` / `hover_long` / `reject_variant` | §12 |
| `condition` | §5–6 |
| `decisionState.*` | §3.3, §12 |
| `default` (topic) | §9 |
| `default_no_special_conditions` | §6 |
| `dependsOn` | §11 |
| `emotionalDriver` | §3.4, §13 |
| `equals` / `exists` / `gt` / … | §4 |
| `facadeMaterialPreference` | §10 |
| `filterCatalog` | §7–8 |
| `finishId` | §8 |
| `focusVariantIds` | §3.3, §12 |
| `guided` / `free` | §3.3 |
| `hasKidsOrPets` | §10 |
| `i18nKey` / `journeyAsk*` | §10–11 |
| `in` / `not_in` | §4 |
| `intro` / `brief` / `survey` / `post_survey` / `done` | §3.1, §10–12 |
| `known.*` | §3.2 |
| `phase` | §3.1 |
| `preferFrom` | §8 |
| `primary_from_known` | §9 |
| `priority` | §6 |
| `projectGoal` | §10 |
| `readinessScore` | §3.3, §12 |
| `recommendation-rules.json` | §6 |
| `rejectedIds` | §12 (не в Admin Field) |
| `ruleId` | §6 |
| `segment` | §3.4, §13 |
| `shoppingHabit` / `socialStyle` | §10 |
| `sku` | §8 |
| `topConcerns` | §3.3, §12 |
| `triggerDialogueAction` | §7, §9 |
| `valueWeights` | §13 |

---

## 15. Правила ведения глоссария

1. Новое значение в Admin UI → сначала `admin-catalog.js` (+ валидатор), потом строка здесь.  
2. Не добавлять «продуктовый смысл», которого нет в коде/схеме/CHANGELOG — писать **«не задано в репо»**.  
3. UI-гайды не заменяют этот файл: они про кнопки; этот файл — про **имена и факты**.
