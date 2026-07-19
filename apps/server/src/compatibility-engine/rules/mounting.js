/** Mounting rule: wall units hang above the floor, everything else stands on it. */
export const RULE_ID = 'mounting';

/**
 * @param {import('./types.js').RuleContext} ctx
 * @returns {import('./types.js').Conflict[]}
 */
export function check({ modules }) {
  const conflicts = [];

  for (const module of modules) {
    const wallMounted = module.mounting === 'wall';
    const onFloor = module.position.y === 0;

    if ((wallMounted && onFloor) || (!wallMounted && !onFloor)) {
      conflicts.push({
        kind: 'mounting_mismatch',
        message: `${module.name} is installed at an unsuitable height.`,
        instanceIds: [module.instanceId],
        suggestedSkus: []
      });
    }
  }

  return conflicts;
}
