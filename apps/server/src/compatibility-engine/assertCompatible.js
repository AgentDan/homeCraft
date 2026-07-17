import { CompatibilityReportSchema } from '@homecraft/contracts';
import { materializePlan } from '../domain-modules/kitchen/materialize-plan.js';
import { SpatialIndex } from './spatial-index.js';

function footprint(module) {
  const rotated = Math.abs(module.rotationY % 180) === 90;
  return {
    widthMm: rotated ? module.dimensions.depthMm : module.dimensions.widthMm,
    depthMm: rotated ? module.dimensions.widthMm : module.dimensions.depthMm
  };
}

function overlaps(left, right) {
  const leftSize = footprint(left);
  const rightSize = footprint(right);
  return left.position.x < right.position.x + rightSize.widthMm
    && left.position.x + leftSize.widthMm > right.position.x
    && left.position.y < right.position.y + right.dimensions.heightMm
    && left.position.y + left.dimensions.heightMm > right.position.y
    && left.position.z < right.position.z + rightSize.depthMm
    && left.position.z + leftSize.depthMm > right.position.z;
}

/** Compatibility firewall — the only stage allowed to reject a plan. */
export async function assertCompatible(plan, context) {
  const conflicts = [];
  let modules;
  try {
    modules = await materializePlan(plan);
  } catch (error) {
    conflicts.push({
      kind: 'unsupported_appliance',
      message: error instanceof Error ? error.message : String(error),
      instanceIds: [],
      suggestedSkus: []
    });
    modules = [];
  }

  for (const module of modules) {
    const size = footprint(module);
    const room = context.roomShape.dimensions;
    if (
      module.position.x < 0
      || module.position.y < 0
      || module.position.z < 0
      || module.position.x + size.widthMm > room.widthMm
      || module.position.y + module.dimensions.heightMm > room.heightMm
      || module.position.z + size.depthMm > room.depthMm
    ) {
      conflicts.push({
        kind: 'dimension_exceeded',
        message: `${module.name} выходит за границы комнаты.`,
        instanceIds: [module.instanceId],
        suggestedSkus: []
      });
    }

    const requiresWallHeight = module.mounting === 'wall';
    if (
      (requiresWallHeight && module.position.y === 0)
      || (!requiresWallHeight && module.position.y !== 0)
    ) {
      conflicts.push({
        kind: 'mounting_mismatch',
        message: `${module.name} установлен на неподходящей высоте.`,
        instanceIds: [module.instanceId],
        suggestedSkus: []
      });
    }
  }

  const index = new SpatialIndex().buildFromModules(modules);
  const modulesById = new Map(modules.map((module) => [module.instanceId, module]));
  const checkedPairs = new Set();
  for (const module of modules) {
    for (const neighborId of index.getNeighbors(module.instanceId)) {
      const pair = [module.instanceId, neighborId].sort().join(':');
      if (checkedPairs.has(pair)) continue;
      checkedPairs.add(pair);
      const neighbor = modulesById.get(neighborId);
      if (neighbor && overlaps(module, neighbor)) {
        conflicts.push({
          kind: 'overlap',
          message: `${module.name} пересекается с ${neighbor.name}.`,
          instanceIds: [module.instanceId, neighbor.instanceId],
          suggestedSkus: []
        });
      }
    }
  }

  return CompatibilityReportSchema.parse({
    valid: conflicts.length === 0,
    conflicts,
    checkedAt: new Date().toISOString()
  });
}
