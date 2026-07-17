# Диалог с системой

Сейчас диалог устроен как цепочка:

```text
Пользователь → текстовая команда → POST /api/commands
→ определение intent → ConfigurationPlan
→ совместимость → сцена → BOM
→ ClientResponse (Say + Show + Ask)
→ ResponseRouter на клиенте
```

## 1. Клиент отправляет один ход

Для каждой команды клиент создаёт новый `requestId`, но сохраняет общие `sessionId` и `projectId`.

`apps/client/src/App.jsx`, строки 37–45:

```js
const result = await postCommand({
  requestId: newId('req'),
  sessionId,
  projectId,
  inputChannel,
  command,
  clientState: {}
});
```

- система поддерживает только диалоговый ввод, поэтому отдельный `inputMode` не нужен;
- `inputChannel` — `text` или `voice`;
- голос пока фактически не реализован: нет STT и кнопки микрофона, UI отправляет текст;
- после STT распознанный текст должен попадать в то же поле `command`.

## 2. Сервер создаёт контекст хода

`orchestrator.route()`:

1. записывает запрос в сессию;
2. создаёт `RoomContext`;
3. добавляет текущую реплику пользователя;
4. запускает AI pipeline.

`apps/server/src/core/orchestrator.js`, строки 97–116:

```js
export async function route(request) {
  await recordCommandRequest(request);

  let context = await buildRoomContext(
    undefined,
    request.projectId,
    request.sessionId,
    request.inputChannel
  );

  const text = request.command ?? '';
  context = appendDialogTurn(context, 'user', text);

  const { intent, plan } = await runAiPipeline(request, context);
```

## 3. AI pipeline распознаёт намерение

Последовательность:

```text
intent-detector
→ catalog RAG
→ prompt-builder
→ configuration-plan-generator
```

После этого получается единый `ConfigurationPlan`.

## 4. Обрабатываются специальные команды

Отдельно работают:

- `help`;
- неизвестная команда → `unknown_intent`;
- `undo`;
- `redo`.

Для `undo`/`redo` сервер выбирает сохранённую версию плана и заново проводит её через downstream pipeline.

`apps/server/src/core/orchestrator.js`, строки 39–57:

```js
const compatibility = await assertCompatible(plan, context);
const scene = await runKitchenPipeline(plan, context);
const bom = await calculateBOM(plan, plan.catalogSnapshotId);

const versionEntry =
  existingVersion === undefined && compatibility.valid
    ? await appendPlanVersion(request.sessionId, request.projectId, plan)
    : null;
```

Версии плана сохраняются на диске в `apps/server/data/sessions/`.

## 5. Ответ состоит из трёх каналов

`ClientResponse` содержит:

### Say

- `message` — текст на экран;
- `speech` — короткая реплика для будущего TTS.

### Show

- `sceneResult`;
- `view.kind`: `2d_plan` или `3d_scene`;
- `view.render`: `full` или `delta`;
- `changeSummary`.

### Ask

- `interaction.expects`;
- `prompt`;
- `options`.

Возможные типы ответа:

```text
scene
conflict
help
unknown_intent
clarify
options
confirm
```

## 6. Клиент маршрутизирует ответ

`ResponseRouter` выбирает UI по `responseType`:

- `scene` → текст, `ScenePreview`, список изменений;
- `clarify` → вопрос и поле ответа;
- `options` → кнопки вариантов;
- `confirm` → кнопки «Да» и «Нет»;
- `conflict`, `help`, `unknown_intent` → текстовая подсказка.

Выбор кнопки снова отправляется как обычная текстовая команда.

## Важные ограничения текущего step0

### История реплик фактически не сохраняется

`buildRoomContext()` на каждом запросе создаёт `dialogTurns: []`, после чего добавляется только текущая команда.

`apps/server/src/core/room-context-builder.js`, строки 23–32:

```js
export async function buildRoomContext(userId, projectId, sessionId, inputChannel = 'text') {
  const context = {
    // ...
    dialogTurns: [],
    updatedAt: new Date().toISOString()
  };
```

Поэтому система пока не понимает выражения вроде «сделай его шире» на основе предыдущей реплики.

### Планы из текста пока пустые

На step0 генератор плана из диалоговой команды возвращает `operations: []`.

### Сцена пока является заглушкой

Реальной 2D/3D-визуализации нет.

### Интерактивные ответы подключены только на уровне каркаса

`clarify`, `options` и `confirm` существуют в контракте и UI, но AI pipeline ещё почти не создаёт такие ответы.

### TTS не подключён

Поле `speech` уже приходит, но клиент его пока не озвучивает.

## Итог

Транспорт, intents, богатый контракт ответа, UI-маршрутизация и `undo`/`redo` уже работают. Полноценная многоходовая память, STT/TTS и генерация реальных операций остаются следующими этапами.
