import {
  CommandOutcomeKindSchema,
  IntentKindSchema
} from '@homecraft/contracts';
import { runAiPipeline } from '../ai-services/pipeline.js';
import { buildClarifyResponse, buildChangeSummary } from './output-builder.js';
import {
  appendDialogTurn,
  applyRoomDimensionSlots,
  buildRoomContext,
  persistRoomContext
} from './room-context-builder.js';
import {
  appendCommandRecord,
  getCurrentPlanVersion,
  getNextCommandSeq,
  loadIdempotentResponse,
  recordCommandRequest,
  saveIdempotentResponse,
  isVersionConflictError,
  withSessionLock
} from '../storage/local-storage.js';
import { normalizeLanguage, t } from '../i18n/messages.js';
import { runDownstream } from './run-downstream.js';
import { intentHandlers } from './intent-handlers/index.js';
import { buildIntentMessage } from './intent-messages.js';

const INTENT = IntentKindSchema.enum;
const OUTCOME = CommandOutcomeKindSchema.enum;
const HANDLER_RESPOND = /** @type {const} */ ('respond');
const PLAN_OUTCOME_CLARIFY = /** @type {const} */ ('clarify');

function buildVersionConflictResult(request, currentVersion) {
  const language = normalizeLanguage(request.language);
  return {
    statusCode: 409,
    response: {
      status: 'error',
      code: 'version_conflict',
      message: t(language, 'versionConflict', {
        expected: request.expectedVersion,
        current: currentVersion
      }),
      requestId: request.requestId,
      sessionId: request.sessionId,
      projectId: request.projectId,
      expectedVersion: request.expectedVersion,
      currentVersion,
      errors: ['version_conflict']
    }
  };
}

async function finalizeResponse({
  request,
  context,
  response,
  intentKind,
  outcomeKind,
  createdVersion = false,
  statusCode = 200
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

  const result = { response, statusCode };
  await saveIdempotentResponse(
    request.sessionId,
    request.requestId,
    statusCode,
    response
  );
  return result;
}

function resultingVersionFor(intentKind, response, createdVersion) {
  if (createdVersion) return response.planVersion ?? null;
  if (intentKind === INTENT.undo || intentKind === INTENT.redo) {
    return response.planVersion ?? null;
  }
  return null;
}

/**
 * Shared downstream path for intents without a terminal registry handler.
 * @param {import('./intent-handlers/types.js').IntentHandlerInput} input
 */
async function runDefaultIntentPath(input) {
  const { request, context, intent, plan, outcome, language } = input;
  const message = buildIntentMessage(intent, outcome, language);
  const isReadOnly =
    intent.kind === INTENT.show_price || intent.kind === INTENT.set_budget;
  const response = await runDownstream({
    request,
    context,
    plan,
    message,
    explanation: `Intent: ${intent.kind}`,
    persistVersion: !isReadOnly,
    existingVersion: isReadOnly ? context.planVersion : undefined,
    changeSummary: buildChangeSummary(plan, message, {
      sinceOperationCount: context.planOperations.length
    }),
    view: { kind: '3d_scene', render: 'full' }
  });
  const isRejected = Boolean(
    response.compatibility && !response.compatibility.valid
  );
  let outcomeKind = OUTCOME.applied;
  if (isRejected) {
    outcomeKind = OUTCOME.rejected;
  } else if (isReadOnly) {
    outcomeKind = OUTCOME.read_only;
  }
  return {
    response,
    outcomeKind,
    createdVersion: !isReadOnly && !isRejected
  };
}

/**
 * Runs AI pipeline + intent dispatch; returns fields for the single finalizeResponse call.
 * @param {import('./intent-handlers/types.js').ClientRequest} request
 * @param {import('./intent-handlers/types.js').RoomContext} context
 */
async function resolveRoutedCommand(request, context) {
  const { intent, plan, outcome } = await runAiPipeline(request, context);
  let nextContext = applyRoomDimensionSlots(context, intent);
  const language = normalizeLanguage(request.language ?? intent.language);
  const handlerInput = {
    request,
    context: nextContext,
    intent,
    plan,
    outcome,
    language
  };

  // Clarify before registry: shared pipeline outcome, not an intent property.
  if (outcome.kind === PLAN_OUTCOME_CLARIFY) {
    return {
      context: nextContext,
      response: buildClarifyResponse(
        request,
        outcome.prompt,
        nextContext.planVersion
      ),
      intentKind: intent.kind,
      outcomeKind: OUTCOME.clarify,
      createdVersion: false
    };
  }

  const handler = intentHandlers[intent.kind];
  if (handler) {
    const result = await handler(handlerInput);
    if (result.kind === HANDLER_RESPOND) {
      return {
        context: result.context ?? nextContext,
        response: result.response,
        intentKind: intent.kind,
        outcomeKind: result.outcomeKind,
        createdVersion: result.createdVersion ?? false
      };
    }
    nextContext = result.context ?? nextContext;
    handlerInput.context = nextContext;
  }

  const defaultResult = await runDefaultIntentPath(handlerInput);
  return {
    context: nextContext,
    response: defaultResult.response,
    intentKind: intent.kind,
    outcomeKind: defaultResult.outcomeKind,
    createdVersion: defaultResult.createdVersion
  };
}

/**
 * Routes a dialog command through intent detection and the shared downstream pipeline.
 */
export async function route(request) {
  const cached = await loadIdempotentResponse(
    request.sessionId,
    request.requestId
  );
  if (cached) {
    return cached;
  }

  return withSessionLock(request.sessionId, async () => {
    const cachedInsideLock = await loadIdempotentResponse(
      request.sessionId,
      request.requestId
    );
    if (cachedInsideLock) {
      return cachedInsideLock;
    }

    await recordCommandRequest(request);

    const currentVersion = await getCurrentPlanVersion(
      request.sessionId,
      request.projectId
    );
    if (request.expectedVersion !== currentVersion) {
      const conflict = buildVersionConflictResult(request, currentVersion);
      await saveIdempotentResponse(
        request.sessionId,
        request.requestId,
        conflict.statusCode,
        conflict.response
      );
      return conflict;
    }

    let context = await buildRoomContext(
      undefined,
      request.projectId,
      request.sessionId,
      request.inputChannel
    );
    if (request.catalogSnapshotId) {
      context = { ...context, catalogSnapshotId: request.catalogSnapshotId };
    }
    context = { ...context, planVersion: currentVersion };
    context = appendDialogTurn(context, 'user', request.command);
    await persistRoomContext(context);

    try {
      const resolved = await resolveRoutedCommand(request, context);
      return finalizeResponse({
        request,
        context: resolved.context,
        response: resolved.response,
        intentKind: resolved.intentKind,
        outcomeKind: resolved.outcomeKind,
        createdVersion: resolved.createdVersion
      });
    } catch (error) {
      if (isVersionConflictError(error)) {
        const conflict = buildVersionConflictResult(
          request,
          error.currentVersion
        );
        await saveIdempotentResponse(
          request.sessionId,
          request.requestId,
          conflict.statusCode,
          conflict.response
        );
        return conflict;
      }
      throw error;
    }
  });
}
