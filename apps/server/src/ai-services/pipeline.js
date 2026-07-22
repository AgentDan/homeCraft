import { detectIntent } from './intent-detector.js';
import { generatePlan } from './configuration-plan-generator.js';
import { buildPrompt } from './prompt-builder.js';
import {
  retrieve,
  retrievePlatformRules
} from './catalog-rag-retriever.js';
import { runtimeConfig } from '../config/runtime.js';

/**
 * AI pipeline: intent → retrieve → prompt → plan.
 * All ai-services stages are invoked from here (invariant: no dead paths).
 */
export async function runAiPipeline(request, context) {
  const dialogText = request.command;
  const intent = await detectIntent(dialogText, request.language);

  const [candidates, platformRules] = await Promise.all([
    retrieve(dialogText, context.catalogSnapshotId, runtimeConfig.kbTopK),
    retrievePlatformRules(dialogText, 3)
  ]);
  const prompt = buildPrompt({
    context,
    intent,
    chunks: [...candidates, ...platformRules]
  });
  const { plan, outcome } = await generatePlan({
    intent,
    context,
    dialogText,
    candidates,
    platformRules,
    prompt
  });

  return { intent, plan, outcome };
}
