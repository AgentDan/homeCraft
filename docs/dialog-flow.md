# Dialog with the system

The dialog currently follows this sequence:

```text
User → text command → POST /api/commands
→ intent detection → ConfigurationPlan
→ compatibility → scene → BOM
→ ClientResponse (Say + Show + Ask)
→ ResponseRouter on the client
```

## 1. The client sends one turn

The client creates a new `requestId` for each command while retaining the shared `sessionId` and `projectId`.

`apps/client/src/App.jsx`, lines 37–45:

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

- the system supports dialog input only, so a separate `inputMode` is unnecessary;
- `inputChannel` is `text` or `voice`;
- voice input is not implemented yet: there is no STT or microphone button, and the UI sends text;
- after STT is added, recognized text must use the same `command` field.

## 2. The server creates the turn context

`orchestrator.route()`:

1. records the request in the session;
2. creates a `RoomContext`;
3. appends the current user utterance;
4. starts the AI pipeline.

`apps/server/src/core/orchestrator.js`, lines 97–116:

```js
export async function route(request) {
  await recordCommandRequest(request);

  let context = await buildRoomContext(
    undefined,
    request.projectId,
    request.sessionId,
    request.inputChannel
  );

  context = appendDialogTurn(context, 'user', request.command);
  await persistRoomContext(context);

  const { intent, plan, outcome } = await runAiPipeline(request, context);
```

## 3. The AI pipeline detects intent

Sequence:

```text
intent-detector
→ catalog RAG
→ prompt-builder
→ configuration-plan-generator
```

Catalog RAG reads only the active snapshot, while platform-rules retrieval adds platform rules. The rule-based generator returns a cumulative `ConfigurationPlan` and an outcome (`applied`, `clarify`, or `read_only`).

## 4. Special commands are handled

The following are handled separately:

- `help`;
- unknown command → `unknown_intent`;
- `undo`;
- `redo`.

For `undo`/`redo`, the server selects a saved plan version and runs it through the downstream pipeline again.

`apps/server/src/core/orchestrator.js`, lines 39–57:

```js
const compatibility = await assertCompatible(plan, context);
const scene = await runKitchenPipeline(plan, context);
const bom = await calculateBOM(plan, plan.catalogSnapshotId);

const versionEntry =
  existingVersion === undefined && compatibility.valid
    ? await appendPlanVersion(request.sessionId, request.projectId, plan)
    : null;
```

Plan versions are saved to disk in `apps/server/data/sessions/`. Dialog context is also saved in MongoDB when available, with a local fallback.

## 5. The response has three channels

`ClientResponse` contains:

### Say

- `message` — text displayed on screen;
- `speech` — a short utterance for future TTS.

### Show

- `sceneResult`;
- `view.kind`: `2d_plan` or `3d_scene`;
- `view.render`: `full` or `delta`;
- `changeSummary`.

### Ask

- `interaction.expects`;
- `prompt`;
- `options`.

Possible response types:

```text
scene
conflict
help
unknown_intent
clarify
options
confirm
```

## 6. The client routes the response

`ResponseRouter` selects the UI based on `responseType`:

- `scene` → text, `ScenePreview`, and a change list;
- `clarify` → a question and answer field;
- `options` → option buttons;
- `confirm` → "Yes" and "No" buttons;
- `conflict`, `help`, `unknown_intent` → a text prompt.

A button selection is sent again as a regular text command.

## Phase 1 limitations

### Rule-based plan generation

Intents and slots are converted into operations by deterministic rules. Open-ended interpretation of complex phrases and LLM function calling are planned for Phase 5.

### Simplified placement

New modules are placed sequentially along one wall. Corner and multi-row layouts will require extending the domain pipeline.

### Basic compatibility

Room boundaries, overlap, and mounting height are checked. Utilities, full clearances, and alternative selection will be expanded in Phase 2.

### Simplified 3D scene

Preview3D uses geometric boxes based on catalog dimensions. Manufacturer GLTF models are not connected yet.

### TTS is not connected

The `speech` field is already returned, but the client does not speak it yet.

## Summary

Catalog-grounded intents, real operations, multi-turn persistence, compatibility, BOM, 3D preview, and `undo`/`redo` work. STT/TTS, the LLM, and production GLTF models remain future stages.
