import { route } from '../core/orchestrator.js';
import {
  loadCommandJournal,
  loadPlanHistory,
  resolveCurrentEntry
} from './local-storage.js';

/**
 * Strip volatile fields so two plans can be compared for replay purity.
 * @param {object | null | undefined} plan
 */
export function normalizePlanSnapshot(plan) {
  if (!plan) {
    return null;
  }
  return {
    catalogSnapshotId: plan.catalogSnapshotId,
    operations: structuredClone(plan.operations ?? [])
  };
}

/**
 * @param {string} sessionId
 * @param {string} projectId
 */
export async function loadCurrentPlanSnapshot(sessionId, projectId) {
  const history = await loadPlanHistory(sessionId, projectId);
  const entry = resolveCurrentEntry(history);
  if (!entry) {
    return {
      planVersion: 0,
      plan: null,
      normalized: null
    };
  }
  return {
    planVersion: entry.version,
    plan: structuredClone(entry.plan),
    normalized: normalizePlanSnapshot(entry.plan)
  };
}

/**
 * Replays a project's command journal from scratch into a fresh session/project.
 * Uses new requestIds so idempotency cache does not short-circuit.
 *
 * @param {string} projectId
 * @param {{
 *   sessionId?: string,
 *   replayProjectId?: string
 * }} [options]
 */
export async function replayJournal(projectId, options = {}) {
  const journal = await loadCommandJournal(projectId);
  const replaySessionId = options.sessionId ?? `replay-sess-${projectId}`;
  const replayProjectId = options.replayProjectId ?? `replay-proj-${projectId}`;

  let expectedVersion = 0;

  for (const record of journal) {
    const result = await route({
      requestId: `replay-${record.seq}-${record.requestId}`,
      sessionId: replaySessionId,
      projectId: replayProjectId,
      command: record.rawInput,
      inputChannel: record.inputChannel,
      language: record.language,
      expectedVersion,
      catalogSnapshotId: record.catalogSnapshotId,
      clientState: {}
    });

    if (result.statusCode === 409) {
      throw new Error(
        `replayJournal hit version_conflict at seq=${record.seq} rawInput=${record.rawInput}`
      );
    }

    if (typeof result.response?.planVersion === 'number') {
      expectedVersion = result.response.planVersion;
    }
  }

  const snapshot = await loadCurrentPlanSnapshot(replaySessionId, replayProjectId);
  return {
    journalLength: journal.length,
    replaySessionId,
    replayProjectId,
    ...snapshot
  };
}
