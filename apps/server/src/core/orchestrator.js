import {
  CommandOutcomeKindSchema,
  IntentKindSchema,
  registry
} from '@homecraft/contracts';
import { runAiPipeline } from '../ai-services/pipeline.js';
import { buildClarifyResponse, buildChangeSummary } from './output-builder.js';
import {
  appendDialogTurn,
  applySiteBindings,
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
import {
  appendDialogTurnEvent,
  appendOutcomeEventSafe
} from '../storage/journey-events.js';
import { updateDecisionStateFromEventSafe } from './decision-state.js';
import { normalizeLanguage, t } from '../i18n/messages.js';
import { runDownstream } from './run-downstream.js';
import { intentHandlers } from './intent-handlers/index.js';
import { buildIntentMessage } from './intent-messages.js';
import { routeJourneyDialog } from './dialog-router.js';
import { ensureJourneyState } from './journey-table.js';
import {
  runDp4Recommendation,
  shouldTriggerDp4
} from './recommendation-engine.js';

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

/**
 * @param {string} outcomeKind
 * @param {{ compatibility?: { valid?: boolean, conflicts?: Array<{ message?: string }> } | null }} response
 */
function executionResultFrom(outcomeKind, response) {
  const rejectedByCompat =
    response.compatibility != null && response.compatibility.valid === false;
  const rejected = outcomeKind === OUTCOME.rejected || rejectedByCompat;
  if (!rejected) {
    return { status: /** @type {const} */ ('success'), reason: null };
  }
  const reason =
    response.compatibility?.conflicts?.[0]?.message
    ?? (typeof outcomeKind === 'string' ? outcomeKind : 'rejected');
  return { status: /** @type {const} */ ('rejected'), reason };
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

  // Observation timeline (best-effort; never blocks the command response).
  const clientId = request.projectId;
  await appendDialogTurnEvent({
    clientId,
    speaker: 'client',
    text: request.command
  });
  await appendDialogTurnEvent({
    clientId,
    speaker: 'agent',
    text: response.message
  });
  await appendOutcomeEventSafe({
    clientId,
    requestId: request.requestId,
    executionResult: executionResultFrom(outcomeKind, response),
    clientOutcome: null
  });

  // DecisionState outside dialog-router: journey.stage === 'done' → post_survey.
  await updateDecisionStateFromEventSafe(clientId, null, {
    journey: nextContext.journey
      ? {
          stage: nextContext.journey.stage,
          mode: nextContext.journey.mode
        }
      : undefined
  });

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
  if (
    intentKind === INTENT.undo ||
    intentKind === INTENT.redo ||
    intentKind === INTENT.create_branch ||
    intentKind === INTENT.switch_branch
  ) {
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
    intentKind: intent.kind,
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
  const isOptions = response.responseType === 'options';
  /** @type {import('./intent-handlers/types.js').OutcomeKind} */
  let outcomeKind = OUTCOME.applied;
  if (isOptions) {
    outcomeKind = OUTCOME.clarify;
  } else if (isRejected) {
    outcomeKind = OUTCOME.rejected;
  } else if (isReadOnly) {
    outcomeKind = OUTCOME.read_only;
  }
  return {
    response,
    outcomeKind,
    createdVersion: !isReadOnly && !isRejected && !isOptions
  };
}

/**
 * Runs AI pipeline + intent dispatch; returns fields for the single finalizeResponse call.
 * @param {import('./intent-handlers/types.js').ClientRequest} request
 * @param {import('./intent-handlers/types.js').RoomContext} context
 */
async function resolveRoutedCommand(request, context) {
  const withJourney = {
    ...context,
    journey: ensureJourneyState(context.journey)
  };
  const { intent, plan, outcome } = await runAiPipeline(request, withJourney);
  const productType = 'kitchen';
  const manifest = registry.get(productType);
  let nextContext = applySiteBindings(manifest, withJourney, {
    slots: 'slots' in intent ? intent.slots : {},
    known: {}
  });
  const language = normalizeLanguage(request.language ?? intent.language);

  // Journey router before intent handlers: answer vs command (commands not blocked).
  const journeyResult = await routeJourneyDialog({
    request,
    context: nextContext,
    intent,
    language
  });
  nextContext = journeyResult.context;
  if (journeyResult.handled && journeyResult.response) {
    return {
      context: nextContext,
      response: journeyResult.response,
      intentKind: journeyResult.intentKind ?? intent.kind,
      outcomeKind: journeyResult.outcomeKind ?? OUTCOME.clarify,
      createdVersion: journeyResult.createdVersion ?? false
    };
  }

  // DP4 (beside dialog-router): post-survey recommendation → plan → assert → BOM.
  if (shouldTriggerDp4(request, intent, nextContext.journey)) {
    const dp4 = await runDp4Recommendation({
      request,
      context: nextContext,
      language
    });
    return {
      context: dp4.context ?? nextContext,
      response: dp4.response,
      intentKind: 'add_module',
      outcomeKind: dp4.outcomeKind,
      createdVersion: dp4.createdVersion ?? false
    };
  }

  // Pipeline returns a runtime-valid IntentResult; matchIntent kinds are untyped strings.
  /** @type {import('./intent-handlers/types.js').IntentHandlerInput} */
  const handlerInput = {
    request,
    context: nextContext,
    intent: /** @type {import('./intent-handlers/types.js').Intent} */ (intent),
    plan,
    outcome: /** @type {import('./intent-handlers/types.js').PlanOutcome} */ (outcome),
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
 *
 * Owns idempotency, session locking, version checks, context persistence, and the
 * single finalizeResponse call. Intent-specific work lives in intent-handlers/.
 */
export async function route(request) {
  // Fast path: replay a cached response before taking the session lock.
  const cached = await loadIdempotentResponse(
    request.sessionId,
    request.requestId
  );
  if (cached) {
    return cached;
  }

  return withSessionLock(request.sessionId, async () => {
    // Re-check inside the lock so concurrent duplicates share one execution.
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
      // Single finalize point: journal + idempotency writes stay out of handlers.
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
