import { centerXZ } from './geometry.js';

/**
 * Utilities rule: a module that needs a connection (water, gas, electric, drain)
 * must sit close to a matching utility point in the room.
 *
 * Utility points are optional room data. When the room models no point of a given
 * kind, that requirement is treated as "not modeled yet" and skipped rather than
 * rejected — this keeps Phase 1 rooms (empty utilities) valid.
 */
export const RULE_ID = 'utilities';

const MAX_UTILITY_DISTANCE_MM = 900;

/**
 * @param {import('./types.js').RuleContext} ctx
 * @returns {import('./types.js').Conflict[]}
 */
export function check({ modules, context }) {
  const conflicts = [];
  const points = context.roomShape.utilities ?? [];
  if (points.length === 0) return conflicts;

  for (const module of modules) {
    const required = module.utilities ?? [];
    if (required.length === 0) continue;

    const center = centerXZ(module);
    const missing = [];

    for (const kind of required) {
      const pointsOfKind = points.filter((point) => point.kind === kind);
      if (pointsOfKind.length === 0) continue;

      const withinReach = pointsOfKind.some((point) => {
        const distance = Math.hypot(point.position.x - center.x, point.position.z - center.z);
        return distance <= MAX_UTILITY_DISTANCE_MM;
      });

      if (!withinReach) missing.push(kind);
    }

    if (missing.length > 0) {
      conflicts.push({
        kind: 'utility_conflict',
        message: `${module.name} is too far from the required ${missing.join(', ')} connection${missing.length > 1 ? 's' : ''}.`,
        instanceIds: [module.instanceId],
        suggestedSkus: []
      });
    }
  }

  return conflicts;
}
