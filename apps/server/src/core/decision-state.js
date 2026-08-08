/**
 * Decision State v0 — deterministic recalc from Observation events.
 * Does not touch dialog-router; `post_survey` is set when journey.stage === 'done'.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BehaviorSignalSchema,
  ClientProfileSchema,
  DecisionStateSchema
} from '@homecraft/contracts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultDir = path.resolve(__dirname, '../../data');

/** hover_long must exceed this duration to enter focusVariantIds */
export const HOVER_LONG_FOCUS_MS = 20_000;
const LAST_SIGNALS_MAX = 20;
const TOP_CONCERNS_MAX = 5;

function storageDir() {
  return process.env.SERVER_STORAGE_DIR
    ? path.resolve(process.env.SERVER_STORAGE_DIR)
    : defaultDir;
}

function decisionStatePath(clientId) {
  return path.join(storageDir(), 'decision-state', `${sanitize(clientId)}.json`);
}

function clientProfilePath(clientId) {
  return path.join(storageDir(), 'client-profiles', `${sanitize(clientId)}.json`);
}

function sanitize(id) {
  return String(id).replace(/[^a-zA-Z0-9._-]+/g, '_');
}

/**
 * @param {string} clientId
 * @returns {import('zod').infer<typeof DecisionStateSchema>}
 */
export function createDefaultDecisionState(clientId) {
  return DecisionStateSchema.parse({
    clientId,
    phase: 'intro',
    journeyMode: 'guided',
    focusVariantIds: [],
    rejectedIds: [],
    topConcerns: [],
    readinessScore: 0,
    lastSignals: []
  });
}

/**
 * Map RoomContext.journey.stage → DecisionState.phase (post_survey outside router).
 * @param {string | undefined | null} stage
 * @returns {'intro' | 'brief' | 'survey' | 'post_survey' | null}
 */
export function phaseFromJourneyStage(stage) {
  if (stage === 'done') return 'post_survey';
  if (stage === 'intro' || stage === 'brief' || stage === 'survey') return stage;
  return null;
}

/**
 * @param {string[]} concerns
 * @param {string} concern
 */
function pushConcern(concerns, concern) {
  if (concerns.includes(concern)) return concerns;
  return [...concerns, concern].slice(-TOP_CONCERNS_MAX);
}

/**
 * @param {import('zod').infer<typeof DecisionStateSchema>} state
 */
function computeReadinessScore(state) {
  const phaseBase = {
    intro: 0.1,
    brief: 0.25,
    survey: 0.5,
    post_survey: 0.75
  };
  let score = phaseBase[state.phase] ?? 0;
  score += Math.min(0.15, state.focusVariantIds.length * 0.05);
  if (state.rejectedIds.length > 0) score += 0.05;
  if (state.journeyMode === 'free') score += 0.05;
  return Math.min(1, Math.max(0, Number(score.toFixed(4))));
}

/**
 * Pure recalc: apply one Observation event (+ optional journey snapshot).
 * @param {import('zod').infer<typeof DecisionStateSchema>} prev
 * @param {Record<string, unknown> | null | undefined} event
 * @param {{
 *   journey?: { stage?: string, mode?: string } | null
 * }} [hints]
 */
