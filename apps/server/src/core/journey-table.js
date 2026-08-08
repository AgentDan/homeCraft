/**
 * Project Journey typed question table + validation dispatcher (Ф1).
 * Deterministic; no LLM. `dialog-router.js` keeps using JOURNEY_QUESTIONS + parseJourneyAnswer.
 */
import {
  createDefaultJourneyState,
  JourneyQuestionTableSchema,
  ProjectJourneyStateSchema
} from '@homecraft/contracts';

/** @typedef {import('zod').infer<typeof import('@homecraft/contracts').JourneyQuestionSchema>} JourneyQuestion */

/**
 * Seed table (also Mongo upsert source). Behavior of first four slots matches legacy parsers.
 * @type {JourneyQuestion[]}
 */
export const DEFAULT_JOURNEY_QUESTIONS = JourneyQuestionTableSchema.parse([
  {
    id: 'clientName',
    slot: 'clientName',
    stage: 'intro',
    order: 10,
    i18nKey: 'journeyAskClientName',
    validation: {
      type: 'text',
      minLength: 1,
      maxLength: 80,
      rejectIfNumeric: true
    },
    dependsOn: null,
    active: true
  },
  {
    id: 'projectGoal',
    slot: 'projectGoal',
    stage: 'brief',
    order: 20,
    i18nKey: 'journeyAskProjectGoal',
    validation: { type: 'text', minLength: 2, maxLength: 240 },
    dependsOn: null,
    active: true
  },
  {
    id: 'roomWidthMm',
    slot: 'roomWidthMm',
    stage: 'survey',
    order: 30,
    i18nKey: 'journeyAskRoomWidth',
    validation: {
      type: 'dimension',
      min: 500,
      max: 20000,
      unit: 'mm',
      acceptNlu: true
    },
    dependsOn: null,
    active: true
  },
  {
    id: 'roomDepthMm',
    slot: 'roomDepthMm',
    stage: 'survey',
    order: 40,
    i18nKey: 'journeyAskRoomDepth',
    validation: {
      type: 'dimension',
      min: 500,
      max: 20000,
      unit: 'mm',
      acceptNlu: true
    },
    dependsOn: null,
    active: true
  },
  {
    id: 'hasKidsOrPets',
    slot: 'hasKidsOrPets',
    stage: 'survey',
    order: 50,
    i18nKey: 'journeyAskHasKidsOrPets',
    validation: {
      type: 'enum',
      options: ['yes', 'no']
    },
    dependsOn: null,
    active: true
  },
  {
    id: 'facadeMaterialPreference',
    slot: 'facadeMaterialPreference',
    stage: 'survey',
    order: 60,
    i18nKey: 'journeyAskFacadeMaterial',
    validation: {
      type: 'enum',
      options: ['durable', 'soft', 'mixed']
    },
    dependsOn: {
      slot: 'hasKidsOrPets',
      operator: 'equals',
      value: 'yes'
    },
    active: true
  },
  {
    id: 'shoppingHabit',
    slot: 'shoppingHabit',
    stage: 'survey',
    order: 70,
    i18nKey: 'journeyAskShoppingHabit',
    validation: {
      type: 'enum',
      options: ['browse', 'decide_fast', 'research']
    },
    dependsOn: null,
    active: true
  },
  {
    id: 'socialStyle',
    slot: 'socialStyle',
    stage: 'survey',
    order: 80,
    i18nKey: 'journeyAskSocialStyle',
    validation: {
      type: 'enum',
      options: ['private', 'hosting', 'family']
    },
    dependsOn: null,
    active: true
  },
  {
    id: 'budgetEur',
    slot: 'budgetEur',
    stage: 'survey',
    order: 90,
    i18nKey: 'journeyAskBudgetEur',
    validation: {
      type: 'number',
      min: 100,
      max: 1_000_000,
      integer: true
    },
    dependsOn: null,
    active: true
  }
]);

/** Live question table (seed by default; replaced after Mongo load). */
export const JOURNEY_QUESTIONS = /** @type {JourneyQuestion[]} */ ([
  ...DEFAULT_JOURNEY_QUESTIONS
]);

/**
 * @param {JourneyQuestion[]} questions
 */
export function replaceJourneyQuestions(questions) {
  const parsed = JourneyQuestionTableSchema.parse(questions);
  JOURNEY_QUESTIONS.splice(0, JOURNEY_QUESTIONS.length, ...parsed);
  return JOURNEY_QUESTIONS;
}

/**
 * @param {import('zod').infer<typeof import('@homecraft/contracts').DependsOnSchema> | null | undefined} dependsOn
 * @param {Record<string, string | number | boolean | undefined>} known
 */
