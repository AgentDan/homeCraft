import { boundingBox, boxesOverlap } from './geometry.js';

/** Overlap rule: two modules must not occupy the same volume (broad-phase via spatial index). */
export const RULE_ID = 'overlap';

/**
 * @param {import('./types.js').RuleContext} ctx
 * @returns {import('./types.js').Conflict[]}
 */
export function check({ modules, index }) {
  const conflicts = [];
  const byId = new Map(modules.map((module) => [module.instanceId, module]));
  const boxes = new Map(modules.map((module) => [module.instanceId, boundingBox(module)]));
  const checkedPairs = new Set();

  for (const module of modules) {
    for (const neighborId of index.getNeighbors(module.instanceId)) {
      const pair = [module.instanceId, neighborId].sort().join(':');
      if (checkedPairs.has(pair)) continue;
      checkedPairs.add(pair);

      const neighbor = byId.get(neighborId);
      const box = boxes.get(module.instanceId);
      const neighborBox = boxes.get(neighborId);
      if (neighbor && box && neighborBox && boxesOverlap(box, neighborBox)) {
        conflicts.push({
          kind: 'overlap',
          message: `${module.name} overlaps ${neighbor.name}.`,
          instanceIds: [module.instanceId, neighbor.instanceId],
          suggestedSkus: []
        });
      }
    }
  }

  return conflicts;
}
