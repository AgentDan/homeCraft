import { CompatibilityReportSchema } from '@homecraft/contracts';
import { materializePlan } from '../domain-modules/kitchen/materialize-plan.js';
import { getCatalogSnapshot } from '../knowledge-base/catalog-store.js';
import { buildSpatialIndex } from './spatial-index.js';
import { suggestAnalogs } from './analog-suggester.js';

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

  const index = buildSpatialIndex(modules, options.manifest?.spatialIndexCellMm ?? 1000);
  const ruleContext = { modules, context, index, manifest: options.manifest };

  const rules = options.compatibilityRules;
  if (!Array.isArray(rules) || rules.length === 0) {
    throw new Error('assertCompatible: options.compatibilityRules is required');
  }
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
