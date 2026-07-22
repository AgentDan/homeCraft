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
import { getCachedBOM } from '../pricing-engine/bom-cache.js';
import {
  appendPlanVersion,
  navigatePlanHistory,
  recordCommandRequest
} from '../storage/local-storage.js';
import { normalizeLanguage, t } from '../i18n/messages.js';

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
  const language = normalizeLanguage(request.language);
  const compatibility = await assertCompatible(plan, context);
  const scene = await runKitchenPipeline(plan, context);
  const bom = await getCachedBOM(plan, plan.catalogSnapshotId);
  const effectiveMessage = compatibility.valid
    ? message
    : t(language, 'changesRejected', {
      details: compatibility.conflicts.map((conflict) => conflict.message).join(' ')
    });
  const versionEntry =
    persistVersion && existingVersion === undefined && compatibility.valid
      ? await appendPlanVersion(request.sessionId, request.projectId, plan)
      : null;

  const budgetExplanation =
    context.budgetEur !== undefined && bom.totalEur > context.budgetEur
      ? t(language, 'budgetExceeded', {
        over: bom.totalEur - context.budgetEur
      })
      : undefined;

  return buildOutput({
    request,
    plan,
    scene,
    bom,
    compatibility,
    roomShape: context.roomShape,
    budgetEur: context.budgetEur ?? null,
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
  const language = normalizeLanguage(request.language);
  const entry = await navigatePlanHistory(
    request.sessionId,
    request.projectId,
    intentKind
  );

  if (!entry) {
    const prompt =
      intentKind === 'undo'
        ? t(language, 'nothingToUndo')
        : t(language, 'nothingToRedo');
    return buildClarifyResponse(request, prompt);
  }

  const message =
    intentKind === 'undo' ? t(language, 'undone') : t(language, 'redone');
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

  const language = normalizeLanguage(request.language ?? intent.language);

  if (intent.kind === 'undo' || intent.kind === 'redo') {
    const response = await handleHistoryIntent(request, context, intent.kind);
    return finalizeResponse(context, response);
  }

  if (intent.kind === 'help') {
    const help = buildHelpResponse(request, getHelpMessage(language));
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
        t(language, 'budgetClarify'),
        context.planVersion
      );
      return finalizeResponse(context, clarify);
    }
    context = { ...context, budgetEur: intent.slots.budgetEur };
  }

  const messages = {
    add_module:
      (outcome.addedCount ?? 0) > 1
        ? t(language, 'starterKitchenAdded', { count: outcome.addedCount ?? 0 })
        : t(language, 'moduleAdded', { sku: outcome.sku ?? '' }),
    remove_module: t(language, 'moduleRemoved', {
      instanceId: outcome.instanceId ?? ''
    }),
    replace_module: t(language, 'moduleReplaced', {
      instanceId: outcome.instanceId ?? '',
      sku: outcome.sku ?? ''
    }),
    change_finish: t(language, 'finishSelected', {
      finishId: outcome.finishId ?? '',
      instanceId: outcome.instanceId ?? ''
    }),
    set_budget: t(language, 'budgetSet', {
      budgetEur: intent.slots?.budgetEur ?? 0
    }),
    show_price: t(language, 'priceCalculated')
  };

  const readOnly = intent.kind === 'show_price' || intent.kind === 'set_budget';
  const newOperations = plan.operations.slice(context.planOperations.length);
  const changeSummary = {
    text: messages[intent.kind] ?? t(language, 'commandCompleted'),
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
    message: messages[intent.kind] ?? t(language, 'commandCompleted'),
    explanation: `Intent: ${intent.kind}`,
    persistVersion: !readOnly,
    existingVersion: readOnly ? context.planVersion : undefined,
    changeSummary,
    view: { kind: '3d_scene', render: 'full' }
  });

  return finalizeResponse(context, response);
}
