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
  appendCommandRecord,
  appendPlanVersion,
  getNextCommandSeq,
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
      ? await appendPlanVersion(
          request.sessionId,
          request.projectId,
          plan,
          request.requestId
        )
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

async function finalizeResponse({
  request,
  context,
  response,
  intentKind,
  outcomeKind,
  createdVersion = false
}) {
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

  const compatibilityValid =
    response.compatibility == null ? null : Boolean(response.compatibility.valid);

  await appendCommandRecord({
    requestId: request.requestId,
    projectId: request.projectId,
    sessionId: request.sessionId,
    seq: await getNextCommandSeq(request.projectId),
    rawInput: request.command,
    inputChannel: request.inputChannel ?? 'text',
    language: normalizeLanguage(request.language),
    intentKind,
    outcomeKind,
    compatibilityValid,
    resultingVersion: resultingVersionFor(
      intentKind,
      response,
      createdVersion
    ),
    catalogSnapshotId: context.catalogSnapshotId,
    createdAt: new Date().toISOString()
  });

  return { response, statusCode: 200 };
}

function resultingVersionFor(intentKind, response, createdVersion) {
  if (createdVersion) return response.planVersion ?? null;
  if (intentKind === 'undo' || intentKind === 'redo') {
    return response.planVersion ?? null;
  }
  return null;
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
    return {
      response: buildClarifyResponse(request, prompt),
      outcomeKind: /** @type {const} */ ('clarify'),
      createdVersion: false
    };
  }

  const message =
    intentKind === 'undo' ? t(language, 'undone') : t(language, 'redone');
  const response = await runDownstream({
    request,
    context,
    plan: entry.plan,
    message,
    explanation: `Intent: ${intentKind}`,
    existingVersion: entry.version,
    changeSummary: { text: message, added: [], removed: [], moved: [] },
    view: { kind: '2d_plan', render: 'full' }
  });
  return {
    response,
    outcomeKind: /** @type {const} */ ('applied'),
    createdVersion: false
  };
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
    const historyResult = await handleHistoryIntent(request, context, intent.kind);
    return finalizeResponse({
      request,
      context,
      response: historyResult.response,
      intentKind: intent.kind,
      outcomeKind: historyResult.outcomeKind,
      createdVersion: historyResult.createdVersion
    });
  }

  if (intent.kind === 'help') {
    const help = buildHelpResponse(request, getHelpMessage(language));
    return finalizeResponse({
      request,
      context,
      response: help,
      intentKind: 'help',
      outcomeKind: 'read_only'
    });
  }

  if (intent.kind === 'unknown') {
    const unknown = buildUnknownIntentResponse(request, context);
    return finalizeResponse({
      request,
      context,
      response: unknown,
      intentKind: 'unknown',
      outcomeKind: 'clarify'
    });
  }

  if (outcome.kind === 'clarify') {
    const clarify = buildClarifyResponse(
      request,
      outcome.prompt,
      context.planVersion
    );
    return finalizeResponse({
      request,
      context,
      response: clarify,
      intentKind: intent.kind,
      outcomeKind: 'clarify'
    });
  }

  if (intent.kind === 'set_budget') {
    if (intent.slots?.budgetEur === undefined) {
      const clarify = buildClarifyResponse(
        request,
        t(language, 'budgetClarify'),
        context.planVersion
      );
      return finalizeResponse({
        request,
        context,
        response: clarify,
        intentKind: 'set_budget',
        outcomeKind: 'clarify'
      });
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

  const rejected = response.compatibility && !response.compatibility.valid;
  const createdVersion = !readOnly && !rejected;
  const outcomeKind = rejected ? 'rejected' : readOnly ? 'read_only' : 'applied';

  return finalizeResponse({
    request,
    context,
    response,
    intentKind: intent.kind,
    outcomeKind,
    createdVersion
  });
}
