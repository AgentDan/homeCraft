/**
 * Kitchen domain pipeline — deterministic scene build from plan.
 * Step0: empty scene.
 */
export async function runPipeline(plan, _context) {
  return {
    projectId: plan.projectId,
    modules: []
  };
}
