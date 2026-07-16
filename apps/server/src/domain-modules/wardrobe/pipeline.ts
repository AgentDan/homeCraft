import type { ConfigurationPlan, RoomContext, SceneResult } from '@homecraft/contracts';

export async function runPipeline(
  _plan: ConfigurationPlan,
  _context: RoomContext
): Promise<SceneResult> {
  throw new Error('Not implemented: wardrobe domain');
}
