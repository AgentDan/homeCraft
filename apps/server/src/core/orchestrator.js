import {
  CommandOutcomeKindSchema,
  IntentKindSchema
} from '@homecraft/contracts';
import { runAiPipeline } from '../ai-services/pipeline.js';
import { buildClarifyResponse } from './output-builder.js';
import {
  appendDialogTurn,
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

    context = {
      ...context,
      planVersion: currentVersion
    };

    context = appendDialogTurn(context, 'user', request.command);

    await persistRoomContext(context);

    try {
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

      // Clarify is checked before the registry: it is shared across intents, not a
      // property of any single handler. Moving it into the registry would apply
      // set_budget / export_project where the pipeline asked for clarification.
      if (outcome.kind === PLAN_OUTCOME_CLARIFY) {
        return finalizeResponse({
          request,
          context,
          response: buildClarifyResponse(
            request,
            outcome.prompt,
            context.planVersion
          ),
          intentKind: intent.kind,
          outcomeKind: OUTCOME.clarify
        });
      }

      const handler = intentHandlers[intent.kind];
      if (handler) {
        const result = await handler({
          request,
          context,
          intent,
          plan,
          outcome,
          language
        });
        if (result.kind === HANDLER_RESPOND) {
          return finalizeResponse({
            request,
            context: result.context ?? context,
            response: result.response,
            intentKind: intent.kind,
            outcomeKind: result.outcomeKind,
            createdVersion: result.createdVersion ?? false
          });
        }
        context = result.context ?? context;
      }

      const messages = {
        [INTENT.add_module]:
          (outcome.addedCount ?? 0) > 1
            ? t(language, 'starterKitchenAdded', {
                count: outcome.addedCount ?? 0
              })
            : t(language, 'moduleAdded', { sku: outcome.sku ?? '' }),
        [INTENT.remove_module]: t(language, 'moduleRemoved', {
          instanceId: outcome.instanceId ?? ''
        }),
        [INTENT.replace_module]: t(language, 'moduleReplaced', {
          instanceId: outcome.instanceId ?? '',
          sku: outcome.sku ?? ''
        }),
        [INTENT.change_finish]: t(language, 'finishSelected', {
          finishId: outcome.finishId ?? '',
          instanceId: outcome.instanceId ?? ''
        }),
        [INTENT.set_budget]: t(language, 'budgetSet', {
          budgetEur: intent.slots?.budgetEur ?? 0
        }),
        [INTENT.show_price]: t(language, 'priceCalculated')
      };

      const isReadOnly =
        intent.kind === INTENT.show_price || intent.kind === INTENT.set_budget;
      const newOperations = plan.operations.slice(context.planOperations.length);
      const changeSummary = {
        text: messages[intent.kind] ?? t(language, 'commandCompleted'),
        added: newOperations
          .filter(
            (operation) =>
              operation.type === 'add_module' ||
              operation.type === 'replace_module'
          )
          .map((operation) => operation.sku),
        removed: newOperations
          .filter(
            (operation) =>
              operation.type === 'remove_module' ||
              operation.type === 'replace_module'
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
        persistVersion: !isReadOnly,
        existingVersion: isReadOnly ? context.planVersion : undefined,
        changeSummary,
        view: { kind: '3d_scene', render: 'full' }
      });

      const isRejected = Boolean(
        response.compatibility && !response.compatibility.valid
      );
      const createdVersion = !isReadOnly && !isRejected;
      let outcomeKind = OUTCOME.applied;
      if (isRejected) {
        outcomeKind = OUTCOME.rejected;
      } else if (isReadOnly) {
        outcomeKind = OUTCOME.read_only;
      }

      return finalizeResponse({
        request,
        context,
        response,
        intentKind: intent.kind,
        outcomeKind,
        createdVersion
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
