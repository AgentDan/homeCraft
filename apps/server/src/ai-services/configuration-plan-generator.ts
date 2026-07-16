import type {
  ConfigurationPlan,
  IntentResult,
  PlanOperation,
  RoomContext
} from '@homecraft/contracts';
import { createEmptyPlan } from '@homecraft/contracts';
import { retrieve } from './catalog-rag-retriever.js';

export type GeneratePlanInput = {
  intent: IntentResult;
  context: RoomContext;
  dialogText?: string;
  editorOperations?: PlanOperation[];
  sourceInputMode: 'dialog' | 'editor';
};

/**
 * Generates ConfigurationPlan. MUST call catalog-rag-retriever (invariant #5).
 */
export async function generatePlan(input: GeneratePlanInput): Promise<ConfigurationPlan> {
  const catalogId = input.context.catalogSnapshotId;
  const query = input.dialogText ?? '';
  const candidates = await retrieve(query, catalogId, 5);
  void candidates;
  void input.intent;

  const operations =
    input.sourceInputMode === 'editor' && input.editorOperations
      ? structuredClone(input.editorOperations)
      : [];

  return {
    ...createEmptyPlan({
      planId: `plan-${Date.now()}`,
      projectId: input.context.projectId,
      catalogSnapshotId: catalogId,
      sourceInputMode: input.sourceInputMode
    }),
    operations
  };
}