export function recalculateDecisionState(prev, event, hints = {}) {
  let next = {
    ...prev,
    focusVariantIds: [...prev.focusVariantIds],
    rejectedIds: prev.rejectedIds.map((entry) => ({ ...entry })),
    topConcerns: [...prev.topConcerns],
    lastSignals: [...prev.lastSignals]
  };

  const journey = hints.journey;
  if (journey) {
    if (journey.mode === 'guided' || journey.mode === 'free') {
      next.journeyMode = journey.mode;
    }
    const phase = phaseFromJourneyStage(journey.stage);
    if (phase) next.phase = phase;
  }

  if (event && typeof event === 'object') {
    if (event.kind === 'journey_event') {
      if (event.type === 'mode_free') {
        next.journeyMode = 'free';
      }
      if (event.type === 're_ask') {
        next.topConcerns = pushConcern(next.topConcerns, 'clarification');
      }
      if (typeof event.stage === 'string') {
        const phase = phaseFromJourneyStage(event.stage);
        if (phase) next.phase = phase;
      }
    }

    if (event.kind === 'behavior_signal') {
      const signal = BehaviorSignalSchema.parse({
        clientId: event.clientId ?? prev.clientId,
        ts: event.ts,
        seq: event.seq,
        eventType: event.eventType,
        targetId: event.targetId,
        durationMs: event.durationMs
      });
      next.lastSignals = [...next.lastSignals, signal].slice(-LAST_SIGNALS_MAX);

      if (
        signal.eventType === 'hover_long'
        && signal.durationMs > HOVER_LONG_FOCUS_MS
        && !next.focusVariantIds.includes(signal.targetId)
      ) {
        next.focusVariantIds.push(signal.targetId);
      }

      if (signal.eventType === 'reject_variant') {
        if (!next.rejectedIds.some((entry) => entry.variantId === signal.targetId)) {
          next.rejectedIds.push({ variantId: signal.targetId, reason: null });
        }
        next.topConcerns = pushConcern(next.topConcerns, 'rejection');
      }

      if (signal.eventType === 'compare') {
        next.topConcerns = pushConcern(next.topConcerns, 'comparing');
      }

      if (signal.eventType === 'click' && !next.focusVariantIds.includes(signal.targetId)) {
        // light interest signal — not focus unless long hover
      }
    }
  }

  next.readinessScore = computeReadinessScore(next);
  return DecisionStateSchema.parse(next);
}

/**
 * @param {string} clientId
 * @returns {Promise<import('zod').infer<typeof DecisionStateSchema> | null>}
 */
export async function loadDecisionState(clientId) {
  const id = String(clientId ?? '').trim();
  if (!id) return null;
  try {
    const raw = await readFile(decisionStatePath(id), 'utf8');
    return DecisionStateSchema.parse(JSON.parse(raw));
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

/**
 * @param {import('zod').infer<typeof DecisionStateSchema>} state
 */
export async function saveDecisionState(state) {
  const parsed = DecisionStateSchema.parse(state);
  const filePath = decisionStatePath(parsed.clientId);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(parsed, null, 2)}\n`, 'utf8');
  return parsed;
}

/**
 * Load → apply event/hints → persist. Best-effort safe wrapper available separately.
 * @param {string} clientId
 * @param {Record<string, unknown> | null} [event]
 * @param {{ journey?: { stage?: string, mode?: string } | null }} [hints]
 */
export async function updateDecisionStateFromEvent(clientId, event = null, hints = {}) {
  const id = String(clientId ?? '').trim();
  if (!id) return null;
  const prev = (await loadDecisionState(id)) ?? createDefaultDecisionState(id);
  const next = recalculateDecisionState(prev, event, hints);
  return saveDecisionState(next);
}

/**
 * @param {string} clientId
 * @param {Record<string, unknown> | null} [event]
 * @param {{ journey?: { stage?: string, mode?: string } | null }} [hints]
 */
export async function updateDecisionStateFromEventSafe(clientId, event = null, hints = {}) {
  try {
    return await updateDecisionStateFromEvent(clientId, event, hints);
  } catch {
    return null;
  }
}

/**
 * @param {string} clientId
 * @returns {Promise<import('zod').infer<typeof ClientProfileSchema> | null>}
 */
export async function loadClientProfile(clientId) {
  const id = String(clientId ?? '').trim();
  if (!id) return null;
  try {
    const raw = await readFile(clientProfilePath(id), 'utf8');
    return ClientProfileSchema.parse(JSON.parse(raw));
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

/**
 * Manual admin write for ClientProfile (no inference UI in Ф2).
 * @param {import('zod').infer<typeof ClientProfileSchema>} profile
 */
export async function saveClientProfile(profile) {
  const parsed = ClientProfileSchema.parse({
    ...profile,
    updatedAt: new Date().toISOString()
  });
  const filePath = clientProfilePath(parsed.clientId);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(parsed, null, 2)}\n`, 'utf8');
  return parsed;
}