export function isDependsOnMet(dependsOn, known) {
  if (!dependsOn) return true;
  const actual = known[dependsOn.slot];
  const { operator, value } = dependsOn;
  if (operator === 'equals') {
    return actual === value;
  }
  if (operator === 'not_equals') {
    return actual !== value;
  }
  if (operator === 'in') {
    return Array.isArray(value) && value.includes(/** @type {string} */ (actual));
  }
  if (operator === 'not_in') {
    return Array.isArray(value) && !value.includes(/** @type {string} */ (actual));
  }
  return false;
}

/**
 * @param {JourneyQuestion} question
 * @param {Record<string, string | number | boolean | undefined>} known
 */
export function isQuestionApplicable(question, known) {
  return question.active && isDependsOnMet(question.dependsOn, known);
}

function activeOrderedQuestions() {
  return [...JOURNEY_QUESTIONS]
    .filter((q) => q.active)
    .sort((a, b) => a.order - b.order);
}

/**
 * @param {import('zod').infer<typeof ProjectJourneyStateSchema>} journey
 */
export function refreshMissing(journey) {
  const missing = activeOrderedQuestions()
    .filter((q) => isQuestionApplicable(q, journey.known))
    .filter((q) => journey.known[q.slot] == null)
    .map((q) => q.slot);
  return { ...journey, missing };
}

/**
 * @param {import('zod').infer<typeof ProjectJourneyStateSchema>} journey
 * @returns {JourneyQuestion | null}
 */
