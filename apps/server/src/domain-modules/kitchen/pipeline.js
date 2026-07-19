import { SceneResultSchema } from '@homecraft/contracts';
import { materializePlan } from './materialize-plan.js';

/** Builds a deterministic client scene from cumulative plan operations. */
export async function runPipeline(plan, _context) {
  const modules = await materializePlan(plan);
  return SceneResultSchema.parse({
    projectId: plan.projectId,
    modules: modules.map((module) => ({
      instanceId: module.instanceId,
      sku: module.sku,
      name: module.name,
      category: module.category,
      dimensions: module.dimensions,
      position: module.position,
      rotationY: module.rotationY,
      finishId: module.finishId
    }))
  });
}
