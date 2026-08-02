/**
 * Project Journey question table + slot parsers (deterministic, no LLM).
 * @see docs/CONSULTANT_CONCEPT.md
 */
import {
  createDefaultJourneyState,
  ProjectJourneyStateSchema
} from '@homecraft/contracts';

/** Ordered questions for stages 1–3. */
export const JOURNEY_QUESTIONS = /** @type {const} */ ([
  {
    id: 'clientName',
    stage: 'intro',
    slot: 'clientName',
    i18nKey: 'journeyAskClientName'
  },
  {
    id: 'projectGoal',
    stage: 'brief',
    slot: 'projectGoal',
    i18nKey: 'journeyAskProjectGoal'
  },
  {
    id: 'roomWidthMm',
    stage: 'survey',
    slot: 'roomWidthMm',
    i18nKey: 'journeyAskRoomWidth'
  },
  {
    id: 'roomDepthMm',
    stage: 'survey',
    slot: 'roomDepthMm',
    i18nKey: 'journeyAskRoomDepth'
  }
]);

const SLOT_ORDER = JOURNEY_QUESTIONS.map((q) => q.slot);

/**
 * @param {import('zod').infer<typeof ProjectJourneyStateSchema>} journey
 */
export function refreshMissing(journey) {
  const missing = SLOT_ORDER.filter((slot) => journey.known[slot] == null);
  return { ...journey, missing };
}

/**
 * @param {import('zod').infer<typeof ProjectJourneyStateSchema>} journey
 * @returns {typeof JOURNEY_QUESTIONS[number] | null}
 */
export function nextQuestion(journey) {
  for (const q of JOURNEY_QUESTIONS) {
    if (journey.known[q.slot] == null) return q;
  }
  return null;
}

/**
 * @param {Partial<import('zod').infer<typeof ProjectJourneyStateSchema>>} [partial]
 */
export function ensureJourneyState(partial) {
  if (partial && typeof partial === 'object' && partial.stage) {
    return refreshMissing(ProjectJourneyStateSchema.parse(partial));
  }
  return createDefaultJourneyState();
}

/**
 * @param {string} text
 */
export function isFreeModeEscape(text) {
  const normalized = text.trim().toLowerCase();
  const patterns = [
    /^free\s*mode\b/i,
    /work\s+freely/i,
    /skip\s+(the\s+)?questions?/i,
    /stop\s+guiding/i,
    /свободн\w*\s+режим/i,
    /без\s+вопросов/i,
    /работай\s+свободн/i,
    /пропусти\s+вопросы/i,
    /slobodan\s+re[zž]im/i,
    /bez\s+pitanja/i,
    /radi\s+slobodno/i
  ];
  return patterns.some((re) => re.test(normalized));
}

/**
 * Non-unknown intents must not be blocked by journey.
 * @param {string} kind
 */
export function isPassthroughCommandIntent(kind) {
  return kind !== 'unknown';
}

/**
 * @param {string} text
 * @returns {string | null}
 */
export function parseClientName(text) {
  const trimmed = text.trim().replace(/^[,.\-–—]+/, '').trim();
  if (trimmed.length < 1 || trimmed.length > 80) return null;
  if (isFreeModeEscape(trimmed)) return null;
  // Reject pure numbers / dimension-looking replies
  if (/^\d+([.,]\d+)?\s*(м|m|мм|mm)?$/i.test(trimmed)) return null;
  return trimmed.slice(0, 80);
}

/**
 * @param {string} text
 * @returns {string | null}
 */
export function parseProjectGoal(text) {
  const trimmed = text.trim();
  if (trimmed.length < 2 || trimmed.length > 240) return null;
  if (isFreeModeEscape(trimmed)) return null;
  return trimmed.slice(0, 240);
}

/**
 * Parse a single room dimension in mm from user text.
 * Accepts mm, or meters (1–20) converted to mm.
 * @param {string} text
 * @returns {number | null}
 */
