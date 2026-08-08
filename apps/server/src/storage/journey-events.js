/**
 * Unified Observation timeline (Ф0).
 * Journey events, dialog turns, behavior signals, and outcomes share one JSONL
 * keyed by `clientId` (+ server `ts` + monotonic `seq`).
 *
 * `clientId` === consultation key; callers currently pass `projectId`.
 */
import { appendFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BehaviorSignalSchema,
  DialogTurnSchema,
  OutcomeSchema
} from '@homecraft/contracts';
import { updateDecisionStateFromEventSafe } from '../core/decision-state.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultDir = path.resolve(__dirname, '../../data');

function storageDir() {
  return process.env.SERVER_STORAGE_DIR
    ? path.resolve(process.env.SERVER_STORAGE_DIR)
    : defaultDir;
}

function observationPath() {
  return path.join(storageDir(), 'observation.jsonl');
}

/**
 * @param {string} clientId
 * @returns {Promise<number>}
 */
async function nextSeq(clientId) {
  const events = await loadObservationTimeline(clientId);
  const max = events.reduce(
    (acc, event) => Math.max(acc, typeof event.seq === 'number' ? event.seq : 0),
    0
  );
  return max + 1;
}

/**
 * @param {Record<string, unknown>} record
 */
async function appendRecord(record) {
  const dir = storageDir();
  await mkdir(dir, { recursive: true });
  await appendFile(observationPath(), `${JSON.stringify(record)}\n`, 'utf8');
  return record;
}

/**
 * Best-effort journey observability. Stamps server `clientId`/`ts`/`seq`
 * so journey rows share the Observation timeline with BehaviorSignal.
 *
 * @param {Record<string, unknown>} event
 */
export async function appendJourneyEvent(event) {
  try {
    const clientId = String(event.clientId ?? event.projectId ?? '').trim();
    if (!clientId) return null;
    const ts = new Date().toISOString();
    const seq = await nextSeq(clientId);
    const record = {
      kind: 'journey_event',
      clientId,
      ts,
      seq,
      type: event.type,
      projectId: event.projectId ?? clientId,
      sessionId: event.sessionId,
      stage: event.stage,
      questionId: event.questionId,
      reAskTotal: event.reAskTotal,
      at: ts
    };
    const written = await appendRecord(record);
    await updateDecisionStateFromEventSafe(clientId, written, {
      journey:
        event.type === 'mode_free'
          ? { stage: event.stage, mode: 'free' }
          : event.stage
            ? { stage: String(event.stage) }
            : undefined
    });
    return written;
  } catch {
    return null;
  }
}

/**
 * @param {{
 *   clientId: string,
 *   speaker: 'client' | 'agent',
 *   text: string
 * }} input
 */
export async function appendDialogTurnEvent(input) {
  try {
    const clientId = String(input.clientId ?? '').trim();
    if (!clientId) return null;
    const ts = new Date().toISOString();
    const seq = await nextSeq(clientId);
    const turn = DialogTurnSchema.parse({
      clientId,
      ts,
      seq,
      speaker: input.speaker,
      text: input.text
    });
    const written = await appendRecord({ kind: 'dialog_turn', ...turn });
    await updateDecisionStateFromEventSafe(clientId, written);
    return written;
  } catch {
    return null;
  }
}

/**
 * Server stamps `ts` + `seq`. Client-provided timestamps are ignored.
 * @param {{
 *   clientId: string,
 *   eventType: 'click' | 'hover_long' | 'reject_variant' | 'compare',
 *   targetId: string,
 *   durationMs: number,
 *   ts?: string,
 *   seq?: number
 * }} input
 */
export async function appendBehaviorSignal(input) {
  const clientId = String(input.clientId ?? '').trim();
  if (!clientId) {
    throw new Error('clientId is required');
  }
  const ts = new Date().toISOString();
  const seq = await nextSeq(clientId);
  const signal = BehaviorSignalSchema.parse({
    clientId,
    eventType: input.eventType,
    targetId: input.targetId,
    durationMs: input.durationMs,
    ts,
    seq
  });
  const written = await appendRecord({ kind: 'behavior_signal', ...signal });
  await updateDecisionStateFromEventSafe(clientId, written);
  return written;
}

/**
 * @param {{
 *   clientId: string,
 *   requestId?: string,
 *   executionResult: { status: 'success' | 'rejected', reason: string | null },
 *   clientOutcome?: {
 *     status: 'accepted' | 'reverted' | 'purchased' | 'abandoned',
 *     rejectionReason: string | null
 *   } | null
 * }} input
 */
export async function appendOutcomeEvent(input) {
  const clientId = String(input.clientId ?? '').trim();
  if (!clientId) {
    throw new Error('clientId is required');
  }
  const ts = new Date().toISOString();
  const seq = await nextSeq(clientId);
  const outcome = OutcomeSchema.parse({
    clientId,
    ts,
    seq,
    requestId: input.requestId,
    executionResult: input.executionResult,
    clientOutcome: input.clientOutcome ?? null
  });
  const written = await appendRecord({ kind: 'outcome', ...outcome });
  await updateDecisionStateFromEventSafe(clientId, written);
  return written;
}

/**
 * Best-effort Outcome write for the command pipeline.
 * @param {Parameters<typeof appendOutcomeEvent>[0]} input
 */
export async function appendOutcomeEventSafe(input) {
  try {
    return await appendOutcomeEvent(input);
  } catch {
    return null;
  }
}

/**
 * Chronological Observation timeline for one clientId (ts, then seq).
 * @param {string} clientId
 * @returns {Promise<Array<Record<string, unknown>>>}
 */
export async function loadObservationTimeline(clientId) {
  const id = String(clientId ?? '').trim();
  if (!id) return [];
  let raw = '';
  try {
    raw = await readFile(observationPath(), 'utf8');
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
  /** @type {Array<Record<string, unknown>>} */
  const events = [];
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue;
    try {
      const parsed = JSON.parse(line);
      if (parsed && parsed.clientId === id) {
        events.push(parsed);
      }
    } catch {
      // skip corrupt lines
    }
  }
  events.sort((a, b) => {
    const tsA = typeof a.ts === 'string' ? a.ts : '';
    const tsB = typeof b.ts === 'string' ? b.ts : '';
    if (tsA < tsB) return -1;
    if (tsA > tsB) return 1;
    return (Number(a.seq) || 0) - (Number(b.seq) || 0);
  });
  return events;
}
