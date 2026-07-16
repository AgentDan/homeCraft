import { createEmptyBOM } from '@homecraft/contracts';

/**
 * Pure BOM calculator — never rejects plans for budget (invariant #3).
 * Step0: returns empty BOM.
 */
export async function calculateBOM(_plan, catalogSnapshotId) {
  return createEmptyBOM(catalogSnapshotId);
}