export function nextQuestion(journey) {
  for (const q of activeOrderedQuestions()) {
    if (!isQuestionApplicable(q, journey.known)) continue;
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
  return refreshMissing(createDefaultJourneyState());
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
 * @param {string} kind
 */
export function isPassthroughCommandIntent(kind) {
  return kind !== 'unknown';
}

/**
 * @param {string} text
 */
export function isCatalogPhrase(text) {
  const normalized = text.trim().toLowerCase();
  return (
    /\bcatalog\b|\bkatalog\b/i.test(normalized)
    || /каталог|список\s+модул/i.test(normalized)
    || /katalog|lista\s+modul/i.test(normalized)
  );
}

/**
 * @param {string} text
 */
export function isHelpOrCatalogPhrase(text) {
  const normalized = text.trim().toLowerCase();
  return (
    isCatalogPhrase(normalized)
    || /\bhelp\b|what can you do|commands?/i.test(normalized)
    || /помощ|справк|команд/i.test(normalized)
    || /pomo[cć]|komand|šta\s+možeš|sta\s+mozes/i.test(normalized)
  );
}

/**
 * Parse a single room dimension in mm from user text.
 * Accepts mm, or meters (1–20) converted to mm.
 * @param {string} text
 * @param {{ min?: number, max?: number }} [bounds]
 * @returns {number | null}
 */
export function parseRoomDimensionMm(text, bounds = {}) {
  const min = bounds.min ?? 500;
  const max = bounds.max ?? 20000;
  const normalized = text.trim().toLowerCase().replace(',', '.');
  const mmMatch = normalized.match(/(\d+(?:\.\d+)?)\s*(мм|mm)\b/);
  if (mmMatch) {
    const value = Number(mmMatch[1]);
    return value >= min && value <= max ? Math.round(value) : null;
  }
  const mMatch = normalized.match(/(\d+(?:\.\d+)?)\s*(м|m)\b/);
  if (mMatch) {
    const meters = Number(mMatch[1]);
    if (meters >= 1 && meters <= 20) {
      const mm = Math.round(meters * 1000);
      return mm >= min && mm <= max ? mm : null;
    }
  }
  const bare = normalized.match(/^(\d+(?:\.\d+)?)$/);
  if (bare) {
    const value = Number(bare[1]);
    if (value >= min && value <= max) return Math.round(value);
    if (value >= 1 && value <= 20) {
      const mm = Math.round(value * 1000);
      return mm >= min && mm <= max ? mm : null;
    }
  }
  return null;
}

/** @type {Record<string, string>} */
const ENUM_ALIASES = {
  yes: 'yes',
  y: 'yes',
  да: 'yes',
  da: 'yes',
  no: 'no',
  n: 'no',
  нет: 'no',
  ne: 'no',
  durable: 'durable',
  прочный: 'durable',
  izdrzljiv: 'durable',
  soft: 'soft',
  мягкий: 'soft',
  mek: 'soft',
  mixed: 'mixed',
  смешанный: 'mixed',
  mesovito: 'mixed',
  browse: 'browse',
  смотреть: 'browse',
  gledati: 'browse',
  decide_fast: 'decide_fast',
  быстро: 'decide_fast',
  brzo: 'decide_fast',
  research: 'research',
  изучать: 'research',
  istrazivati: 'research',
  private: 'private',
  приватно: 'private',
  privatno: 'private',
  hosting: 'hosting',
  гости: 'hosting',
  gosti: 'hosting',
  family: 'family',
  семья: 'family',
  porodica: 'family'
};

/**
 * Single validation dispatcher (switch on validation.type).
 * @param {string} text
 * @param {{ slots?: Record<string, unknown> } | null | undefined} intent
 * @param {import('zod').infer<typeof import('@homecraft/contracts').ValidationSchema>} validation
 * @param {{ slot?: string }} [ctx]
 * @returns {{ ok: true, value: string | number } | { ok: false }}
 */
export function validateAnswer(text, intent, validation, ctx = {}) {
  const trimmed = text.trim();
  if (!trimmed) return { ok: false };

  switch (validation.type) {
    case 'text': {
      let value = trimmed.replace(/^[,.\-–—]+/, '').trim();
      if (value.length < validation.minLength || value.length > validation.maxLength) {
        return { ok: false };
      }
      if (isFreeModeEscape(value) || isHelpOrCatalogPhrase(value)) {
        return { ok: false };
      }
      if (
        validation.rejectIfNumeric
        && /^\d+([.,]\d+)?\s*(м|m|мм|mm)?$/i.test(value)
      ) {
        return { ok: false };
      }
      value = value.slice(0, validation.maxLength);
      return { ok: true, value };
    }
    case 'number': {
      const normalized = trimmed.replace(/\s+/g, '').replace(',', '.');
      const match = normalized.match(/^(\d+(?:\.\d+)?)/);
      if (!match) return { ok: false };
      let value = Number(match[1]);
      if (!Number.isFinite(value)) return { ok: false };
      if (validation.integer) value = Math.round(value);
      if (value < validation.min || value > validation.max) return { ok: false };
      return { ok: true, value };
    }
    case 'enum': {
      const normalized = trimmed.toLowerCase();
      const aliased = ENUM_ALIASES[normalized] ?? normalized.replace(/\s+/g, '_');
      const options = validation.options;
      if (validation.allowMultiple) {
        const parts = normalized.split(/[,;/]+/).map((p) => p.trim()).filter(Boolean);
        const values = parts
          .map((p) => ENUM_ALIASES[p] ?? p.replace(/\s+/g, '_'))
          .filter((p) => options.includes(p));
        if (values.length === 0) return { ok: false };
        return { ok: true, value: values.join(',') };
      }
      if (!options.includes(aliased)) return { ok: false };
      return { ok: true, value: aliased };
    }
    case 'dimension': {
      const slots = intent && 'slots' in intent ? intent.slots : undefined;
      const slot = ctx.slot;
      const fromSlot =
        validation.acceptNlu
        && slot
        && typeof slots?.[slot] === 'number'
          ? /** @type {number} */ (slots[slot])
          : null;
      const value =
        fromSlot
        ?? parseRoomDimensionMm(trimmed, {
          min: validation.min,
          max: validation.max
        });
      if (value == null) return { ok: false };
      if (value < validation.min || value > validation.max) return { ok: false };
      return { ok: true, value };
    }
    default:
      return { ok: false };
  }
}

/**
 * Compatibility wrapper for dialog-router (questionId → typed validation).
 * @param {string} questionId
 * @param {string} text
 * @param {{ slots?: Record<string, unknown> }} [intent]
 * @returns {{ ok: true, value: string | number } | { ok: false }}
 */
export function parseJourneyAnswer(questionId, text, intent) {
  const question = JOURNEY_QUESTIONS.find(
    (q) => q.id === questionId || q.slot === questionId
  );
  if (!question) return { ok: false };
  return validateAnswer(text, intent, question.validation, {
    slot: question.slot
  });
}

/** @deprecated use validateAnswer — kept for older call sites/tests */
export function parseClientName(text) {
  const result = validateAnswer(
    text,
    null,
    { type: 'text', minLength: 1, maxLength: 80, rejectIfNumeric: true }
  );
  return result.ok ? result.value : null;
}

/** @deprecated use validateAnswer */
export function parseProjectGoal(text) {
  const result = validateAnswer(
    text,
    null,
    { type: 'text', minLength: 2, maxLength: 240 }
  );
  return result.ok ? result.value : null;
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
  const question = JOURNEY_QUESTIONS.find(
    (q) => q.id === questionId || q.slot === questionId
  );
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
  const question = JOURNEY_QUESTIONS.find(
    (q) => q.id === questionId || q.slot === questionId
  );
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
