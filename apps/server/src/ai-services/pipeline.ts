import type { ClientRequest, ConfigurationPlan, IntentResult, RoomContext } from '@homecraft/contracts';
import { detectIntent } from './intent-detector.js';
import { generatePlan } from './configuration-plan-generator.js';
import { buildPrompt } from './prompt-builder.js';
import { retrieve } from './catalog-rag-retriever.js';

export type AiPipelineResult = {
  intent: IntentResult;
  plan: ConfigurationPlan;
};

/**
 * AI pipeline: intent → retrieve → prompt → plan.
 * All ai-services stages are invoked from here (invariant: no dead paths).
 */
export async function runAiPipeline(
  request: ClientRequest,
  context: RoomContext
): Promise<AiPipelineResult> {
  const dialogText = request.command ?? '';
  const intent =
    request.inputMode === 'editor'
      ? ({ kind: 'unknown' as const, rawText: '', reason: 'editor_mode' })
      : await detectIntent(dialogText);

  const chunks = await retrieve(dialogText, context.catalogSnapshotId, 5);
  void buildPrompt({ context, intent, chunks });

  const plan = await generatePlan({
    intent,
    context,
    dialogText,
    editorOperations: request.editorOperations,
    sourceInputMode: request.inputMode
  });

  return { intent, plan };
}
