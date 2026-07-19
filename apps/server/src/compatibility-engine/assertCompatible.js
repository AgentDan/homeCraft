import { CompatibilityReportSchema } from '@homecraft/contracts';
import { materializePlan } from '../domain-modules/kitchen/materialize-plan.js';
import { getCatalogSnapshot } from '../knowledge-base/catalog-store.js';
import { SpatialIndex } from './spatial-index.js';
import { suggestAnalogs } from './analog-suggester.js';
import { check as checkDimensions } from './rules/dimensions.js';
import { check as checkMounting } from './rules/mounting.js';
import { check as checkOverlap } from './rules/overlap.js';
import { check as checkUtilities } from './rules/utilities.js';
import { check as checkClearances } from './rules/clearances.js';

/** Ordered compatibility rules. Each maps a placed layout to a list of conflicts. */
const RULES = [
  checkDimensions,
  checkMounting,
  checkOverlap,
  checkUtilities,
  checkClearances
];

/** Compatibility firewall — the only stage allowed to reject a plan. */
export async function assertCompatible(plan, context) {
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

  const index = new SpatialIndex().buildFromModules(modules);
  const ruleContext = { modules, context, index };

  const conflicts = [];
  for (const rule of RULES) {
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
