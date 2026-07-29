import { loadPolicy } from './load-policy.js';
import { scoreCandidates, selectByConfidence } from './score-candidates.js';

/**
 * Rank candidates with the configured policy and decide auto-apply vs ask.
 *
 * @param {Array<{
 *   label: string,
 *   plan: object,
 *   bom: { totalEur: number },
 *   replacedInstanceId: string,
 *   replacedWithSku: string
 * }>} candidates
 * @param {{ catalogSnapshotId: string, rejectedPlan: object }} context
 * @param {{ policy?: Awaited<ReturnType<typeof loadPolicy>> }} [options]
 */
export async function decideCandidates(candidates, context, options = {}) {
  const policy = options.policy ?? (await loadPolicy());
  const ranked = await scoreCandidates(candidates, policy, context);
  const selection = selectByConfidence(ranked, policy);
  return {
    policy,
    ...selection
  };
}
