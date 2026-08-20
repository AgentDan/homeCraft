import { CompatibilityReportSchema } from '@homecraft/contracts';
import { materializePlan } from '../domain-modules/kitchen/materialize-plan.js';
import { getCatalogSnapshot } from '../knowledge-base/catalog-store.js';
import { buildSpatialIndex } from './spatial-index.js';
import { suggestAnalogs } from './analog-suggester.js';
import { check as checkDimensions } from '../../../../packages/manifests/kitchen/compatibility-rules/dimensions.js';
import { check as checkMounting } from '../../../../packages/manifests/kitchen/compatibility-rules/mounting.js';
import { check as checkOverlap } from '../../../../packages/manifests/kitchen/compatibility-rules/overlap.js';
import { check as checkUtilities } from '../../../../packages/manifests/kitchen/compatibility-rules/utilities.js';
import { check as checkClearances } from '../../../../packages/manifests/kitchen/compatibility-rules/clearances.js';

/** Ordered compatibility rules — fallback when manifest.compatibilityRules is unset. */
const DEFAULT_RULES = [
  checkDimensions,
  checkMounting,
  checkOverlap,
  checkUtilities,
  checkClearances
];

/** Compatibility firewall — the only stage allowed to reject a plan. */
export async function assertCompatible(plan, context, options = {}) {
  let modules;
  try {
    modules = await materializePlan(plan);
  } catch (error) {
    return CompatibilityReportSchema.parse({
      valid: false,
      conflicts: [
        {
          kind: 'unsupported_appliance',
          message: error instanceof Error ? error.message : String(error),
          instanceIds: [],
          suggestedSkus: []
        }
      ],
      checkedAt: new Date().toISOString()
    });
  }

  const index = buildSpatialIndex(modules);
  const ruleContext = { modules, context, index };

  const rules = options.compatibilityRules ?? DEFAULT_RULES;
  const conflicts = [];
  for (const rule of rules) {
    conflicts.push(...rule(ruleContext));
  }

  await enrichWithSuggestions(conflicts, modules, plan.catalogSnapshotId);

  return CompatibilityReportSchema.parse({
    valid: conflicts.length === 0,
    conflicts,
    checkedAt: new Date().toISOString()
  });
}

/**
 * Populates `suggestedSkus` on each conflict from the frozen catalog snapshot.
 * @param {import('./rules/types.js').Conflict[]} conflicts
 * @param {import('./rules/types.js').PlacedModule[]} modules
 * @param {string} catalogSnapshotId
 */
async function enrichWithSuggestions(conflicts, modules, catalogSnapshotId) {
  if (conflicts.length === 0) return;

  const catalog = await getCatalogSnapshot(catalogSnapshotId);
  const byId = new Map(modules.map((module) => [module.instanceId, module]));

  for (const conflict of conflicts) {
    const targetId = conflict.instanceIds[0];
    const module = targetId ? byId.get(targetId) : null;
    conflict.suggestedSkus = suggestAnalogs(module, catalog, conflict.kind);
  }
}
