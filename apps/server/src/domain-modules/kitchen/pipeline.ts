import type { ConfigurationPlan, RoomContext, SceneResult } from '@homecraft/contracts';

/**
 * Kitchen domain pipeline — deterministic scene build from plan.
 * Step0: empty scene.
 */
export async function runPipeline(
  plan: ConfigurationPlan,
  _context: RoomContext
): Promise<SceneResult> {
  return {
    projectId: plan.projectId,
    modules: []
  };
}
