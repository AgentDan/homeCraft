/**
 * Dialog router: journey answer vs ordinary command.
 * Commands are never blocked; guided questions can be re-asked next turn.
 */
import { buildClarifyResponse } from './output-builder.js';
import { t } from '../i18n/messages.js';
import { appendJourneyEvent } from '../storage/journey-events.js';
import {
  JOURNEY_QUESTIONS,
  applyJourneyAnswer,
  ensureJourneyState,
  isFreeModeEscape,
  isPassthroughCommandIntent,
  markQuestionAsked,
  nextQuestion,
  parseJourneyAnswer,
  refreshMissing
} from './journey-table.js';
import { ProjectJourneyStateSchema } from '@homecraft/contracts';

/**
 * @param {import('./intent-handlers/types.js').RoomContext} context
 */
function withJourney(context, journey) {
  return {
    ...context,
    journey: refreshMissing(ProjectJourneyStateSchema.parse(journey))
  };
}

/**
 * Sync survey dimensions from journey.known into roomShape.
 * @param {import('./intent-handlers/types.js').RoomContext} context
 */
export function applyJourneyRoomDimensions(context) {
  const known = context.journey?.known ?? {};
  const widthMm =
    typeof known.roomWidthMm === 'number' ? known.roomWidthMm : null;
  const depthMm =
    typeof known.roomDepthMm === 'number' ? known.roomDepthMm : null;
  if (!widthMm && !depthMm) return context;
  return {
    ...context,
    roomShape: {
      ...context.roomShape,
      dimensions: {
        ...context.roomShape.dimensions,
        ...(widthMm ? { widthMm } : {}),
        ...(depthMm ? { depthMm } : {})
      }
    }
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
  let journey = ensureJourneyState(context.journey);
  let nextContext = withJourney(context, journey);

  if (isFreeModeEscape(request.command)) {
    const now = new Date().toISOString();
    journey = ProjectJourneyStateSchema.parse({
      ...journey,
      mode: 'free',
      pendingQuestionId: null
    });
    nextContext = withJourney(nextContext, journey);
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

  const pendingId = journey.pendingQuestionId;
  if (pendingId) {
    const parsed = parseJourneyAnswer(pendingId, request.command, intent);
    if (!parsed.ok) {
      journey = markQuestionAsked(journey, pendingId);
      nextContext = withJourney(nextContext, journey);
      const question = JOURNEY_QUESTIONS.find((q) => q.id === pendingId);
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
    journey = applyJourneyAnswer(journey, pendingId, parsed.value);
    nextContext = applyJourneyRoomDimensions(withJourney(nextContext, journey));
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

    const upcoming = nextQuestion(journey);
    if (!upcoming) {
      return { handled: false, context: nextContext };
    }
    journey = markQuestionAsked(journey, upcoming.id);
    nextContext = withJourney(nextContext, journey);
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
  const upcoming = nextQuestion(journey);
  if (!upcoming) {
    journey = ProjectJourneyStateSchema.parse({ ...journey, stage: 'done' });
    return { handled: false, context: withJourney(nextContext, journey) };
  }

  journey = markQuestionAsked(journey, upcoming.id);
  nextContext = withJourney(nextContext, journey);
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
