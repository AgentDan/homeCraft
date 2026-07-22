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
  buildRoomContext,
  persistRoomContext
} from './room-context-builder.js';
import { getHelpMessage } from './help-service.js';
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
  persistVersion = true,
  existingVersion,
  changeSummary,
  view
}) {
  const compatibility = await assertCompatible(plan, context);
  const scene = await runKitchenPipeline(plan, context);
  const bom = await calculateBOM(plan, plan.catalogSnapshotId);
  const effectiveMessage = compatibility.valid
    ? message
    : `Changes rejected: ${compatibility.conflicts
      .map((conflict) => conflict.message)
      .join(' ')}`;
  const versionEntry =
    persistVersion && existingVersion === undefined && compatibility.valid
      ? await appendPlanVersion(request.sessionId, request.projectId, plan)
      : null;

  const budgetExplanation =
    context.budgetEur !== undefined && bom.totalEur > context.budgetEur
      ? `The cost exceeds the budget by €${bom.totalEur - context.budgetEur}.`
      : undefined;

  return buildOutput({
    request,
    plan,
    scene,
    bom,
    compatibility,
    roomShape: context.roomShape,
    message: effectiveMessage,
    explanation: budgetExplanation
      ? [explanation, budgetExplanation].filter(Boolean).join(' ')
      : explanation,
    changeSummary: compatibility.valid
      ? changeSummary
      : {
        text: effectiveMessage,
        added: [],
        removed: [],
        moved: []
      },
    view,
    planVersion: existingVersion ?? versionEntry?.version ?? context.planVersion ?? 0
  });
}

async function finalizeResponse(context, response) {
  let nextContext = context;
  if (response.plan && response.compatibility?.valid) {
    nextContext = {
      ...nextContext,
      planOperations: structuredClone(response.plan.operations),
      planVersion: response.planVersion
    };
  }
  nextContext = appendDialogTurn(nextContext, 'assistant', response.message);
  await persistRoomContext(nextContext);
  return { response, statusCode: 200 };
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
        ? 'There is nothing to undo. Describe what you want to change.'
        : 'There is nothing to redo. Undo a change first.';
    return buildClarifyResponse(request, prompt);
  }

  const message =
    intentKind === 'undo'
      ? 'The last change was undone.'
      : 'The undone change was restored.';
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
 * Routes a dialog command through intent detection and the shared downstream pipeline.
 */
export async function route(request) {
  await recordCommandRequest(request);

  let context = await buildRoomContext(
    undefined,
    request.projectId,
    request.sessionId,
    request.inputChannel
  );

  if (request.catalogSnapshotId) {
    context = { ...context, catalogSnapshotId: request.catalogSnapshotId };
  }

  context = appendDialogTurn(context, 'user', request.command);

  await persistRoomContext(context);

  const { intent, plan, outcome } = await runAiPipeline(request, context);

  if (intent.slots?.roomWidthMm && intent.slots?.roomDepthMm) {
    context = {
      ...context,
      roomShape: {
        ...context.roomShape,
        dimensions: {
          ...context.roomShape.dimensions,
          widthMm: intent.slots.roomWidthMm,
          depthMm: intent.slots.roomDepthMm
        }
      }
    };
  }

  if (intent.kind === 'undo' || intent.kind === 'redo') {
    const response = await handleHistoryIntent(request, context, intent.kind);
    return finalizeResponse(context, response);
  }

  if (intent.kind === 'help') {
    const help = buildHelpResponse(request, getHelpMessage());
    return finalizeResponse(context, help);
  }

  if (intent.kind === 'unknown') {
    const unknown = buildUnknownIntentResponse(request, context);
    return finalizeResponse(context, unknown);
  }

  if (outcome.kind === 'clarify') {
    const clarify = buildClarifyResponse(
      request,
      outcome.prompt,
      context.planVersion
    );
    return finalizeResponse(context, clarify);
  }

  if (intent.kind === 'set_budget') {
    if (intent.slots?.budgetEur === undefined) {
      const clarify = buildClarifyResponse(
        request,
        'Enter a numeric budget, for example "budget up to 150000".',
        context.planVersion
      );
      return finalizeResponse(context, clarify);
    }
    context = { ...context, budgetEur: intent.slots.budgetEur };
  }

  const messages = {
    add_module:
      (outcome.addedCount ?? 0) > 1
        ? `Starter kitchen added: ${outcome.addedCount} modules.`
        : `Module ${outcome.sku} added.`,
    remove_module: `Module ${outcome.instanceId} removed.`,
    replace_module: `Module ${outcome.instanceId} replaced with ${outcome.sku}.`,
    change_finish: `Finish ${outcome.finishId} selected for ${outcome.instanceId}.`,
    set_budget: `Budget set to €${intent.slots?.budgetEur}.`,
    show_price: 'Project cost calculated.'
  };

  const readOnly = intent.kind === 'show_price' || intent.kind === 'set_budget';
  const newOperations = plan.operations.slice(context.planOperations.length);
  const changeSummary = {
    text: messages[intent.kind] ?? 'Command completed.',
    added: newOperations
      .filter(
        (operation) =>
          operation.type === 'add_module' || operation.type === 'replace_module'
      )
      .map((operation) => operation.sku),
    removed: newOperations
      .filter(
        (operation) =>
          operation.type === 'remove_module' || operation.type === 'replace_module'
      )
      .map((operation) => operation.instanceId),
    moved: newOperations
      .filter((operation) => operation.type === 'move_module')
      .map((operation) => operation.instanceId)
  };
  const response = await runDownstream({
    request,
    context,
    plan,
    message: messages[intent.kind] ?? 'Command completed.',
    explanation: `Intent: ${intent.kind}`,
    persistVersion: !readOnly,
    existingVersion: readOnly ? context.planVersion : undefined,
    changeSummary,
    view: { kind: '3d_scene', render: 'full' }
  });

  return finalizeResponse(context, response);
}
