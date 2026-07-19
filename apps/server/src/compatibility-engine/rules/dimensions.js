import { footprint } from './geometry.js';

/** Room-bounds rule: a module must stay inside the room shell. */
export const RULE_ID = 'dimensions';

/**
 * @param {import('./types.js').RuleContext} ctx
 * @returns {import('./types.js').Conflict[]}
 */
export function check({ modules, context }) {
  const conflicts = [];
  const room = context.roomShape.dimensions;

  for (const module of modules) {
    const size = footprint(module);
    const beyond =
      module.position.x < 0
      || module.position.y < 0
      || module.position.z < 0
      || module.position.x + size.widthMm > room.widthMm
      || module.position.y + module.dimensions.heightMm > room.heightMm
      || module.position.z + size.depthMm > room.depthMm;

    if (beyond) {
      conflicts.push({
        kind: 'dimension_exceeded',
        message: `${module.name} extends beyond the room boundaries.`,
        instanceIds: [module.instanceId],
        suggestedSkus: []
      });
    }
  }

  return conflicts;
}
