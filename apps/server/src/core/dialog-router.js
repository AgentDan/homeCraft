/**
 * Dialog router: journey answer vs ordinary command.
 * Commands are never blocked; guided questions can be re-asked next turn.
 */
import { buildClarifyResponse } from './output-builder.js';
import { t } from '../i18n/messages.js';
import { appendJourneyEvent } from '../storage/journey-events.js';
import { applySiteBindings } from './room-context-builder.js';
import {
  applyJourneyAnswer,
  ensureJourneyState,
  getJourneyQuestions,
  isFreeModeEscape,
  isHelpOrCatalogPhrase,
  isPassthroughCommandIntent,
  markQuestionAsked,
  nextQuestion,
  parseJourneyAnswer,
  refreshMissing
} from './journey-table.js';
import { ProjectJourneyStateSchema, registry } from '@homecraft/contracts';

/**
 * @param {import('./intent-handlers/types.js').RoomContext} context
 * @param {import('zod').infer<typeof ProjectJourneyStateSchema>} journey
 * @param {string} productType
 */
function withJourney(context, journey, productType) {
  return {
    ...context,
    journey: refreshMissing(ProjectJourneyStateSchema.parse(journey), productType)
  };
}

/**
 * @param {{
 *   request: import('./intent-handlers/types.js').ClientRequest,
 *   context: import('./intent-handlers/types.js').RoomContext,
 *   intent: { kind: string, slots?: Record<string, unknown>, rawText?: string },
 *   language: import('../i18n/messages.js').Language
 * }} args
 * @returns {Promise<{
 *   handled: boolean,
 *   context: import('./intent-handlers/types.js').RoomContext,
 *   response?: object,
 *   intentKind?: string,
 *   outcomeKind?: 'clarify' | 'read_only' | 'applied',
 *   createdVersion?: boolean
 * }>}
 */
export async function routeJourneyDialog({
  request,
  context,
  intent,
  language
}) {
  const productType = context.productType ?? 'kitchen';
  let journey = ensureJourneyState(context.journey, productType);
  let nextContext = withJourney(context, journey, productType);

  if (isFreeModeEscape(request.command)) {
    const now = new Date().toISOString();
    journey = ProjectJourneyStateSchema.parse({
      ...journey,
      mode: 'free',
      pendingQuestionId: null
    });
    nextContext = withJourney(nextContext, journey, productType);
    await appendJourneyEvent({
      type: 'mode_free',
      projectId: request.projectId,
      sessionId: request.sessionId,
      stage: journey.stage,
      at: now
    });
    return {
      handled: true,
      context: nextContext,
      response: buildClarifyResponse(
        request,
        t(language, 'journeyFreeMode'),
        nextContext.planVersion
      ),
      intentKind: intent.kind,
      outcomeKind: 'clarify',
      createdVersion: false
    };
  }

  if (journey.mode === 'free' || journey.stage === 'done') {
    return { handled: false, context: nextContext };
  }

  // Kitchen commands pass through; journey question stays for a later turn.
  if (isPassthroughCommandIntent(intent.kind)) {
    return { handled: false, context: nextContext };
  }

  // Help/catalog phrases must reach the help handler even if still "unknown".
  if (isHelpOrCatalogPhrase(request.command)) {
    return { handled: false, context: nextContext };
  }

  const pendingId = journey.pendingQuestionId;
  if (pendingId) {
    const parsed = parseJourneyAnswer(pendingId, request.command, intent, productType);
    if (!parsed.ok) {
      journey = markQuestionAsked(journey, pendingId, productType);
      nextContext = withJourney(nextContext, journey, productType);
      const question = getJourneyQuestions(productType).find((q) => q.id === pendingId);
      await appendJourneyEvent({
        type: 're_ask',
        projectId: request.projectId,
        sessionId: request.sessionId,
        stage: journey.stage,
        questionId: pendingId,
        reAskTotal: journey.metrics.reAskTotal,
        at: new Date().toISOString()
      });
      return {
        handled: true,
        context: nextContext,
        response: buildClarifyResponse(
          request,
          t(language, 'journeyReask', {
            question: t(language, question?.i18nKey ?? 'journeyAskClientName')
          }),
          nextContext.planVersion
        ),
        intentKind: intent.kind,
        outcomeKind: 'clarify',
        createdVersion: false
      };
    }

    const prevStage = journey.stage;
    journey = applyJourneyAnswer(journey, pendingId, parsed.value, productType);
    const manifest = registry.get(productType);
    nextContext = applySiteBindings(
      manifest,
      withJourney(nextContext, journey, productType),
      { slots: {}, known: journey.known ?? {} }
    );
    await appendJourneyEvent({
      type: 'slot_filled',
      projectId: request.projectId,
      sessionId: request.sessionId,
      stage: journey.stage,
      questionId: pendingId,
      at: new Date().toISOString()
    });
    if (journey.stage !== prevStage) {
      await appendJourneyEvent({
        type: 'stage_enter',
        projectId: request.projectId,
        sessionId: request.sessionId,
        stage: journey.stage,
        at: new Date().toISOString()
      });
    }

    if (journey.stage === 'done') {
      return {
        handled: true,
        context: nextContext,
        response: buildClarifyResponse(
          request,
          t(language, 'journeyComplete'),
          nextContext.planVersion
        ),
        intentKind: intent.kind,
        outcomeKind: 'clarify',
        createdVersion: false
      };
    }

    const upcoming = nextQuestion(journey, productType);
    if (!upcoming) {
      return { handled: false, context: nextContext };
    }
    journey = markQuestionAsked(journey, upcoming.id, productType);
    nextContext = withJourney(nextContext, journey, productType);
    return {
      handled: true,
      context: nextContext,
      response: buildClarifyResponse(
        request,
        t(language, upcoming.i18nKey),
        nextContext.planVersion
      ),
      intentKind: intent.kind,
      outcomeKind: 'clarify',
      createdVersion: false
    };
  }

  // No pending question yet — open the next missing slot (start or resume).
  const upcoming = nextQuestion(journey, productType);
  if (!upcoming) {
    journey = ProjectJourneyStateSchema.parse({ ...journey, stage: 'done' });
    return { handled: false, context: withJourney(nextContext, journey, productType) };
  }

  journey = markQuestionAsked(journey, upcoming.id, productType);
  nextContext = withJourney(nextContext, journey, productType);
  await appendJourneyEvent({
    type: 'stage_enter',
    projectId: request.projectId,
    sessionId: request.sessionId,
    stage: journey.stage,
    questionId: upcoming.id,
    at: new Date().toISOString()
  });
  return {
    handled: true,
    context: nextContext,
    response: buildClarifyResponse(
      request,
      t(language, upcoming.i18nKey),
      nextContext.planVersion
    ),
    intentKind: intent.kind,
    outcomeKind: 'clarify',
    createdVersion: false
  };
}
