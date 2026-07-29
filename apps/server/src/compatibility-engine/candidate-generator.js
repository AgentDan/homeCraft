import { ConfigurationPlanSchema } from '@homecraft/contracts';
import { assertCompatible } from './assertCompatible.js';
import { getCachedBOM } from '../pricing-engine/bom-cache.js';

const MAX_CANDIDATES = 3;

/**
 * Given a rejected plan and its compatibility report, produces up to
 * MAX_CANDIDATES valid alternative plans by replacing the first conflicting
 * module with each of the `suggestedSkus` from the conflict report.
 *
 * Each candidate is re-checked with `assertCompatible`; only `valid: true`
 * candidates are returned, each with a BOM.
 *
 * @param {{
 *   plan: import('zod').infer<typeof ConfigurationPlanSchema>,
 *   compatibility: { conflicts: Array<{ kind: string, instanceIds: string[], suggestedSkus: string[] }> },
 *   context: object
 * }} input
 * @returns {Promise<Array<{
 *   label: string,
 *   plan: import('zod').infer<typeof ConfigurationPlanSchema>,
 *   bom: { totalEur: number, [k: string]: unknown },
 *   replacedInstanceId: string,
 *   replacedWithSku: string
 * }>>}
 */
export async function generateCandidates({ plan, compatibility, context }) {
  const seenSkus = new Set();
  const candidatePlans = [];

  for (const conflict of compatibility.conflicts) {
    if (candidatePlans.length >= MAX_CANDIDATES) break;
    const targetId = conflict.instanceIds[0];
    if (!targetId) continue;

    for (const sku of conflict.suggestedSkus) {
      if (candidatePlans.length >= MAX_CANDIDATES) break;
      const key = `${targetId}:${sku}`;
      if (seenSkus.has(key)) continue;
      seenSkus.add(key);

      const altOperations = [
        ...plan.operations,
        { type: 'replace_module', instanceId: targetId, sku }
      ];
      const altPlan = ConfigurationPlanSchema.parse({
        ...structuredClone(plan),
        operations: altOperations
      });

      const report = await assertCompatible(altPlan, context);
      if (!report.valid) continue;

      const bom = await getCachedBOM(altPlan, plan.catalogSnapshotId);
      candidatePlans.push({
        label: `Replace ${targetId} with ${sku}`,
        plan: altPlan,
        bom,
        replacedInstanceId: targetId,
        replacedWithSku: sku
      });
    }
  }

  return candidatePlans;
}
