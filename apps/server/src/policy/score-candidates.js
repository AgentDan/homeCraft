import { getCatalogSnapshot } from '../knowledge-base/catalog-store.js';

/**
 * @typedef {{
 *   label: string,
 *   plan: object,
 *   bom: { totalEur: number },
 *   replacedInstanceId: string,
 *   replacedWithSku: string
 * }} Candidate
 */

/**
 * @typedef {{
 *   candidate: Candidate,
 *   score: number,
 *   breakdown: { price: number, ergonomics: number, style: number }
 * }} ScoredCandidate
 */

/**
 * Scores valid conflict-resolution candidates against a loaded policy.
 * Criteria (deterministic, no LLM):
 * - price: cheaper totalEur → higher
 * - ergonomics: wider replacement SKU → higher (more usable storage among valid swaps)
 * - style: replacement width closer to the original module → higher (less visual change)
 *
 * @param {Candidate[]} candidates
 * @param {{ weights: { price: number, ergonomics: number, style: number } }} policy
 * @param {{ catalogSnapshotId: string, rejectedPlan: { operations: unknown[] } }} context
 * @returns {Promise<ScoredCandidate[]>}
 */
export async function scoreCandidates(candidates, policy, context) {
  if (candidates.length === 0) return [];

  const catalog = await getCatalogSnapshot(context.catalogSnapshotId);
  const bySku = new Map(catalog.modules.map((module) => [module.sku, module]));

  const originalWidths = new Map();
  for (const candidate of candidates) {
    if (originalWidths.has(candidate.replacedInstanceId)) continue;
    originalWidths.set(
      candidate.replacedInstanceId,
      resolveOriginalWidth(context.rejectedPlan, candidate.replacedInstanceId, bySku)
    );
  }

  const prices = candidates.map((candidate) => candidate.bom.totalEur);
  const widths = candidates.map(
    (candidate) => bySku.get(candidate.replacedWithSku)?.dimensions.widthMm ?? 0
  );
  const styleGaps = candidates.map((candidate) => {
    const original = originalWidths.get(candidate.replacedInstanceId) ?? 0;
    const width = bySku.get(candidate.replacedWithSku)?.dimensions.widthMm ?? 0;
    return Math.abs(original - width);
  });

  const priceScores = invertNormalize(prices);
  const ergoScores = normalize(widths);
  const styleScores = invertNormalize(styleGaps);

  return candidates
    .map((candidate, index) => {
      const breakdown = {
        price: priceScores[index],
        ergonomics: ergoScores[index],
        style: styleScores[index]
      };
      const score =
        policy.weights.price * breakdown.price
        + policy.weights.ergonomics * breakdown.ergonomics
        + policy.weights.style * breakdown.style;
      return {
        candidate,
        score: Number(score.toFixed(6)),
        breakdown
      };
    })
    .sort((a, b) => b.score - a.score || a.candidate.bom.totalEur - b.candidate.bom.totalEur);
}

/**
 * Confidence gate: auto-apply the winner only when alone or clearly ahead.
 *
 * @param {ScoredCandidate[]} scored
 * @param {{ minGapToSecond: number }} policy
 * @returns {{
 *   decision: 'auto_apply' | 'ask_user',
 *   winner: ScoredCandidate | null,
 *   gap: number,
 *   ranked: ScoredCandidate[]
 * }}
 */
export function selectByConfidence(scored, policy) {
  if (scored.length === 0) {
    return { decision: 'ask_user', winner: null, gap: 0, ranked: [] };
  }
  if (scored.length === 1) {
    return {
      decision: 'auto_apply',
      winner: scored[0],
      gap: 1,
      ranked: scored
    };
  }
  const gap = Number((scored[0].score - scored[1].score).toFixed(6));
  if (gap >= policy.minGapToSecond) {
    return {
      decision: 'auto_apply',
      winner: scored[0],
      gap,
      ranked: scored
    };
  }
  return {
    decision: 'ask_user',
    winner: null,
    gap,
    ranked: scored
  };
}

/**
 * Min-max normalize to [0, 1]. Equal values → all 1.
 * @param {number[]} values
 */
function normalize(values) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max === min) return values.map(() => 1);
  return values.map((value) => (value - min) / (max - min));
}

/**
 * Invert of normalize: smaller raw value → higher score.
 * @param {number[]} values
 */
function invertNormalize(values) {
  return normalize(values.map((value) => -value));
}

/**
 * Walk plan ops to find the SKU currently on instanceId, then its catalog width.
 * @param {{ operations: Array<{ type: string, sku?: string, instanceId?: string }> }} plan
 * @param {string} instanceId
 * @param {Map<string, { dimensions: { widthMm: number } }>} bySku
 */
function resolveOriginalWidth(plan, instanceId, bySku) {
  /** @type {Map<string, string>} */
  const active = new Map();
  let addIndex = 0;
  for (const operation of plan.operations) {
    if (operation.type === 'add_module') {
      addIndex += 1;
      active.set(`module-${addIndex}`, operation.sku);
    } else if (operation.type === 'remove_module') {
      active.delete(operation.instanceId);
    } else if (operation.type === 'replace_module') {
      if (active.has(operation.instanceId)) {
        active.set(operation.instanceId, operation.sku);
      }
    }
  }
  const sku = active.get(instanceId);
  return sku ? (bySku.get(sku)?.dimensions.widthMm ?? 0) : 0;
}
