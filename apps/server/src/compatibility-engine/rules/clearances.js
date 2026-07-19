import { footprint } from './geometry.js';

/**
 * Clearance rule: appliances that need breathing room must keep a side gap from
 * their horizontal neighbours.
 *
 * Only "significant" side clearances are enforced. Cabinets sit flush against each
 * other in real kitchens, and their tiny left/right values (5–10 mm fillers) must
 * not be treated as required gaps — otherwise a normal run of base cabinets would
 * be rejected. Values below the threshold are considered cosmetic and ignored.
 */
export const RULE_ID = 'clearances';

const MIN_ENFORCED_CLEARANCE_MM = 20;

/**
 * @param {import('./types.js').RuleContext} ctx
 * @returns {import('./types.js').Conflict[]}
 */
export function check({ modules }) {
  const conflicts = [];
  const reported = new Set();

  for (const left of modules) {
    for (const right of modules) {
      if (left === right) continue;

      const leftSize = footprint(left);
      const rightSize = footprint(right);
      const gap = right.position.x - (left.position.x + leftSize.widthMm);
      if (gap < 0) continue;

      const yOverlap =
        left.position.y < right.position.y + right.dimensions.heightMm
        && left.position.y + left.dimensions.heightMm > right.position.y;
      const zOverlap =
        left.position.z < right.position.z + rightSize.depthMm
        && left.position.z + leftSize.depthMm > right.position.z;
      if (!yOverlap || !zOverlap) continue;

      const required = Math.max(
        left.clearances?.rightMm ?? 0,
        right.clearances?.leftMm ?? 0
      );
      if (required < MIN_ENFORCED_CLEARANCE_MM || gap >= required) continue;

      const pair = [left.instanceId, right.instanceId].sort().join(':');
      if (reported.has(pair)) continue;
      reported.add(pair);

      conflicts.push({
        kind: 'clearance_violation',
        message: `${left.name} needs ${required} mm clearance from ${right.name} (only ${gap} mm).`,
        instanceIds: [left.instanceId, right.instanceId],
        suggestedSkus: []
      });
    }
  }

  return conflicts;
}
