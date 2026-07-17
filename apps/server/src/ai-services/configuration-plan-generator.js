import { createEmptyPlan } from '@homecraft/contracts';
import { retrieve } from './catalog-rag-retriever.js';

/**
 * Generates ConfigurationPlan. MUST call catalog-rag-retriever (invariant #5).
 */
export async function generatePlan(input) {
  const catalogId = input.context.catalogSnapshotId;
  const query = input.dialogText ?? '';
  await retrieve(query, catalogId, 5);

  return createEmptyPlan({
    planId: `plan-${Date.now()}`,
    projectId: input.context.projectId,
    catalogSnapshotId: catalogId
  });
}
