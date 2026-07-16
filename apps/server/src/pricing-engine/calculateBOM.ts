import type { BOM, ConfigurationPlan } from '@homecraft/contracts';
import { createEmptyBOM } from '@homecraft/contracts';

/**
 * Pure BOM calculator — never rejects plans for budget (invariant #3).
 * Step0: returns empty BOM.
 */
export async function calculateBOM(
  _plan: ConfigurationPlan,
  catalogSnapshotId: string
): Promise<BOM> {
  return createEmptyBOM(catalogSnapshotId);
}
