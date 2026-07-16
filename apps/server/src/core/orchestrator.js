import { runAiPipeline } from '../ai-services/pipeline.js';
import { assertCompatible } from '../compatibility-engine/assertCompatible.js';
import {
  buildClarifyResponse,
  buildHelpResponse,
  buildOutput,
  buildUnknownIntentResponse
} from './output-builder.js';
import {
  appendDialogTurn,
  buildRoomContext
} from './room-context-builder.js';
import { runPipeline as runKitchenPipeline } from '../domain-modules/kitchen/pipeline.js';
import { calculateBOM } from '../pricing-engine/calculateBOM.js';
import {
  appendPlanVersion,
  navigatePlanHistory,
  recordCommandRequest
} from '../storage/local-storage.js';

async function runDownstream({
  request,
  context,
  plan,
  message,
  explanation,
  existingVersion = /** @type {number | undefined} */ (undefined),
  changeSummary = /** @type {{
    text: string,
    added: string[],
    removed: string[],
    moved: string[]
  } | undefined} */ (undefined),
  view = /** @type {{
    kind: '2d_plan' | '3d_scene',
    render: 'full' | 'delta'
  } | undefined} */ (undefined)
}) {
  const compatibility = await assertCompatible(plan, context);
  const scene = await runKitchenPipeline(plan, context);
  const bom = await calculateBOM(plan, plan.catalogSnapshotId);
  const versionEntry =
    existingVersion === undefined && compatibility.valid
      ? await appendPlanVersion(request.sessionId, request.projectId, plan)
      : null;

  return buildOutput({
    request,
    plan,
    scene,
    bom,
    compatibility,
    message,
    explanation,
    changeSummary,
    view,
    planVersion: existingVersion ?? versionEntry?.version ?? 0
  });
}

async function handleHistoryIntent(request, context, intentKind) {
  const entry = await navigatePlanHistory(
    request.sessionId,
    request.projectId,
    intentKind
  );

  if (!entry) {
    // TODO(phase 1): tailor this clarification using persisted dialog context.
    const prompt =
      intentKind === 'undo'
        ? 'Нечего отменять. Опишите, что нужно изменить.'
        : 'Нечего возвращать. Сначала отмените изменение.';
    return buildClarifyResponse(request, prompt);
  }

  const message =
    intentKind === 'undo'
      ? 'Последнее изменение отменено.'
      : 'Отменённое изменение возвращено.';
  return runDownstream({
    request,
    context,
    plan: entry.plan,
    message,
    explanation: `Intent: ${intentKind}`,
    existingVersion: entry.version,
    changeSummary: { text: message, added: [], removed: [], moved: [] },
    view: { kind: '2d_plan', render: 'full' }
  });
}

/**
 * Single entry for MODE A (dialog) and MODE B (editor).
 * Both converge to ConfigurationPlan and the same downstream pipeline.
 */
export async function route(request) {
  await recordCommandRequest(request);

  console.log('request', request);

  let context = await buildRoomContext(
    undefined,
    request.projectId,
    request.sessionId,
    request.inputChannel
  );
  if (request.catalogSnapshotId) {
    context = { ...context, catalogSnapshotId: request.catalogSnapshotId };
  }

  if (request.inputMode === 'dialog') {
    const text = request.command ?? '';
    context = appendDialogTurn(context, 'user', text);

    const { intent, plan } = await runAiPipeline(request, context);

    if (intent.kind === 'undo' || intent.kind === 'redo') {
      const response = await handleHistoryIntent(request, context, intent.kind);
      return { response, statusCode: 200 };
    }

    if (intent.kind === 'help') {
      const help = buildHelpResponse(request);
      return { response: help, statusCode: 200 };
    }

    if (intent.kind === 'unknown') {
      const unknown = buildUnknownIntentResponse(request, context);
      return { response: unknown, statusCode: 200 };
    }

    // TODO(phase 1): route plan-generator clarify/options/confirm outcomes here.
    const response = await runDownstream({
      request,
      context,
      plan,
      message: 'Dialog command processed (step0).',
      explanation: `Intent: ${intent.kind}`
    });

    return { response, statusCode: 200 };
  }

  // MODE B — editor
  const { plan } = await runAiPipeline(request, context);

  const response = await runDownstream({
    request,
    context,
    plan,
    message: 'Editor operations applied (step0).',
    explanation: 'MODE B uses the same pipeline as MODE A.'
  });

  return { response, statusCode: 200 };
}