export function parseRoomDimensionMm(text) {
  const normalized = text.trim().toLowerCase().replace(',', '.');
  const mmMatch = normalized.match(
    /(\d+(?:\.\d+)?)\s*(мм|mm)\b/
  );
  if (mmMatch) {
    const value = Number(mmMatch[1]);
    return value >= 500 && value <= 20000 ? Math.round(value) : null;
  }
  const mMatch = normalized.match(/(\d+(?:\.\d+)?)\s*(м|m)\b/);
  if (mMatch) {
    const meters = Number(mMatch[1]);
    if (meters >= 1 && meters <= 20) return Math.round(meters * 1000);
  }
  const bare = normalized.match(/^(\d+(?:\.\d+)?)$/);
  if (bare) {
    const value = Number(bare[1]);
    if (value >= 500 && value <= 20000) return Math.round(value);
    if (value >= 1 && value <= 20) return Math.round(value * 1000);
  }
  return null;
}

/**
 * @param {string} questionId
 * @param {string} text
 * @param {{ slots?: Record<string, unknown> }} [intent]
 * @returns {{ ok: true, value: string | number } | { ok: false }}
 */
export function parseJourneyAnswer(questionId, text, intent) {
  const slots = intent && 'slots' in intent ? intent.slots : undefined;
  if (questionId === 'clientName') {
    const value = parseClientName(text);
    return value ? { ok: true, value } : { ok: false };
  }
  if (questionId === 'projectGoal') {
    const value = parseProjectGoal(text);
    return value ? { ok: true, value } : { ok: false };
  }
  if (questionId === 'roomWidthMm') {
    const fromSlot =
      typeof slots?.roomWidthMm === 'number' ? slots.roomWidthMm : null;
    const value = fromSlot ?? parseRoomDimensionMm(text);
    return value ? { ok: true, value } : { ok: false };
  }
  if (questionId === 'roomDepthMm') {
    const fromSlot =
      typeof slots?.roomDepthMm === 'number' ? slots.roomDepthMm : null;
    const value = fromSlot ?? parseRoomDimensionMm(text);
    return value ? { ok: true, value } : { ok: false };
  }
  return { ok: false };
}

/**
 * @param {import('zod').infer<typeof ProjectJourneyStateSchema>} journey
 * @param {string} questionId
 */
export function markQuestionAsked(journey, questionId) {
  const now = new Date().toISOString();
  const history = [...journey.questionHistory];
  const existing = history.findIndex(
    (entry) => entry.questionId === questionId && !entry.answeredAt
  );
  if (existing >= 0) {
    history[existing] = {
      ...history[existing],
      reAskCount: history[existing].reAskCount + 1
    };
    return refreshMissing(
      ProjectJourneyStateSchema.parse({
        ...journey,
        pendingQuestionId: questionId,
        questionHistory: history,
        metrics: {
          ...journey.metrics,
          reAskTotal: journey.metrics.reAskTotal + 1
        }
      })
    );
  }
  history.push({ questionId, askedAt: now, reAskCount: 0 });
  const question = JOURNEY_QUESTIONS.find((q) => q.id === questionId);
  const stage = question?.stage ?? journey.stage;
  const stageEnteredAt = { ...journey.metrics.stageEnteredAt };
  if (!stageEnteredAt[stage]) stageEnteredAt[stage] = now;
  return refreshMissing(
    ProjectJourneyStateSchema.parse({
      ...journey,
      stage,
      pendingQuestionId: questionId,
      questionHistory: history,
      metrics: { ...journey.metrics, stageEnteredAt }
    })
  );
}

/**
 * @param {import('zod').infer<typeof ProjectJourneyStateSchema>} journey
 * @param {string} questionId
 * @param {string | number} value
 */
export function applyJourneyAnswer(journey, questionId, value) {
  const now = new Date().toISOString();
  const question = JOURNEY_QUESTIONS.find((q) => q.id === questionId);
  const known = { ...journey.known, [question?.slot ?? questionId]: value };
  const history = journey.questionHistory.map((entry) =>
    entry.questionId === questionId && !entry.answeredAt
      ? { ...entry, answeredAt: now }
      : entry
  );
  let next = refreshMissing(
    ProjectJourneyStateSchema.parse({
      ...journey,
      known,
      pendingQuestionId: null,
      questionHistory: history
    })
  );
  const upcoming = nextQuestion(next);
  if (!upcoming) {
    const stageEnteredAt = { ...next.metrics.stageEnteredAt };
    if (!stageEnteredAt.done) stageEnteredAt.done = now;
    next = ProjectJourneyStateSchema.parse({
      ...next,
      stage: 'done',
      pendingQuestionId: null,
      metrics: { ...next.metrics, stageEnteredAt }
    });
  } else {
    next = { ...next, stage: upcoming.stage };
  }
  return refreshMissing(next);
}
