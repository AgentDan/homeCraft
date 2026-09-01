/**
 * Diagnostic console logger for pipeline variable diffs.
 * Side-effect only — never changes return values or control flow.
 */

/** @type {Map<string, Record<string, Record<string, unknown>>>} */
const prevBySession = new Map();

/**
 * @param {string} blockName
 * @param {string | undefined} planId
 * @param {Record<string, unknown> | null | undefined} prevState
 * @param {Record<string, unknown>} nextState
 * @param {string} [requestId]
 */
export function diffLog(blockName, planId, prevState, nextState, requestId) {
  const req = requestId ?? 'unknown';
  const prefix = `[${blockName}] req=${req} planId=${planId}`;
  const changed = {};
  for (const key of Object.keys(nextState)) {
    const prev = prevState ? prevState[key] : undefined;
    const next = nextState[key];
    if (JSON.stringify(prev) !== JSON.stringify(next)) {
      changed[key] = { from: prev, to: next };
    }
  }
  if (Object.keys(changed).length > 0) {
    console.log(prefix, changed);
  } else {
    console.log(`${prefix} — без изменений`);
  }
}

/**
 * Prints a blank-line separator so consecutive commands are easy to tell apart.
 *
 * @param {{ requestId?: string, command?: string } | null | undefined} request
 */
export function beginRequestLog(request) {
  const req = request?.requestId ?? 'unknown';
  const cmd = String(request?.command ?? '').replace(/\s+/g, ' ').slice(0, 80);
  console.log(`\n──────── req=${req} cmd=${JSON.stringify(cmd)} ────────`);
}

/**
 * Logs a block snapshot and stores it as prevState for the next call
 * of the same block in this session (first dialog step has no prev).
 *
 * @param {{ sessionId?: string, requestId?: string } | null | undefined} request
 * @param {string} blockName
 * @param {string | undefined} planId
 * @param {Record<string, unknown>} nextState
 */
export function logPipelineDiff(request, blockName, planId, nextState) {
  const sessionId = request?.sessionId ?? 'unknown';
  const store = prevBySession.get(sessionId) ?? {};
  const prev = store[blockName];
  diffLog(blockName, planId, prev, nextState, request?.requestId);
  store[blockName] = nextState;
  prevBySession.set(sessionId, store);
}

/**
 * @param {unknown} plan
 * @param {{ projectId?: string } | null | undefined} [context]
 * @returns {string | undefined}
 */
export function snapshotPlanId(plan, context) {
  if (plan && typeof plan === 'object' && 'planId' in plan) {
    const id = /** @type {{ planId?: unknown }} */ (plan).planId;
    if (typeof id === 'string' && id) return id;
  }
  return context?.projectId ? `plan-${context.projectId}` : undefined;
}
